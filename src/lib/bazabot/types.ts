/**
 * Shared BazaBot domain types. Kept dependency-free so every module can import
 * them without creating cycles.
 */

export type Lang = "en" | "fr" | "sw" | "kinyy";
export type Role = "owner" | "seeker" | "public";
export type ChatRole = "system" | "user" | "assistant" | "tool";

/** A single message in a model-facing conversation. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Present on tool result messages - which tool produced this. */
  name?: string;
}

/** What the client tells the agent about the current session. */
export interface AgentContext {
  /** The signed-in user's access token, if any. Enables authenticated tools. */
  token?: string;
  /** owner = employer, seeker = worker, public = guest. */
  role: Role;
  /** Display name, for a warm greeting. */
  userName?: string;
  /** Stable session key for memory + rate limiting. */
  sessionId: string;
  /** The route the user is currently on, e.g. "/owner/wallet". */
  page?: string;
  /** UI language; the reply language is auto-detected but defaults to this. */
  language: Lang;
  /** User id, if known. */
  userId?: string;
}

/** A user turn plus the resolved context. */
export interface AgentRequest {
  message: string;
  context: AgentContext;
  /** Prior turns supplied by the client (source of truth for history). */
  history?: ChatMessage[];
}

/** One structured explanation of an action the agent took (user-safe). */
export interface AgentAction {
  /** Tool that ran, e.g. "searchJobs". */
  tool: string;
  /** Human-readable, no internals leaked, e.g. "I searched available jobs". */
  explanation: string;
  /** Whether the tool call succeeded. */
  ok: boolean;
}

/** A contextual next-step the UI can render as a chip. */
export interface Suggestion {
  label: string;
  /** The message to send when the chip is tapped. */
  query: string;
}

/** The final result the route returns to the client. */
export interface AgentResult {
  /** The user-facing reply (markdown allowed). */
  reply: string;
  /** Which engine produced it - for analytics + UI badges. */
  source: "ai" | "rules" | "knowledge" | "escalation";
  /** Detected intent, if classified. */
  intent?: string;
  /** Reply language actually used. */
  lang: Lang;
  /** Safe, concise explanations of what the agent did. */
  actions: AgentAction[];
  /** Contextual follow-up suggestions. */
  suggestions: Suggestion[];
  /** Actionable job/worker cards to render with CTA buttons. */
  results?: ResultCard[];
  /** True when the agent could not help and a human should take over. */
  escalate: boolean;
  /** Server-measured latency, ms. */
  latencyMs: number;
}

/** An actionable card the UI renders with a call-to-action button + real link. */
export interface ResultCard {
  kind: "job" | "worker" | "action";
  id: string;
  title: string;
  /** e.g. "Electrical · Gasabo". */
  subtitle?: string;
  /** e.g. "18,000 RWF" or "4.8★". */
  meta?: string;
  /** In-app route, e.g. "/jobs/123". */
  url: string;
  /** Button label, e.g. "View job". */
  cta: string;
}

/** Everything about a finished turn except the reply body (streamed separately). */
export interface AgentMeta {
  source: "ai" | "rules" | "knowledge" | "escalation";
  intent?: string;
  lang: Lang;
  actions: AgentAction[];
  suggestions: Suggestion[];
  /** Actionable job/worker cards to render with CTA buttons. */
  results?: ResultCard[];
  escalate: boolean;
  latencyMs: number;
}

/** Streaming event kinds emitted during a turn. */
export type AgentEventName = "status" | "delta" | "action" | "done" | "error";

/** Sink the agent pushes streaming events to (wired to SSE by the route). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentEmit = (event: AgentEventName, data: any) => void;

/** Options passed to a provider chat call. */
export interface ProviderChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider to bias toward JSON output when supported. */
  json?: boolean;
  /** Stop sequences. */
  stop?: string[];
  signal?: AbortSignal;
}

/** A streamed token chunk. */
export interface StreamChunk {
  delta: string;
  done: boolean;
}
