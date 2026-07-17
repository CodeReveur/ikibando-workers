/**
 * Ollama adapter. Talks to a local Ollama server (default 127.0.0.1:11434).
 * Uses the native /api/chat and /api/embeddings endpoints.
 *
 * Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 */
import type { BazaBotConfig } from "../config";
import type { ChatMessage, ProviderChatOptions, StreamChunk } from "../types";
import { AIProvider, postJson, readLines } from "./provider";

interface OllamaChatResponse {
  message?: { role: string; content: string };
  done?: boolean;
}
interface OllamaEmbedResponse {
  embedding: number[];
}

export class OllamaProvider implements AIProvider {
  readonly id = "ollama";
  constructor(private cfg: BazaBotConfig) {}

  private opts(o?: ProviderChatOptions) {
    return {
      temperature: o?.temperature ?? this.cfg.temperature,
      num_predict: o?.maxTokens ?? this.cfg.maxTokens,
      stop: o?.stop,
    };
  }

  async chat(messages: ChatMessage[], o?: ProviderChatOptions): Promise<string> {
    const data = await postJson<OllamaChatResponse>(
      `${this.cfg.baseUrl}/api/chat`,
      {
        model: this.cfg.model,
        messages: messages.map(m => ({ role: m.role === "tool" ? "user" : m.role, content: m.content })),
        stream: false,
        format: o?.json ? "json" : undefined,
        options: this.opts(o),
      },
      { timeoutMs: this.cfg.requestTimeoutMs, signal: o?.signal }
    );
    return data.message?.content ?? "";
  }

  async *chatStream(messages: ChatMessage[], o?: ProviderChatOptions): AsyncIterable<StreamChunk> {
    const ctrl = new AbortController();
    if (o?.signal) o.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
    const timer = setTimeout(() => ctrl.abort(), this.cfg.requestTimeoutMs);
    try {
      const res = await fetch(`${this.cfg.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.cfg.model,
          messages: messages.map(m => ({ role: m.role === "tool" ? "user" : m.role, content: m.content })),
          stream: true,
          options: this.opts(o),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Ollama stream HTTP ${res.status}`);
      for await (const line of readLines(res)) {
        let json: OllamaChatResponse;
        try { json = JSON.parse(line); } catch { continue; }
        const delta = json.message?.content ?? "";
        if (delta) yield { delta, done: false };
        if (json.done) { yield { delta: "", done: true }; return; }
      }
      yield { delta: "", done: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const model = this.cfg.embeddingModel;
    if (!model) throw new Error("No embedding model configured");
    // Ollama embeds one text per call; run sequentially to stay light on RAM.
    const out: number[][] = [];
    for (const text of texts) {
      const data = await postJson<OllamaEmbedResponse>(
        `${this.cfg.baseUrl}/api/embeddings`,
        { model, prompt: text },
        { timeoutMs: this.cfg.requestTimeoutMs }
      );
      out.push(data.embedding);
    }
    return out;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.cfg.baseUrl}/api/tags`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }
}
