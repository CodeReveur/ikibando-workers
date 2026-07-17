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
import type { ResultCard } from "../types";

export interface PlannedCall {
  tool: string;
  args: Record<string, unknown>;
}

// Occupations users name when they mean a WORKER (or their own trade).
const OCCUPATIONS = "cleaner|electrician|plumber|guard|driver|cook|maid|nanny|technician|carpenter|painter|mason|waiter|waitress|security|mechanic|gardener|tailor|welder|labou?rer|housekeeper|babysitter";

/** True when the message is asking to find jobs or workers. */
export function isSearchRequest(message: string): boolean {
  const m = ` ${message.toLowerCase()} `;
  const verb = /\b(want|need|find|get|looking|search|show|give|hire|hiring|recruit|apply)\b/.test(m);
  const noun = new RegExp(`\\b(job|jobs|work|works|gig|gigs|worker|workers|staff|employee|vacanc\\w*|${OCCUPATIONS})\\b`).test(m);
  return verb && noun;
}

/**
 * Decide whether the user wants a WORKER (employer hiring) or a JOB (worker
 * seeking). This is the fix for "I want a worker" wrongly searching jobs: the
 * word "worker" and hiring verbs mean workers; "job"/"get hired"/"I am a …" mean
 * jobs; otherwise fall back to the role (employer→worker, seeker/guest→job).
 */
export function resolveSearchTarget(message: string, role: string): "worker" | "job" {
  const m = ` ${message.toLowerCase().replace(/[^\p{L}\s]/gu, " ")} `;
  const hasWorker = /\bworkers?\b|\bstaff\b|\bemployees?\b/.test(m);
  const hasJob = /\b(jobs?|gigs?|vacanc\w*)\b/.test(m);
  if (hasWorker && !hasJob) return "worker";
  if (hasJob && !hasWorker) return "job";

  // "I am a <trade>" / "looking for work" => the speaker is a worker wanting jobs.
  if (/\b(i am|i'?m|am)\s+(a|an)\b/.test(m) || /\b(get hired|find work|looking for work|need work|want work)\b/.test(m)) return "job";
  // Hiring verbs => employer wanting a worker.
  if (/\b(hire|hiring|recruit)\b/.test(m)) return "worker";

  return role === "owner" ? "worker" : "job";
}

/** A "Sign up" CTA card linking to the real signup page. */
export function signupCard(): ResultCard {
  return {
    kind: "action", id: "signup",
    title: "Create your account",
    subtitle: "Sign up in your browser — no app to download",
    url: "/signup", cta: "Sign up",
  };
}

/** True when the user is asking how/where to sign up, register, or get started. */
export function wantsSignup(message: string): boolean {
  return /\b(sign ?up|signup|register|registration|create (an )?account|get(ting)? started|how (do|can) i (start|begin|join)|join now|kwiyandikisha|gutangira)\b/i.test(message);
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

export function routeIntent(intent: DetectedIntent, message: string, role: string): PlannedCall[] {
  const p = intent.params ?? {};
  const category = typeof p.category === "string" ? p.category : undefined;
  const location = typeof p.location === "string" ? p.location : undefined;
  const badgeId = typeof p.badgeId === "string" ? p.badgeId : undefined;
  const kb: PlannedCall = { tool: "searchKnowledge", args: { query: message } };

  // Search requests are resolved by CONTENT (worker vs job), not just the
  // classifier — so "I want a worker" searches workers, not jobs. Runs first so
  // a mislabelled intent can't send it to the wrong tool.
  if (isSearchRequest(message)) {
    return resolveSearchTarget(message, role) === "worker"
      ? [{ tool: "searchWorkers", args: { category } }]
      : [{ tool: "searchJobs", args: { category, district: location } }];
  }

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
