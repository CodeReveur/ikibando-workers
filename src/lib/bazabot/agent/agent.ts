/**
 * The BazaBot reasoning loop.
 *
 * Flow (per the target architecture):
 *   intent detection → reasoning → tool selection → execute tool →
 *   analyze result → (repeat, bounded) → generate response.
 *
 * The model drives tool selection via a strict JSON action protocol
 * (prompt-builder). Each iteration either calls a tool and feeds the observation
 * back, or decides it is ready to answer. The FINAL answer is produced by a
 * dedicated streaming pass (provider.chatStream), so tokens reach the user as
 * the model generates them — true token-level streaming, not server chunking.
 *
 * The loop is hard-bounded by config.maxSteps to keep latency predictable on
 * small models.
 */
import type { BazaBotConfig } from "../config";
import type { AIProvider } from "../providers";
import type { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/types";
import type {
  AgentAction, AgentEmit, AgentMeta, AgentRequest, AgentResult, ChatMessage, Suggestion,
} from "../types";
import { detectIntent, type DetectedIntent } from "../intent/intent";
import { routeIntent, keywordAugment } from "../intent/routing";
import { buildSystemPrompt, buildComposePrompt } from "../prompt/prompt-builder";
import { sanitizeReply, contextualSuggestions } from "./response";
import { analytics } from "../analytics/analytics";
import { defaultMemoryStore, recordTurn, recordToolResult, type MemoryStore } from "../memory/memory";
import { log } from "../logger";

interface ParsedAction {
  action: "tool" | "final";
  tool?: string;
  args?: Record<string, unknown>;
  reply?: string;
  thought?: string;
}

/** Extract the first balanced JSON object from model text. */
function parseAction(text: string): ParsedAction | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          const obj = JSON.parse(text.slice(start, i + 1));
          if (obj && (obj.action === "tool" || obj.action === "final")) return obj as ParsedAction;
          if (obj?.tool) return { action: "tool", ...obj };
          if (obj?.reply) return { action: "final", ...obj };
        } catch { /* keep scanning */ }
      }
    }
  }
  return null;
}

/** User-facing status text while a given tool runs. */
function toolStatus(tool: string): string {
  const map: Record<string, string> = {
    searchJobs: "Searching jobs…", searchWorkers: "Finding workers…",
    searchEmployers: "Finding employers…", searchCategories: "Checking categories…",
    searchLocations: "Checking locations…", getWallet: "Checking your wallet…",
    getTransactions: "Reviewing your transactions…", getNotifications: "Checking notifications…",
    searchBookings: "Looking up your jobs…", getProfile: "Reading your profile…",
    updateProfile: "Updating your profile…", checkVerification: "Checking verification…",
    getPricing: "Checking the fees…", searchKnowledge: "Searching the help center…",
    searchFAQ: "Checking the FAQ…", searchHelp: "Searching help articles…",
  };
  return map[tool] ?? "Looking that up…";
}

const FALLBACK_REPLY =
  "I'm not fully sure about that yet. Could you rephrase, or would you like me to connect you with a support agent?";

/** Low temperature for the final answer keeps it grounded in retrieved facts. */
const COMPOSE_TEMPERATURE = 0.1;

export class Agent {
  constructor(
    private cfg: BazaBotConfig,
    private provider: AIProvider,
    private registry: ToolRegistry,
    private memory: MemoryStore = defaultMemoryStore,
  ) {}

  /** Non-streaming convenience wrapper — collects the streamed deltas. */
  async run(req: AgentRequest): Promise<AgentResult> {
    let reply = "";
    const meta = await this.runStream(req, (ev, data) => {
      if (ev === "delta") reply += data.text ?? "";
    });
    return { reply: reply || FALLBACK_REPLY, ...meta };
  }

