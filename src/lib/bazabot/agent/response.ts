/**
 * Response generator / sanitizer. The last line of defence before text reaches
 * the user: strips anything that would leak internals (tool names, JSON blobs,
 * stack traces) and enforces a friendly, bounded final message.
 */
import type { AgentAction, Suggestion } from "../types";

const TOOL_NAME_LEAKS = /\b(searchJobs|searchWorkers|searchCategories|searchLocations|getWallet|getTransactions|getNotifications|searchBookings|getProfile|updateProfile|checkVerification|getPricing|getAppDownload|checkMotoPlate|searchKnowledge|searchFAQ|searchHelp)\s*\(/g;

/** Remove code fences, obvious JSON dumps and internal identifiers. */
export function sanitizeReply(text: string): string {
  let out = (text ?? "").trim();

  // Drop a leading JSON action object the model sometimes emits before prose.
  if (out.startsWith("{") && out.includes('"action"')) {
    const end = out.lastIndexOf("}");
    const after = out.slice(end + 1).trim();
    if (after) out = after;
  }

  // Strip code fences but keep their inner text.
  out = out.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "");

  // Neutralise leaked tool-call syntax.
  out = out.replace(TOOL_NAME_LEAKS, "");

  // Collapse raw stack-trace-looking lines.
  out = out.replace(/^\s*at\s+.*\(.*:\d+:\d+\)\s*$/gm, "").trim();

  // Strip a leading greeting so follow-up replies don't keep saying "Hello".
  // Covers the platform's languages (en/fr/sw/kinyy). Only removes an opening
  // greeting clause, never mid-sentence text.
  out = out.replace(
    /^(?:\*\*)?\s*(hello|hi|hey|hi there|greetings|good (morning|afternoon|evening)|bonjour|salut|coucou|bonsoir|jambo|habari|hujambo|muraho|mwaramutse|mwiriwe)\b[^.!?\n]*[.!,]?\s*/i,
    "",
  ).trimStart();
  // Recapitalise if we trimmed into a lowercase word.
  if (out) out = out.charAt(0).toUpperCase() + out.slice(1);

  // Collapse excessive blank lines.
  out = out.replace(/\n{3,}/g, "\n\n").trim();

  return out;
}

/** Turn the actions taken into ≤2 concise, user-safe explanation lines. */
export function explainActions(actions: AgentAction[]): string {
  const done = actions.filter(a => a.ok).map(a => a.explanation);
  const unique = [...new Set(done)];
  if (!unique.length) return "";
  if (unique.length === 1) return unique[0] + ".";
  return unique.slice(0, 2).join(" and ") + ".";
}

/**
 * Contextual follow-up suggestions derived from intent + role, with no extra
 * model call. Used when the streamed final answer doesn't carry its own.
 */
export function contextualSuggestions(intent: string, role: string): Suggestion[] {
  const s = (label: string): Suggestion => ({ label, query: label });
  const byIntent: Record<string, Suggestion[]> = {
    search_job: [s("Show remote jobs"), s("Jobs in Rwanda")],
    search_worker: [s("Find cleaners"), s("Are they verified?")],
    search_employer: [s("Who is hiring now?"), s("Employers in Rwanda")],
    check_wallet: [s("Show my recent transactions"), s("How do I withdraw?")],
    check_transactions: [s("What's my balance?"), s("Explain the fees")],
    check_notifications: [s("Any new jobs for me?"), s("Show my applications")],
    explain_policy: [s("How do refunds work?"), s("What are the fees?")],
    verify_account: [s("How do I get verified?"), s("Check my badge status")],
    payment_help: [s("How do I withdraw?"), s("How does escrow work?")],
    verify: [s("How do I get verified?"), s("Are workers verified?")],
  };
  if (byIntent[intent]) return byIntent[intent];
  if (role === "seeker") return [s("How do I get paid?"), s("How do I get more jobs?")];
  if (role === "owner") return [s("How does escrow work?"), s("How do I post a job?")];
  return [s("How does escrow work?"), s("Are workers verified?")];
}

/** Deduplicate + clamp suggestions. */
export function normalizeSuggestions(raw: unknown, max = 3): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const item of raw) {
    const label = typeof item === "string" ? item : (item?.label ?? item?.query);
    if (typeof label !== "string") continue;
    const clean = label.trim().slice(0, 80);
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    out.push({ label: clean, query: clean });
    if (out.length >= max) break;
  }
  return out;
}
