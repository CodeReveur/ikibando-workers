/**
 * OpenAI-compatible adapter. Works with any server that speaks the
 * /v1/chat/completions + /v1/embeddings API — llama.cpp's `--api`, LM Studio,
 * vLLM, text-generation-webui, LocalAI, etc. This makes "plug in another engine
 * later" a config change, not a code change.
 */
import type { BazaBotConfig } from "../config";
import type { ChatMessage, ProviderChatOptions, StreamChunk } from "../types";
import { AIProvider, postJson, readLines } from "./provider";

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
}
interface EmbedResponse {
  data?: Array<{ embedding: number[] }>;
}

export class OpenAICompatProvider implements AIProvider {
  readonly id = "openai-compat";
  constructor(private cfg: BazaBotConfig) {}

  private headers(): Record<string, string> {
    return this.cfg.apiKey ? { authorization: `Bearer ${this.cfg.apiKey}` } : {};
  }

  private body(messages: ChatMessage[], o?: ProviderChatOptions, stream = false) {
    return {
      model: this.cfg.model,
      messages: messages.map(m => ({
        role: m.role === "tool" ? "user" : m.role,
        content: m.content,
      })),
      temperature: o?.temperature ?? this.cfg.temperature,
      max_tokens: o?.maxTokens ?? this.cfg.maxTokens,
      stop: o?.stop,
      stream,
      ...(o?.json ? { response_format: { type: "json_object" } } : {}),
    };
  }

  async chat(messages: ChatMessage[], o?: ProviderChatOptions): Promise<string> {
    const data = await postJson<ChatCompletion>(
      `${this.cfg.baseUrl}/chat/completions`,
      this.body(messages, o),
      { timeoutMs: this.cfg.requestTimeoutMs, headers: this.headers(), signal: o?.signal }
    );
    return data.choices?.[0]?.message?.content ?? "";
  }

  async *chatStream(messages: ChatMessage[], o?: ProviderChatOptions): AsyncIterable<StreamChunk> {
    const ctrl = new AbortController();
    if (o?.signal) o.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
    const timer = setTimeout(() => ctrl.abort(), this.cfg.requestTimeoutMs);
    try {
      const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.headers() },
        body: JSON.stringify(this.body(messages, o, true)),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`OpenAI-compat stream HTTP ${res.status}`);
      for await (const line of readLines(res)) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") { yield { delta: "", done: true }; return; }
        let json: ChatCompletion;
        try { json = JSON.parse(payload); } catch { continue; }
        const delta = json.choices?.[0]?.delta?.content ?? "";
        if (delta) yield { delta, done: false };
      }
      yield { delta: "", done: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.cfg.embeddingModel) throw new Error("No embedding model configured");
    const data = await postJson<EmbedResponse>(
      `${this.cfg.baseUrl}/embeddings`,
      { model: this.cfg.embeddingModel, input: texts },
      { timeoutMs: this.cfg.requestTimeoutMs, headers: this.headers() }
    );
    return (data.data ?? []).map(d => d.embedding);
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.cfg.baseUrl}/models`, { headers: this.headers() });
      return res.ok;
    } catch {
      return false;
    }
  }
}
