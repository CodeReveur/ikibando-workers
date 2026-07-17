/**
 * Provider factory. Selects the inference adapter from config so the rest of the
 * agent stays engine-agnostic. Add a new engine by implementing AIProvider and
 * registering it here — nothing else changes.
 */
import type { BazaBotConfig } from "../config";
import type { AIProvider } from "./provider";
import { OllamaProvider } from "./ollama";
import { LlamaCppProvider } from "./llamacpp";
import { OpenAICompatProvider } from "./openai-compat";

export type { AIProvider } from "./provider";

export function createProvider(cfg: BazaBotConfig): AIProvider {
  switch (cfg.engine) {
    case "ollama": return new OllamaProvider(cfg);
    case "llamacpp": return new LlamaCppProvider(cfg);
    case "openai-compat": return new OpenAICompatProvider(cfg);
    default: return new OllamaProvider(cfg);
  }
}
