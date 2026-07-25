/**
 * The inference adapter contract.
 *
 * Every engine (Ollama, llama.cpp, an OpenAI-compatible server, …) implements
 * this same shape, so the rest of the agent never knows which one is running.
 * Swap engines by changing config alone - see providers/index.ts.
 */
import type { ChatMessage, ProviderChatOptions, StreamChunk } from "../types";

export interface AIProvider {
  /** Stable id, e.g. "ollama". */
  readonly id: string;

  /** One-shot completion. Returns the assistant text. */
  chat(messages: ChatMessage[], opts?: ProviderChatOptions): Promise<string>;

  /** Streaming completion. Yields deltas until `done`. */
  chatStream(messages: ChatMessage[], opts?: ProviderChatOptions): AsyncIterable<StreamChunk>;

  /** Embed one or more texts. Returns one vector per input. Throws if unsupported. */
  embed(texts: string[]): Promise<number[][]>;

  /** Cheap liveness probe. Resolves true when the server is reachable. */
  health(): Promise<boolean>;
}

/** Shared fetch helper with timeout + JSON parsing, used by all adapters. */
export async function postJson<T>(
  url: string,
  body: unknown,
  opts: { timeoutMs: number; headers?: Record<string, string>; signal?: AbortSignal }
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  // Chain an external abort signal into ours if provided.
  if (opts.signal) opts.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Iterate an SSE / newline-delimited-JSON stream line by line. */
export async function* readLines(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) yield line;
      }
    }
    if (buffer.trim()) yield buffer.trim();
  } finally {
    reader.releaseLock();
  }
}
