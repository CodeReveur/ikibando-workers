/**
 * BazaBot runtime configuration.
 *
 * Every value is read from *server-only* environment variables (NOT the
 * NEXT_PUBLIC_* space, which Next.js inlines at build time). These are read
 * live inside Route Handlers, so the model, engine and endpoints can be changed
 * by editing the host's environment and restarting — no rebuild, no code change.
 *
 * The model is never hardcoded. If nothing is configured the agent degrades
 * gracefully to the legacy rule-based engine (see `lib/bazabot/index.ts`).
 */

export type InferenceEngine = "groq" | "openai-compat" | "ollama" | "llamacpp";

/** Engines that call a hosted HTTPS API and therefore require an API key. */
const HOSTED_ENGINES: InferenceEngine[] = ["groq", "openai-compat"];

export interface BazaBotConfig {
  /** Whether AI mode is enabled at all. When false, the rule engine is used. */
  enabled: boolean;
  /** Which local inference adapter to use. */
  engine: InferenceEngine;
  /** Base URL of the inference server. */
  baseUrl: string;
  /** Optional bearer key for OpenAI-compatible servers. */
  apiKey?: string;
  /** Chat/instruct model id. Swappable — never assume a specific model. */
  model: string;
  /** Embedding model id (optional; enables semantic knowledge search). */
  embeddingModel?: string;
  /** Sampling temperature. */
  temperature: number;
  /** Hard cap on generated tokens per turn. */
  maxTokens: number;
  /** Max reasoning/tool-call iterations before the agent must answer. */
  maxSteps: number;
  /**
   * Let the model drive extra tool calls on top of deterministic intent routing.
   * Off by default: small models pick tools unreliably, and intent routing
   * already grounds the answer. Turn on for larger, tool-capable models.
   */
  modelToolLoop: boolean;
  /** Per-request timeout to the inference server, ms. */
  requestTimeoutMs: number;
  /** Whether semantic (embedding) knowledge search is allowed. */
  semanticSearch: boolean;
  /** Rate limit: max messages per session per window. */
  rateLimitPerMinute: number;
  /** Backend base URL the tools call (mirrors api.ts). */
  backendUrl: string;
  /** Verbose server-side logging. */
  debug: boolean;
}

function envStr(key: string, fallback = ""): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}
function envNum(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) ? v : fallback;
}
function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

/** Build the active config from the environment. Cheap; safe to call per request. */
export function loadConfig(): BazaBotConfig {
  const engine = envStr("BAZABOT_ENGINE", "groq") as InferenceEngine;

  // Sensible per-engine default base URLs so a bare setup "just works".
  const defaultBase =
    engine === "groq" ? "https://api.groq.com/openai/v1" :
    engine === "ollama" ? "http://127.0.0.1:11434" :
    engine === "llamacpp" ? "http://127.0.0.1:8080" :
    "http://127.0.0.1:8000/v1";

  // Default model per engine. Never hardcoded elsewhere — overridable via env.
  const defaultModel = engine === "groq" ? "llama-3.1-8b-instant" : "";
  const model = envStr("BAZABOT_MODEL", defaultModel);

  // Hosted engines read a key from BAZABOT_API_KEY or the conventional GROQ_API_KEY.
  const apiKey = envStr("BAZABOT_API_KEY") || envStr("GROQ_API_KEY") || undefined;

  return {
    // AI mode turns on when a model is named AND not explicitly disabled.
    enabled: envBool("BAZABOT_ENABLED", model.length > 0),
    engine,
    baseUrl: envStr("BAZABOT_BASE_URL", defaultBase).replace(/\/+$/, ""),
    apiKey,
    model,
    embeddingModel: envStr("BAZABOT_EMBEDDING_MODEL") || undefined,
    temperature: envNum("BAZABOT_TEMPERATURE", 0.3),
    maxTokens: envNum("BAZABOT_MAX_TOKENS", 512),
    maxSteps: envNum("BAZABOT_MAX_STEPS", 3),
    modelToolLoop: envBool("BAZABOT_MODEL_TOOL_LOOP", false),
    requestTimeoutMs: envNum("BAZABOT_TIMEOUT_MS", 30000),
    // Off by default: the default (Groq) has no embeddings API, and keyword
    // search is strong for the curated FAQ. Enable with a real embedding engine.
    semanticSearch: envBool("BAZABOT_SEMANTIC_SEARCH", false),
    rateLimitPerMinute: envNum("BAZABOT_RATE_LIMIT", 20),
    backendUrl: envStr("NEXT_PUBLIC_API_URL", "http://localhost:8088").replace(/\/+$/, ""),
    debug: envBool("BAZABOT_DEBUG", false),
  };
}

/** True when the config has enough to attempt AI inference. */
export function isAiConfigured(cfg: BazaBotConfig): boolean {
  if (!cfg.enabled || cfg.model.length === 0) return false;
  // Hosted engines need an API key; local engines need a base URL.
  if (HOSTED_ENGINES.includes(cfg.engine)) return !!cfg.apiKey;
  return cfg.baseUrl.length > 0;
}
