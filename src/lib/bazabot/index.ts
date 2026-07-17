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
import { wantsSignup, signupCard } from "./intent/routing";
import { looksKinyarwanda, requestedLanguage, type LangCode } from "./lang";
import { getKV } from "./store/kv";
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
async function streamRuleTurn(req: AgentRequest, cfg: BazaBotConfig, emit: AgentEmit, forceLang?: LangCode): Promise<AgentMeta> {
  const result = runRuleEngine(req, cfg, forceLang);
  await emitChunks(emit, result.reply);
  return metaOf(result);
}

/**
 * Resolve the effective language for a turn, with a STICKY per-session
 * preference. An explicit request ("answer in Kinyarwanda", "nsubiza mu
 * kinyarwanda") or a detected Kinyarwanda message sets the preference; it then
 * persists so every following turn keeps that language — even short questions
 * that carry no language signal of their own.
 */
async function resolveLanguage(sessionId: string, message: string, uiLang: LangCode): Promise<LangCode> {
  const kv = await getKV();
  const key = `lang:${sessionId}`;
  const stored = (await kv.getJSON<LangCode>(key)) ?? null;

  const requested = requestedLanguage(message);
  if (requested) { await kv.setJSON(key, requested, 24 * 60 * 60); return requested; }
  if (looksKinyarwanda(message)) { await kv.setJSON(key, "kinyy", 24 * 60 * 60); return "kinyy"; }
  if (stored) return stored;
  return uiLang;
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

  // Signup / get-started requests from a guest → reliable canned steps + a
  // "Sign up" CTA card, without depending on the AI (so it never falls through
  // to a generic answer). Signed-in users skip this and get a normal answer.
  if (req.context.role === "public" && wantsSignup(clean)) {
    await emitChunks(emit,
      "Getting started takes a minute — tap Sign Up, choose Worker or Employer, then enter your name, email and phone. Use the button below to sign up.");
    return {
      source: "rules", lang: req.context.language, actions: [],
      suggestions: [], results: [signupCard()], escalate: false, latencyMs: 0,
    };
  }

  // Prompt-injection guard: deflect without invoking the model at all.
  if (suspectedInjection) {
    log.warn("suspected prompt injection — deflected", { sessionId: req.context.sessionId });
    await emitChunks(emit,
      "I can only help with questions about MpahMapu — I can't change how I work. What would you like to know about the platform?");
    return { source: "rules", lang: req.context.language, actions: [], suggestions: [], escalate: false, latencyMs: 0 };
  }

  // Language gate: the AI handles English, French and Swahili well. No free
  // hosted model reliably produces Kinyarwanda (they drift into Swahili and mix
  // languages), so Kinyarwanda goes to the curated rule engine — pure, unmixed
  // Kinyarwanda. The preference is sticky per session (see resolveLanguage), so
  // "answer in Kinyarwanda only" keeps working on later turns too. Override with
  // BAZABOT_AI_ALL_LANGS=true to force the AI for every language.
  const aiAllLangs = /^(1|true|yes|on)$/i.test(process.env.BAZABOT_AI_ALL_LANGS ?? "");
  const effectiveLang = await resolveLanguage(req.context.sessionId, clean, req.context.language as LangCode);
  const useKinyarwanda = !aiAllLangs && effectiveLang === "kinyy";

  // AI mode when configured + not a Kinyarwanda turn; otherwise the rule engine.
  if (isAiConfigured(cfg) && !useKinyarwanda) {
    try {
      return await getAgent(cfg).runStream(safeReq, emit);
    } catch (e) {
      log.error("AI agent failed, falling back to rules", { message: (e as Error)?.message });
      void analytics.fallback();
      return streamRuleTurn(safeReq, cfg, emit);
    }
  }

  void analytics.fallback();
  return streamRuleTurn(safeReq, cfg, emit, useKinyarwanda ? "kinyy" : undefined);
}

/** Non-streaming convenience entry (collects the stream). */
export async function runAgent(req: AgentRequest): Promise<AgentResult> {
  let reply = "";
  const meta = await runAgentStream(req, (ev, data) => { if (ev === "delta") reply += data.text ?? ""; });
  return { reply, ...meta };
}
