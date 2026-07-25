/**
 * Tool contract. Every backend capability the agent may use is a Tool: a named,
 * described, validated, permission-gated function. The model selects tools by
 * name; it never touches the backend directly.
 */
import type { z } from "zod";
import type { Role, ResultCard } from "../types";

/** Ambient info a tool needs to act on the caller's behalf. */
export interface ToolContext {
  /** Access token for authenticated backend calls. */
  token?: string;
  role: Role;
  userId?: string;
  /** Current page path, for context-aware defaults. */
  page?: string;
}

/** Normalised outcome of running a tool. `summary` is model-facing (no secrets). */
export interface ToolResult {
  ok: boolean;
  /** Compact natural-language summary the model reasons over. */
  summary: string;
  /** Structured payload, already trimmed to what's useful. */
  data?: unknown;
  /** Actionable cards (jobs/workers) the UI renders with CTA buttons. */
  cards?: ResultCard[];
  /** Present when ok === false. */
  error?: string;
}

/** A single parameter, for prompt display. Validation lives in `schema`. */
export interface ToolParam {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Tool<A = any> {
  /** camelCase identifier the model calls, e.g. "searchJobs". */
  name: string;
  /** One line telling the model when to use it. */
  description: string;
  /** Displayed parameter list (for the system prompt). */
  params: ToolParam[];
  /** Zod schema that validates + coerces args before execution. */
  schema: z.ZodType<A>;
  /** Requires a signed-in user. Gated when no token is present. */
  requiresAuth: boolean;
  /** Roles allowed to call it. Empty/undefined = everyone. */
  roles?: Role[];
  /** User-safe explanation template, e.g. "I searched available jobs". */
  explain: string;
  /** Runs the tool. Must never throw for expected failures - return ok:false. */
  execute(args: A, ctx: ToolContext): Promise<ToolResult>;
}
