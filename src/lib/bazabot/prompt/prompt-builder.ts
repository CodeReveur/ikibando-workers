/**
 * Prompt builder. Assembles the system prompt from: persona + rules, the live
 * tool catalogue, the session context (page, role, user, language), and the
 * strict action protocol the reasoning loop parses.
 *
 * The action protocol is JSON-only because lightweight models are far more
 * reliable emitting a single small JSON object than free-form function calls.
 */
import type { AgentContext } from "../types";
import type { ToolRegistry } from "../tools";
import type { DetectedIntent } from "../intent/intent";
import type { ToolContext } from "../tools/types";

const LANG_NAME: Record<string, string> = {
  en: "English", fr: "French", sw: "Swahili", kinyy: "Kinyarwanda",
};

const PERSONA = `You are BazaBot, the friendly assistant for MpahMapu — Rwanda's on-demand workforce platform where employers hire verified workers (cleaning, security, events, driving and more) and workers find paid gigs.

Behave like a helpful, concise human agent. You:
- Never invent platform data. If a tool can fetch it, call the tool.
- Never expose internal tool names, raw JSON, code, or errors to the user.
- Keep answers short, warm and professional. Use simple markdown (bold, short lists) when it helps.
- If a request is ambiguous, ask ONE brief clarifying question instead of guessing.
- Reply in the user's language.`;

const PROTOCOL = `RESPONSE PROTOCOL — reply with exactly ONE minified JSON object, nothing else:
- To use a tool:   {"action":"tool","tool":"<name>","args":{...},"thought":"<why, one short line>"}
- To answer:       {"action":"final","reply":"<message to the user>","suggestions":["...","..."]}
Rules:
- Prefer a tool when the user asks about their data or live platform info.
- After you receive a tool result, either call another tool or produce the final answer.
- "suggestions" (optional, max 3) are short follow-up questions the user might tap next.
- Output JSON only. No prose, no markdown fences around the JSON.`;

export function buildContextBlock(ctx: AgentContext, intent?: DetectedIntent): string {
  const lines: string[] = [];
  lines.push(`User role: ${ctx.role === "owner" ? "employer" : ctx.role === "seeker" ? "worker" : "guest (not signed in)"}`);
  if (ctx.userName) lines.push(`User name: ${ctx.userName}`);
  lines.push(`Signed in: ${ctx.token ? "yes" : "no"}`);
  if (ctx.page) lines.push(`Current page: ${ctx.page}`);
  // Soft hint only — the reliable signal is the language of the user's actual
  // message, so we never hard-assert a reply language that detection may get
  // wrong (e.g. Kinyarwanda sentences full of English loanwords).
  lines.push(`User's app language: ${LANG_NAME[ctx.language] ?? "English"} (but always reply in the language of their latest message).`);
  if (intent && intent.intent !== "unknown") {
    lines.push(`Detected intent: ${intent.intent}`);
    const slots = Object.entries(intent.params);
    if (slots.length) lines.push(`Extracted details: ${slots.map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  return lines.join("\n");
}

/** The full system prompt for the reasoning loop. */
export function buildSystemPrompt(
  ctx: AgentContext,
  registry: ToolRegistry,
  toolCtx: ToolContext,
  intent?: DetectedIntent,
): string {
  const tools = registry.describe(toolCtx);
  return [
    PERSONA,
    "",
    "CONTEXT:\n" + buildContextBlock(ctx, intent),
    "",
    "AVAILABLE TOOLS:\n" + (tools || "(none available for this user)"),
    "",
    PROTOCOL,
  ].join("\n");
}

/** A lighter prompt for the final phrasing pass (no tool protocol). */
export function buildComposePrompt(ctx: AgentContext, intent?: DetectedIntent): string {
  return [
    PERSONA,
    "",
    "CONTEXT:\n" + buildContextBlock(ctx, intent),
    "",
    "CONVERSATION RULES:",
    "- This is an ONGOING chat and the user was already greeted. Do NOT open with 'Hello', 'Hi', 'Hey', the user's name, or any greeting. Get straight to the answer.",
    "- LANGUAGE: reply in the SAME language the user wrote their question in (English, French, Swahili or Kinyarwanda). Match their language exactly; do not switch to English if they wrote in another language.",
    "",
    "GROUNDING RULES:",
    "- For specific facts (fees, numbers, names, counts, dates, balances), use ONLY the retrieved information. Never invent or alter them.",
    "- You MAY explain general platform concepts (how escrow/hiring/verification works) from the platform description above, even without retrieved data.",
    "- Only if the question needs specific data you don't have, say you're not certain and offer a support agent. Never refuse a normal platform question.",
    "- Explain naturally in your own words; don't dump raw data or use unrelated analogies.",
    "",
    "Write the reply to the user now. Plain text or light markdown. No JSON.",
  ].join("\n");
}
