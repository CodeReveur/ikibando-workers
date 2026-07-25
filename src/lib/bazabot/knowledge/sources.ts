/**
 * Knowledge sources. The searchable corpus is assembled from:
 *  - the existing FAQ corpus (bazabot-knowledge.ts) - single source of truth,
 *  - a handful of concise platform policy/how-to documents.
 *
 * Add markdown/JSON docs by pushing more KnowledgeDoc entries. Keeping docs
 * short and self-contained makes both keyword and semantic search accurate.
 */
import { KNOWLEDGE } from "@/components/support/bazabot-knowledge";

export interface KnowledgeDoc {
  id: string;
  title: string;
  text: string;
  /** Coarse grouping used for lightweight filtering + analytics. */
  category: "faq" | "policy" | "guide" | "help";
}

/** Concise canonical docs beyond the FAQ pairs. */
const DOCS: KnowledgeDoc[] = [
  {
    id: "policy-escrow",
    title: "Escrow policy",
    category: "policy",
    text: "Every job is funded up front into escrow: the worker's amount plus a 5% employer service fee. " +
      "The money is held safely and released to the worker only after the employer marks the job complete. " +
      "This protects workers from non-payment and employers from paying for undelivered work.",
  },
  {
    id: "policy-fees",
    title: "Fees policy",
    category: "policy",
    text: "Signing up and posting jobs is free. Employers pay a 5% service fee on top of the job amount when funding escrow. " +
      "Workers pay a commission on their earnings that is deducted at payout. Exact rates are configurable and shown at checkout.",
  },
  {
    id: "policy-refunds",
    title: "Refunds and cancellations",
    category: "policy",
    text: "Employers can cancel for free up to 2 hours before a job starts and the escrow is refunded to their wallet. " +
      "Late cancellations may incur a penalty that compensates the worker. Refund requests on disputed jobs are reviewed by support.",
  },
  {
    id: "guide-getpaid",
    title: "How workers get paid",
    category: "guide",
    text: "Complete the job, then confirm completion with your verification badge. Once the employer marks the job complete, " +
      "your earnings move to your wallet. Withdraw to MTN MoMo or Airtel Money anytime; a small commission is deducted at payout.",
  },
  {
    id: "guide-verify",
    title: "Getting verified",
    category: "guide",
    text: "Submit your verification badge with your national ID from your profile. Verification builds trust, ranks you higher when " +
      "employers browse, and unlocks the verified badge. Approval is usually reviewed within a short time.",
  },
  {
    id: "help-login",
    title: "Login and password help",
    category: "help",
    text: "Forgot your password? Tap 'Forgot Password' on the sign-in page and use the email you registered with to set a new one. " +
      "Guest job posters have passwordless accounts - use the same flow to add a password. Social sign-in users log in with Google or Facebook.",
  },
];

let CACHE: KnowledgeDoc[] | null = null;

/** The full corpus: FAQ pairs (as docs) + canonical documents. Built once. */
export function knowledgeCorpus(): KnowledgeDoc[] {
  if (CACHE) return CACHE;
  const faqDocs: KnowledgeDoc[] = KNOWLEDGE.map((qa, i) => ({
    id: `faq-${i}`,
    title: qa.q,
    text: qa.a,
    category: "faq" as const,
  }));
  CACHE = [...faqDocs, ...DOCS];
  return CACHE;
}
