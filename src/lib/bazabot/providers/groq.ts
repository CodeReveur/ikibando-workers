/**
 * Groq adapter - the default, Vercel-friendly provider.
 *
 * Uses the official `groq-sdk` library to call Groq's hosted inference over
 * HTTPS. This runs anywhere a Node serverless function runs (Vercel included) -
 * no local binary, no long-running server. The models are open-source
 * (Llama 3.x, Qwen, Gemma) and the free tier needs only an API key (no card).
 *
 * Groq has no embeddings endpoint, so semantic search should stay on keyword
 * mode (default) unless you configure a separate embedding provider.
 */
import Groq from "groq-sdk";
import type { BazaBotConfig } from "../config";
import type { ChatMessage, ProviderChatOptions, StreamChunk } from "../types";
import type { AIProvider } from "./provider";

/** Groq accepts the standard chat roles; map our "tool" role to "user". */
function toGroqMessages(messages: ChatMessage[]) {
  return messages.map(m => ({
    role: (m.role === "tool" ? "user" : m.role) as "system" | "user" | "assistant",
    content: m.content,
  }));
}

export class GroqProvider implements AIProvider {
  readonly id = "groq";
  private client: Groq;

  constructor(private cfg: BazaBotConfig) {
    this.client = new Groq({
      apiKey: cfg.apiKey ?? "",
      // baseUrl is optional; honour an override if one was set.
      ...(cfg.baseUrl && !/api\.groq\.com/.test(cfg.baseUrl) ? { baseURL: cfg.baseUrl } : {}),
      timeout: cfg.requestTimeoutMs,
      maxRetries: 1,
    });
  }

  async chat(messages: ChatMessage[], o?: ProviderChatOptions): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.cfg.model,
      messages: toGroqMessages(messages),
      temperature: o?.temperature ?? this.cfg.temperature,
      max_tokens: o?.maxTokens ?? this.cfg.maxTokens,
      stop: o?.stop,
      ...(o?.json ? { response_format: { type: "json_object" } } : {}),
    }, { signal: o?.signal });
    return res.choices?.[0]?.message?.content ?? "";
  }

  async *chatStream(messages: ChatMessage[], o?: ProviderChatOptions): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.cfg.model,
      messages: toGroqMessages(messages),
      temperature: o?.temperature ?? this.cfg.temperature,
      max_tokens: o?.maxTokens ?? this.cfg.maxTokens,
      stop: o?.stop,
      stream: true,
    }, { signal: o?.signal });

    for await (const part of stream) {
      const delta = part.choices?.[0]?.delta?.content ?? "";
      if (delta) yield { delta, done: false };
    }
    yield { delta: "", done: true };
  }

  async embed(): Promise<number[][]> {
    throw new Error("Groq does not provide embeddings; use keyword search or a separate embedding provider");
  }

  async health(): Promise<boolean> {
    if (!this.cfg.apiKey) return false;
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
