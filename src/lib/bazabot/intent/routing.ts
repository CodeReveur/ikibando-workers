/**
 * Intent → tool routing.
 *
 * Lightweight models are unreliable at free-form tool selection, so we make tool
 * *selection* deterministic: the detected intent (and its extracted slots) maps
 * to the tool(s) most likely to ground a correct answer. These run before the
 * answer is composed, guaranteeing the model always has real platform data —
 * regardless of the model's own tool-calling ability.
 *
 * The model still drives intent classification and the final reasoning/wording;
 * for larger models, the optional model-driven tool loop (config.modelToolLoop)
 * can add further calls on top of this baseline.
 */
import type { DetectedIntent } from "./intent";

export interface PlannedCall {
  tool: string;
  args: Record<string, unknown>;
}

/**
 * Keyword-triggered grounding that does NOT depend on perfect intent
 * classification. Small classifiers mislabel (e.g. "employers" → job), so we
 * also pull the obviously-relevant tool straight from the words in the message.
 * Deduplicated against intent routing by the agent.
 */
export function keywordAugment(message: string): PlannedCall[] {
  const m = ` ${message.toLowerCase()} `;
  const calls: PlannedCall[] = [];

  // Anything about money/fees/pricing → fetch the real pricing config.
  if (/\b(fee|fees|commission|charge|charges|percent|percentage|pricing|price|rate|rates|cost|costs|cut|deduction)\b/.test(m)) {
    calls.push({ tool: "getPricing", args: {} });
  }
  // Informational questions → ground with the knowledge base as a safety net.
  if (/\b(how|what|why|when|where|which|explain|escrow|refund|cancel|verify|verified|withdraw|payout|policy|fee|pay|paid|hire|apply|badge|dispute|complete)\b/.test(m)) {
    calls.push({ tool: "searchKnowledge", args: { query: message } });
  }
  return calls;
}

export function routeIntent(intent: DetectedIntent, message: string): PlannedCall[] {
  const p = intent.params ?? {};
  const category = typeof p.category === "string" ? p.category : undefined;
  const location = typeof p.location === "string" ? p.location : undefined;
  const badgeId = typeof p.badgeId === "string" ? p.badgeId : undefined;
  const kb: PlannedCall = { tool: "searchKnowledge", args: { query: message } };

  switch (intent.intent) {
    case "check_wallet":
      return [{ tool: "getWallet", args: {} }];
    case "check_transactions":
      return [{ tool: "getTransactions", args: {} }];
    case "check_notifications":
      return [{ tool: "getNotifications", args: {} }];
    case "check_profile":
      return [{ tool: "getProfile", args: {} }];
    case "update_profile":
      return []; // mutation — require the model/user to confirm explicitly
    case "verify_account":
      return [{ tool: "checkVerification", args: badgeId ? { badgeId } : {} }];
    case "search_job":
      return [{ tool: "searchJobs", args: { category, district: location } }];
    case "search_worker":
      return [{ tool: "searchWorkers", args: { category } }, kb];
    case "search_employer":
      return [{ tool: "searchEmployers", args: { category, district: location } }];
    case "payment_help":
    case "explain_policy":
      // Pricing is only pulled when the message actually mentions money/fees
      // (keywordAugment handles that) — otherwise it distracts policy answers.
      return [kb];
    case "recommendation":
    case "navigation_help":
    case "technical_support":
    case "complaint":
      return [kb];
    case "create_job":
    case "cancel_booking":
      return [kb]; // guide the user; the actual action stays in the app UI
    case "greeting":
      return []; // no lookup needed
    default:
      return [kb]; // unknown → try the knowledge base before answering
  }
}
