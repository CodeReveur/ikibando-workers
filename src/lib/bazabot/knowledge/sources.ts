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
    id: "guide-ask-motari",
    title: "Ask Motari: request a moto taxi ride",
    category: "guide",
    text: "Ask Motari is the platform's moto taxi service. Open the Ask Motari page from the home button or the Browse tab. " +
      "Set your pickup by typing a place, tapping the map, or using your current location. The destination is optional: " +
      "with a destination you get a fixed fare shown before you request; without one the ride runs on a fair meter " +
      "(base fare plus a per kilometre rate). Enter your name and phone number and request. No account or login is needed. " +
      "You will see the matched motari's name, photo, plate number and rating, track them live on the map, and pay cash or " +
      "mobile money at the end. You can rate the driver after the ride.",
  },
  {
    id: "guide-become-motari",
    title: "Become a motari (moto taxi driver)",
    category: "guide",
    text: "Motari have their own registration, separate from worker and employer signup. Open Ask Motari and choose " +
      "'Register as motari' in the menu (also linked from the site footer and the signup page). One form collects your " +
      "legal name, plate number, moto brand or model, phone number, email and password. Verify the code emailed to you " +
      "and you land on the driver dashboard at /drive. It works like the passenger app: a live map with passengers " +
      "seeking rides shown as pins, an online/offline toggle, and a bottom panel with four tabs. Rides: accept nearby " +
      "requests and run the trip. Money: your wallet balance, total collected, and instant withdrawal to MTN MoMo or " +
      "Airtel Money (cash fares are yours on the spot; MoMo fares land in the wallet minus commission). Trips: recent " +
      "travels and travellers with fares and ratings. More: raise a complaint to support and log out. The session " +
      "stays signed in until you log out, and signing in with a motari account always goes straight to /drive.",
  },
  {
    id: "policy-motari-fares",
    title: "Motari fares",
    category: "policy",
    text: "Motari rides have two fare modes. Quoted: when the passenger gives a destination, the fare is fixed up front " +
      "from the road distance and honored at the end, no haggling. Metered: with no destination, the passenger sees the " +
      "base fare and per kilometre rate before requesting, and the final fare comes from the distance actually ridden. " +
      "Both modes have a minimum fare. Optionally the passenger can propose their own price when requesting, and that " +
      "agreed amount becomes the fare. Payment is cash or mobile money, confirmed by the driver at the end of the ride; " +
      "the passenger can also choose to settle through the platform. When a request is searching, it is offered to one " +
      "nearby motari at a time for 30 seconds, and the scan widens 1 km at a time up to 15 km until a motari accepts.",
  },
  {
    id: "help-motari-ride",
    title: "During a motari ride: tracking, cancelling, problems",
    category: "help",
    text: "After requesting, your ride page shows the search countdown, then your motari approaching on the live map. " +
      "Check the plate number before you get on. You can cancel while searching or before pickup; a ride in progress is " +
      "finished with the driver. If no motari is found nearby the request ends honestly and you can ask again with one tap. " +
      "Your ride link works on any device, so losing connection never loses the ride. For problems use the Support button " +
      "on the ride panel.",
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
