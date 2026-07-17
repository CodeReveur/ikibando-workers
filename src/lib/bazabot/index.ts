/**
 * BazaBot public entry point.
 *
 * `runAgentStream` is the single function the route handler calls. It decides
 * between:
 *   - AI mode: full reasoning + tool-calling agent with true token streaming
 *     (when a model is configured and reachable), and
 *   - Rule mode: the legacy multilingual intent + knowledge engine, streamed in
 *     chunks, used as a transparent fallback so the widget never breaks.
 *
 * Everything is assembled here via light dependency injection; individual
 * modules stay independently replaceable.
 */
import { loadConfig, isAiConfigured, type BazaBotConfig } from "./config";
import { createProvider, type AIProvider } from "./providers";
import { buildRegistry } from "./tools";
import { KnowledgeSearcher } from "./knowledge/knowledge";
import { Agent } from "./agent/agent";
import { runRuleEngine } from "./fallback";
import { sanitizeInput, checkRateLimit } from "./security/guard";
import { wantsHuman } from "./escalation";
import { looksKinyarwanda } from "./lang";
import { analytics } from "./analytics/analytics";
import { log } from "./logger";
import type { AgentEmit, AgentMeta, AgentRequest, AgentResult } from "./types";

export type { AgentRequest, AgentResult, AgentMeta, AgentEmit } from "./types";
export { analytics } from "./analytics/analytics";
export { loadConfig, isAiConfigured } from "./config";

/** Cached singletons keyed by the resolved config signature. */
let cached: { key: string; provider: AIProvider; agent: Agent } | null = null;

function getAgent(cfg: BazaBotConfig): Agent {
  const key = `${cfg.engine}|${cfg.baseUrl}|${cfg.model}|${cfg.embeddingModel ?? ""}`;
  if (cached && cached.key === key) return cached.agent;

  const provider = createProvider(cfg);
  const searcher = new KnowledgeSearcher(cfg, provider);
  const registry = buildRegistry({
    searchKnowledge: (q, limit) => searcher.search(q, limit).then(hits =>
      hits.map(h => ({ title: h.title, text: h.text, score: h.score }))),
  });
  const agent = new Agent(cfg, provider, registry);
  cached = { key, provider, agent };
  log.info("BazaBot agent initialised", { engine: cfg.engine, model: cfg.model, tools: registry.size });
  return agent;
}

/** Emit a text as small delta chunks for a live typing feel (rule mode only). */
async function emitChunks(emit: AgentEmit, text: string): Promise<void> {
  const parts = text.split(/(\s+)/);
  let buffer = "";
  for (const p of parts) {
    buffer += p;
    if (buffer.length >= 12) {
      emit("delta", { text: buffer });
      buffer = "";
      await new Promise(r => setTimeout(r, 12));
    }
  }
  if (buffer) emit("delta", { text: buffer });
}

function metaOf(r: AgentResult): AgentMeta {
  return {
    source: r.source, intent: r.intent, lang: r.lang,
    actions: r.actions, suggestions: r.suggestions, escalate: r.escalate, latencyMs: r.latencyMs,
  };
}

/** Stream one rule-engine turn (used as fallback + when AI is off). */
async function streamRuleTurn(req: AgentRequest, cfg: BazaBotConfig, emit: AgentEmit): Promise<AgentMeta> {
  const result = runRuleEngine(req, cfg);
  await emitChunks(emit, result.reply);
  return metaOf(result);
}

/**
 * Run one user turn with streaming. Never throws — always resolves to turn
 * metadata, degrading to the rule engine on any failure.
 */
export async function runAgentStream(req: AgentRequest, emit: AgentEmit): Promise<AgentMeta> {
  const cfg = loadConfig();

  // Rate limit per session.
  if (!checkRateLimit(req.context.sessionId, cfg.rateLimitPerMinute)) {
    await emitChunks(emit, "You're sending messages a bit fast — give me a moment and try again. 🙂");
    return { source: "rules", lang: req.context.language, actions: [], suggestions: [], escalate: false, latencyMs: 0 };
  }

  // Sanitize input.
  const { clean, suspectedInjection } = sanitizeInput(req.message);
  const safeReq: AgentRequest = { ...req, message: clean };
  if (!clean) {
    await emitChunks(emit, "Did you want to ask me something? I'm here to help.");
    return { source: "rules", lang: req.context.language, actions: [], suggestions: [], escalate: false, latencyMs: 0 };
  }

  // Explicit request for a human → escalate immediately (no model call). The UI
  // collects the user's name + email and creates the contact for the live agent.
  if (wantsHuman(clean)) {
    await emitChunks(emit, "Connecting you with a live agent…");
    return { source: "escalation", lang: req.context.language, actions: [], suggestions: [], escalate: true, latencyMs: 0 };
  }

  // Prompt-injection guard: deflect without invoking the model at all.
  if (suspectedInjection) {
    log.warn("suspected prompt injection — deflected", { sessionId: req.context.sessionId });
    await emitChunks(emit,
      "I can only help with questions about MpahMapu — I can't change how I work. What would you like to know about the platform?");
    return { source: "rules", lang: req.context.language, actions: [], suggestions: [], escalate: false, latencyMs: 0 };
  }

  // Language gate: the AI handles English, French and Swahili well. No free
  // hosted model reliably produces Kinyarwanda (they drift to Swahili), so
  // Kinyarwanda turns go to the curated rule engine with real Kinyarwanda
  // answers. Override with BAZABOT_AI_ALL_LANGS=true to force AI for every
  // language once your model handles Kinyarwanda acceptably.
  const aiAllLangs = /^(1|true|yes|on)$/i.test(process.env.BAZABOT_AI_ALL_LANGS ?? "");
  const languageOk = aiAllLangs || !looksKinyarwanda(clean);

  // AI mode when configured + language supported; otherwise fall back.
  if (isAiConfigured(cfg) && languageOk) {
    try {
      return await getAgent(cfg).runStream(safeReq, emit);
    } catch (e) {
      log.error("AI agent failed, falling back to rules", { message: (e as Error)?.message });
      void analytics.fallback();
      return streamRuleTurn(safeReq, cfg, emit);
    }
  }

  void analytics.fallback();
  return streamRuleTurn(safeReq, cfg, emit);
}

/** Non-streaming convenience entry (collects the stream). */
export async function runAgent(req: AgentRequest): Promise<AgentResult> {
  let reply = "";
  const meta = await runAgentStream(req, (ev, data) => { if (ev === "delta") reply += data.text ?? ""; });
  return { reply, ...meta };
}
