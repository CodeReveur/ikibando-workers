/**
 * llama.cpp native adapter. Targets the server's native /completion and
 * /embedding endpoints (default 127.0.0.1:8080).
 *
 * llama.cpp also exposes an OpenAI-compatible API at /v1 — if you prefer that,
 * set BAZABOT_ENGINE=openai-compat and BAZABOT_BASE_URL=http://host:8080/v1.
 * This native adapter renders messages with the ChatML template, which the
 * recommended lightweight instruct models (Qwen2.5, SmolLM2) understand.
 */
import type { BazaBotConfig } from "../config";
import type { ChatMessage, ProviderChatOptions, StreamChunk } from "../types";
import { AIProvider, postJson, readLines } from "./provider";

interface CompletionResponse { content?: string; }
interface EmbeddingResponse { embedding?: number[]; }

/** Render a chat transcript as a ChatML prompt. */
function toChatML(messages: ChatMessage[]): string {
  const parts = messages.map(m => {
    const role = m.role === "tool" ? "user" : m.role;
    return `<|im_start|>${role}\n${m.content}<|im_end|>`;
  });
  parts.push("<|im_start|>assistant\n");
  return parts.join("\n");
}

export class LlamaCppProvider implements AIProvider {
  readonly id = "llamacpp";
  constructor(private cfg: BazaBotConfig) {}

  private body(messages: ChatMessage[], o?: ProviderChatOptions, stream = false) {
    return {
      prompt: toChatML(messages),
      temperature: o?.temperature ?? this.cfg.temperature,
      n_predict: o?.maxTokens ?? this.cfg.maxTokens,
      stop: [...(o?.stop ?? []), "<|im_end|>", "<|im_start|>"],
      stream,
    };
  }

  async chat(messages: ChatMessage[], o?: ProviderChatOptions): Promise<string> {
    const data = await postJson<CompletionResponse>(
      `${this.cfg.baseUrl}/completion`,
      this.body(messages, o),
      { timeoutMs: this.cfg.requestTimeoutMs, signal: o?.signal }
    );
    return (data.content ?? "").trim();
  }

  async *chatStream(messages: ChatMessage[], o?: ProviderChatOptions): AsyncIterable<StreamChunk> {
    const ctrl = new AbortController();
    if (o?.signal) o.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
    const timer = setTimeout(() => ctrl.abort(), this.cfg.requestTimeoutMs);
    try {
      const res = await fetch(`${this.cfg.baseUrl}/completion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(this.body(messages, o, true)),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`llama.cpp stream HTTP ${res.status}`);
      for await (const line of readLines(res)) {
        // llama.cpp streams SSE: "data: {json}"
        const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
        let json: CompletionResponse & { stop?: boolean };
        try { json = JSON.parse(payload); } catch { continue; }
        if (json.content) yield { delta: json.content, done: false };
        if (json.stop) { yield { delta: "", done: true }; return; }
      }
      yield { delta: "", done: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const text of texts) {
      const data = await postJson<EmbeddingResponse>(
        `${this.cfg.baseUrl}/embedding`,
        { content: text },
        { timeoutMs: this.cfg.requestTimeoutMs }
      );
      if (!data.embedding) throw new Error("llama.cpp returned no embedding (start server with --embedding)");
      out.push(data.embedding);
    }
    return out;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.cfg.baseUrl}/health`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }
}
