/**
 * The BazaBot reasoning loop.
 *
 * Flow (per the target architecture):
 *   intent detection → reasoning → tool selection → execute tool →
 *   analyze result → (repeat, bounded) → generate response.
 *
 * The model drives tool selection via a strict JSON action protocol
 * (prompt-builder). Each iteration either calls a tool and feeds the observation
 * back, or produces the final answer. The loop is hard-bounded by config.maxSteps
 * to keep latency and cost predictable on small models.
 */
import type { BazaBotConfig } from "../config";
import type { AIProvider } from "../providers";
import type { ToolRegistry } from "../tools";
import type { ToolContext } from "../tools/types";
import type { AgentAction, AgentRequest, AgentResult, ChatMessage, Suggestion } from "../types";
import { detectIntent, type DetectedIntent } from "../intent/intent";
import { buildSystemPrompt, buildComposePrompt } from "../prompt/prompt-builder";
import { sanitizeReply, normalizeSuggestions } from "./response";
import { analytics } from "../analytics/analytics";
import { defaultMemoryStore, recordTurn, recordToolResult, type MemoryStore } from "../memory/memory";
import { log } from "../logger";

interface ParsedAction {
  action: "tool" | "final";
  tool?: string;
  args?: Record<string, unknown>;
  reply?: string;
  thought?: string;
  suggestions?: unknown;
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
          // Some models omit "action" but include a tool/reply — infer it.
          if (obj?.tool) return { action: "tool", ...obj };
          if (obj?.reply) return { action: "final", ...obj };
        } catch { /* keep scanning */ }
      }
    }
  }
  return null;
}

export class Agent {
  constructor(
    private cfg: BazaBotConfig,
    private provider: AIProvider,
    private registry: ToolRegistry,
    private memory: MemoryStore = defaultMemoryStore,
  ) {}

  async run(req: AgentRequest): Promise<AgentResult> {
    const started = Date.now();
    const { message, context } = req;
    const toolCtx: ToolContext = {
      token: context.token, role: context.role, userId: context.userId, page: context.page,
    };

    // 1) Intent + language
    const intent = await detectIntent(message, context.language, this.provider);

    // 2) Assemble the conversation
    const mem = this.memory.get(context.sessionId);
    const system = buildSystemPrompt(context, this.registry, toolCtx, intent);
    // Server-side memory is the source of truth for continuity; the client's
    // history is only used to seed a brand-new session.
    const history = (mem.turns.length ? mem.turns : (req.history ?? [])).slice(-8);
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: message },
    ];

    const actions: AgentAction[] = [];
    let finalReply = "";
    let finalSuggestions: Suggestion[] = [];

    // 3) Reasoning / tool loop
    for (let step = 0; step < this.cfg.maxSteps; step++) {
      const raw = await this.provider.chat(messages, { json: true, temperature: this.cfg.temperature });
      const parsed = parseAction(raw);

      // No parseable action → treat the whole text as the answer.
      if (!parsed) { finalReply = raw; break; }

      if (parsed.action === "final") {
        finalReply = parsed.reply ?? raw;
        finalSuggestions = normalizeSuggestions(parsed.suggestions);
        break;
      }

      // Tool call
      const toolName = parsed.tool ?? "";
      const result = await this.registry.execute(toolName, parsed.args ?? {}, toolCtx);
      const tool = this.registry.get(toolName);
      actions.push({
        tool: toolName,
        explanation: tool?.explain ?? "I looked that up",
        ok: result.ok,
      });
      analytics.tool(toolName, result.ok);
      if (/knowledge|faq|help/i.test(toolName)) {
        analytics.knowledge(result.ok && Array.isArray(result.data) && result.data.length > 0);
      }
      recordToolResult(mem, result.summary);

      // Feed the observation back and let the model continue.
      messages.push({ role: "assistant", content: raw });
      messages.push({ role: "tool", name: toolName, content: `Observation from ${toolName}: ${result.summary}` });

      // Last allowed step but still no final → force a compose pass below.
      if (step === this.cfg.maxSteps - 1) {
        finalReply = await this.compose(context, intent, mem.recentToolResults);
      }
    }

    if (!finalReply) finalReply = await this.compose(context, intent, mem.recentToolResults);

    // 4) Finalise
    const reply = sanitizeReply(finalReply) ||
      "I'm not fully sure about that yet. Could you rephrase, or would you like me to connect you with a support agent?";
    recordTurn(mem, { role: "user", content: message });
    recordTurn(mem, { role: "assistant", content: reply });
    this.memory.save(mem);

    const latencyMs = Date.now() - started;
    analytics.turn("ai", intent.intent, latencyMs, false);

    return {
      reply,
      source: "ai",
      intent: intent.intent,
      lang: intent.lang,
      actions,
      suggestions: finalSuggestions,
      escalate: false,
      latencyMs,
    };
  }

  /** Produce a final answer purely from accumulated observations (no more tools). */
  private async compose(
    context: AgentRequest["context"],
    intent: DetectedIntent,
    observations: string[],
  ): Promise<string> {
    const sys = buildComposePrompt(context, intent);
    const obs = observations.length
      ? `Here is what I found:\n${observations.map(o => `- ${o}`).join("\n")}`
      : "No lookups were needed.";
    try {
      return await this.provider.chat(
        [{ role: "system", content: sys }, { role: "user", content: obs }],
        { temperature: this.cfg.temperature, json: false },
      );
    } catch (e) {
      log.warn("compose pass failed", { message: (e as Error)?.message });
      return observations[0] ?? "";
    }
  }
}
