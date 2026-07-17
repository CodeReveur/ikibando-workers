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

export type InferenceEngine = "ollama" | "llamacpp" | "openai-compat";

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
  const engine = envStr("BAZABOT_ENGINE", "ollama") as InferenceEngine;

  // Sensible per-engine default base URLs so a bare install "just works".
  const defaultBase =
    engine === "ollama" ? "http://127.0.0.1:11434" :
    engine === "llamacpp" ? "http://127.0.0.1:8080" :
    "http://127.0.0.1:8000/v1";

  const model = envStr("BAZABOT_MODEL"); // e.g. "qwen2.5:0.5b-instruct"

  return {
    // AI mode turns on only when a model is named AND not explicitly disabled.
    enabled: envBool("BAZABOT_ENABLED", model.length > 0),
    engine,
    baseUrl: envStr("BAZABOT_BASE_URL", defaultBase).replace(/\/+$/, ""),
    apiKey: envStr("BAZABOT_API_KEY") || undefined,
    model,
    embeddingModel: envStr("BAZABOT_EMBEDDING_MODEL") || undefined,
    temperature: envNum("BAZABOT_TEMPERATURE", 0.3),
    maxTokens: envNum("BAZABOT_MAX_TOKENS", 512),
    maxSteps: envNum("BAZABOT_MAX_STEPS", 3),
    requestTimeoutMs: envNum("BAZABOT_TIMEOUT_MS", 30000),
    semanticSearch: envBool("BAZABOT_SEMANTIC_SEARCH", true),
    rateLimitPerMinute: envNum("BAZABOT_RATE_LIMIT", 20),
    backendUrl: envStr("NEXT_PUBLIC_API_URL", "http://localhost:8088").replace(/\/+$/, ""),
    debug: envBool("BAZABOT_DEBUG", false),
  };
}

/** True when the config has enough to attempt AI inference. */
export function isAiConfigured(cfg: BazaBotConfig): boolean {
  return cfg.enabled && cfg.model.length > 0 && cfg.baseUrl.length > 0;
}
