/**
 * Intent → tool routing.
 *
 * Lightweight models are unreliable at free-form tool selection, so we make tool
 * *selection* deterministic: the detected intent (and its extracted slots) maps
 * to the tool(s) most likely to ground a correct answer. These run before the
 * answer is composed, guaranteeing the model always has real platform data -
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
const OCCUPATIONS = "cleaner|electrician|plumber|guard|driver|cook|maid|nanny|technician|carpenter|painter|mason|waiter|waitress|security|mechanic|gardener|tailor|welder|labou?rer|housekeeper|babysitter"
  // Kinyarwanda / Swahili / French trades people actually type.
  + "|umwubatsi|umushoferi|umuforomo|umubaji|umucuzi|umuriro|dereva|mlinzi|mpishi|fundi"
  + "|chauffeur|ma[çc]on|menuisier|jardinier|cuisinier|gardien|plombier|[ée]lectricien";

/**
 * The platform is bilingual in practice (Kinyarwanda, English, plus French and
 * Swahili), and users mix languages inside one sentence. Matching only English
 * meant "ndashaka akazi" ("I want a job") looked like small talk, so the bot had
 * to ask which side the person was on instead of just searching.
 *
 * These sets are matched all at once - no language detection first, which would
 * fail on mixed sentences.
 */
const JOB_NOUNS =
  "jobs?|works?|gigs?|vacanc\\w*|employment"
  + "|akazi|imirimo|umurimo|kazi|ajira|nafasi"          // rw / sw
  + "|emplois?|travail|boulot|poste";                    // fr

const WORKER_NOUNS =
  "workers?|staff|employees?|personnel"
  + "|umukozi|abakozi|umukozikazi"                       // rw
  + "|mfanyakazi|wafanyakazi|mfanyikazi"                 // sw
  + "|travailleu\\w*|employe\\w*|ouvrier\\w*";           // fr (accents stripped)

const SEARCH_VERBS =
  "want|need|find|get|looking|search|show|give|hire|hiring|recruit|apply|post"
  + "|shaka|ndashaka|nshaka|gushaka|nkeneye|kubona|tanga|gutanga|nditanga|gukora"  // rw
  + "|nataka|tafuta|kutafuta|ninahitaji|ajiri|kuajiri|natafuta"                    // sw
  + "|veux|cherche|chercher|besoin|trouver|embaucher|recruter";                    // fr

/**
 * Phrases that settle WHICH SIDE the speaker is on, checked before bare nouns
 * because the same noun appears on both sides: in Kinyarwanda "gushaka akazi"
 * (seeking work) and "gutanga akazi" (giving work) share the word "akazi", so
 * the verb, not the noun, carries the meaning.
 */
const WANTS_TO_HIRE = new RegExp(
  "\\b(hire|hiring|recruit|employ|i am an employer|post a job)\\b"
  + "|gutanga akazi|gutanga imirimo|guha akazi|gukoresha|ndi umukoresha|shaka umukozi|gushaka umukozi|ndashaka umukozi"
  + "|kuajiri|ninaajiri|nataka mfanyakazi|natafuta mfanyakazi"
  + "|embaucher|recruter|je suis employeur|cherche un travailleur",
);

const WANTS_WORK = new RegExp(
  "\\b(get hired|find work|looking for work|need work|want work|i need a job|i want a job)\\b"
  + "|gushaka akazi|ndashaka akazi|nshaka akazi|ndashaka gukora|nshaka gukora|ndi umukozi|nkeneye akazi"
  + "|nataka kazi|natafuta kazi|ninahitaji kazi|mimi ni mfanyakazi"
  + "|cherche du travail|cherche un emploi|je veux un emploi|je suis travailleur",
);

/** Lowercase, strip accents and punctuation so "employé" and "employe" both match. */
function normalize(message: string): string {
  return ` ${message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")} `;
}

/** "I am a driver" / "ndi umushoferi" - naming your own trade is a request for jobs. */
const DECLARES_TRADE = new RegExp(
  `\\b(i am|i m|am|ndi|ndimwe|mimi ni|je suis)\\s+(a|an|umu\\w*|mu\\w*|un|une)?\\s*(${OCCUPATIONS})\\b`,
);

/** True when the message is asking to find jobs or workers, in any language. */
export function isSearchRequest(message: string): boolean {
  const m = normalize(message);
  const verb = new RegExp(`\\b(${SEARCH_VERBS})\\b`).test(m);
  const noun = new RegExp(`\\b(${JOB_NOUNS}|${WORKER_NOUNS}|${OCCUPATIONS})\\b`).test(m);
  // An unambiguous phrase, or naming your own trade, is a search on its own -
  // neither needs a search verb to be present.
  return (verb && noun) || WANTS_TO_HIRE.test(m) || WANTS_WORK.test(m) || DECLARES_TRADE.test(m);
}

/**
 * Decide whether the user wants a WORKER (employer hiring) or a JOB (worker
 * seeking), in any of the four languages.
 *
 * Order matters: side-declaring phrases first (the verb disambiguates a shared
 * noun), then bare nouns, then the account role as a last resort.
 */
export function resolveSearchTarget(message: string, role: string): "worker" | "job" {
  const m = normalize(message);

  // 1. Explicit "I want to hire" / "I want work" wins over any noun present.
  const hiring = WANTS_TO_HIRE.test(m);
  const seeking = WANTS_WORK.test(m);
  if (hiring && !seeking) return "worker";
  if (seeking && !hiring) return "job";

  // 2. Bare nouns: only one side named.
  const hasWorker = new RegExp(`\\b(${WORKER_NOUNS})\\b`).test(m);
  const hasJob = new RegExp(`\\b(${JOB_NOUNS})\\b`).test(m);
  if (hasWorker && !hasJob) return "worker";
  if (hasJob && !hasWorker) return "job";

  // 3. "I am a <trade>" - the speaker is describing themselves, so they want jobs.
  if (/\b(i am|i m|am)\s+(a|an)\b/.test(m) || /\bndi\b|\bmimi ni\b|\bje suis\b/.test(m)) return "job";

  return role === "owner" ? "worker" : "job";
}

/** A "Sign up" CTA card linking to the real signup page. */
export function signupCard(): ResultCard {
  return {
    kind: "action", id: "signup",
    title: "Create your account",
    subtitle: "Sign up in your browser - no app to download",
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
  /*
   * Asking for the app: fetch what is actually published rather than describing it.
   *
   * A download answer is only worth anything if it carries the real link and the real version,
   * and those change without this file changing. "apk" and "install" are in here because that
   * is what people type when the word "download" does not occur to them.
   */
  if (/\b(download|downloading|install|installing|apk|app store|play store|get the app)\b/.test(m)) {
    calls.push({ tool: "getAppDownload", args: {} });
  }

  /*
   * A plate in the message: check it, rather than explain how checking works.
   *
   * Somebody stuck on registration types the plate itself - "RM356X is not accepted" - and the
   * useful answer is what RURA says about that plate, including whether it is already taken.
   * Two or three letters and three digits is specific enough not to catch ordinary words.
   */
  const plate = m.match(/\b([a-z]{2,3}\s?\d{3}\s?[a-z]?)\b/);
  if (plate && /\b(plate|moto|motari|register|registration|rura|number)\b/.test(m)) {
    calls.push({ tool: "checkMotoPlate", args: { plate: plate[1].toUpperCase().replace(/\s+/g, "") } });
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
  // classifier - so "I want a worker" searches workers, not jobs. Runs first so
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
      return []; // mutation - require the model/user to confirm explicitly
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
      // (keywordAugment handles that) - otherwise it distracts policy answers.
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