  /**
   * Run one turn, streaming status + answer tokens through `emit`. Returns the
   * turn metadata (reply is delivered via emit("delta", …)).
   */
  async runStream(req: AgentRequest, emit: AgentEmit): Promise<AgentMeta> {
    const started = Date.now();
    const { message, context } = req;
    const toolCtx: ToolContext = {
      token: context.token, role: context.role, userId: context.userId, page: context.page,
    };

    // 1) Intent + language
    const intent = await detectIntent(message, context.language, this.provider);
    emit("status", { text: "Thinking…" });

    // 2) Assemble the conversation (server memory is the source of truth)
    const mem = await this.memory.get(context.sessionId);
    const system = buildSystemPrompt(context, this.registry, toolCtx, intent);
    const history = (mem.turns.length ? mem.turns : (req.history ?? [])).slice(-8);
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: message },
    ];

    const actions: AgentAction[] = [];
    const observations: string[] = [];
    const ran = new Set<string>();

    /** Execute one planned/selected tool call, recording everything. */
    const runTool = async (toolName: string, args: Record<string, unknown>): Promise<void> => {
      const name = (toolName ?? "").trim();
      if (!name || !this.registry.get(name)) return;
      const dedupeKey = `${name}:${JSON.stringify(args ?? {})}`;
      if (ran.has(dedupeKey)) return;
      ran.add(dedupeKey);

      emit("status", { text: toolStatus(name) });
      const result = await this.registry.execute(name, args ?? {}, toolCtx);
      const tool = this.registry.get(name);
      const action: AgentAction = { tool: name, explanation: tool?.explain ?? "I looked that up", ok: result.ok };
      actions.push(action);
      emit("action", action);
      void analytics.tool(name, result.ok);
      if (/knowledge|faq|help/i.test(name)) {
        void analytics.knowledge(result.ok && Array.isArray(result.data) && result.data.length > 0);
      }
      recordToolResult(mem, result.summary);
      if (result.ok) observations.push(result.summary);
      messages.push({ role: "tool", name, content: `Observation from ${name}: ${result.summary}` });
    };

    // 3a) Deterministic grounding — intent routing + keyword-triggered tools.
    //     Robust to classifier errors; the dedupe in runTool collapses overlaps.
    for (const call of [...routeIntent(intent, message), ...keywordAugment(message)]) {
      await runTool(call.tool, call.args);
    }

    // 3b) Optional model-driven tool loop (for larger, tool-capable models).
    if (this.cfg.modelToolLoop) {
      for (let step = 0; step < this.cfg.maxSteps; step++) {
        const raw = await this.provider.chat(messages, { json: true, temperature: this.cfg.temperature });
        const parsed = parseAction(raw);
        if (!parsed || parsed.action === "final") break;
        const toolName = (parsed.tool ?? "").trim();
        if (!toolName || !this.registry.get(toolName)) break;
        messages.push({ role: "assistant", content: raw });
        await runTool(toolName, parsed.args ?? {});
      }
    }

    // 4) Stream the final answer token-by-token from the model.
    emit("status", { text: "Composing answer…" });
    const finalText = await this.streamCompose(message, context, intent, observations, emit);
    const reply = sanitizeReply(finalText) || FALLBACK_REPLY;

    // 5) Persist + suggestions + analytics
    recordTurn(mem, { role: "user", content: message });
    recordTurn(mem, { role: "assistant", content: reply });
    await this.memory.save(mem);

    const suggestions: Suggestion[] = contextualSuggestions(intent.intent, context.role);
    const latencyMs = Date.now() - started;
    void analytics.turn("ai", intent.intent, latencyMs, false);

    return {
      source: "ai", intent: intent.intent, lang: intent.lang,
      actions, suggestions, escalate: false, latencyMs,
    };
  }

  /**
   * Generate the user-facing answer as a stream, grounded in the tool
   * observations. Emits each token via emit("delta", …) and returns the full
   * text. Falls back to a single non-streaming call on stream failure.
   */
  private async streamCompose(
    message: string,
    context: AgentRequest["context"],
    intent: DetectedIntent,
    observations: string[],
    emit: AgentEmit,
  ): Promise<string> {
    const sys = buildComposePrompt(context, intent);
    const grounding = observations.length
      ? `Verified information I retrieved (use only this for platform facts, never invent):\n${observations.map(o => `- ${o}`).join("\n")}`
      : `No lookups were needed — answer from general platform knowledge, and do not invent specific data.`;
    const user = `User question: "${message}"\n\n${grounding}\n\nReply now, concisely and warmly.`;
    const msgs: ChatMessage[] = [
      { role: "system", content: sys },
      { role: "user", content: user },
    ];

    try {
      let full = "";
      for await (const chunk of this.provider.chatStream(msgs, { temperature: COMPOSE_TEMPERATURE, json: false })) {
        if (chunk.delta) { full += chunk.delta; emit("delta", { text: chunk.delta }); }
        if (chunk.done) break;
      }
      if (full.trim()) return full;
    } catch (e) {
      log.warn("streaming compose failed, retrying non-streamed", { message: (e as Error)?.message });
    }

    // Non-streamed fallback: fetch the whole answer, then emit it once.
    try {
      const text = await this.provider.chat(msgs, { temperature: COMPOSE_TEMPERATURE });
      if (text.trim()) { emit("delta", { text }); return text; }
    } catch (e) {
      log.warn("compose fallback failed", { message: (e as Error)?.message });
    }
    return observations[0] ?? "";
  }
}
