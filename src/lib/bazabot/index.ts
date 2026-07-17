/**
 * BazaBot public entry point.
 *
 * `runAgent` is the single function the route handler calls. It decides between:
 *   - AI mode: full reasoning + tool-calling agent (when a model is configured
 *     and the inference server is reachable), and
 *   - Rule mode: the legacy multilingual intent + knowledge engine, used as a
 *     transparent fallback so the widget never breaks when no model is present.
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
import { analytics } from "./analytics/analytics";
import { log } from "./logger";
import type { AgentRequest, AgentResult } from "./types";

export type { AgentRequest, AgentResult } from "./types";
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

/**
 * Run one user turn. Never throws — always returns an AgentResult the UI can
 * render, degrading to the rule engine on any failure.
 */
export async function runAgent(req: AgentRequest): Promise<AgentResult> {
  const cfg = loadConfig();

  // Rate limit per session.
  if (!checkRateLimit(req.context.sessionId, cfg.rateLimitPerMinute)) {
    return ruleResult(req, "You're sending messages a bit fast — give me a moment and try again. 🙂");
  }

  // Sanitize input.
  const { clean, suspectedInjection } = sanitizeInput(req.message);
  if (suspectedInjection) log.warn("suspected prompt injection", { sessionId: req.context.sessionId });
  const safeReq: AgentRequest = { ...req, message: clean };
  if (!clean) return ruleResult(safeReq, "Did you want to ask me something? I'm here to help.");

  // AI mode when configured + reachable; otherwise fall back.
  if (isAiConfigured(cfg)) {
    try {
      const agent = getAgent(cfg);
      return await agent.run(safeReq);
    } catch (e) {
      log.error("AI agent failed, falling back to rules", { message: (e as Error)?.message });
      analytics.fallback();
      return runRuleEngine(safeReq, cfg);
    }
  }

  analytics.fallback();
  return runRuleEngine(safeReq, cfg);
}

/** Small helper for early-return rule replies. */
function ruleResult(req: AgentRequest, reply: string): AgentResult {
  return {
    reply, source: "rules", lang: req.context.language,
    actions: [], suggestions: [], escalate: false, latencyMs: 0,
  };
}
