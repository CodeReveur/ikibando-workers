/**
 * Help center content — a single, categorized source of truth used by the
 * public /help page and the dashboard help pages.
 *
 * Fees are NEVER hardcoded here: they are derived from the live, admin-set
 * pricing config (getPricingConfig → /api/config/pricing), so the help center
 * always tells users the real numbers instead of a stale "25%".
 */
import type { PricingConfig } from "./api";

export interface HelpItem { q: string; a: string }
export interface HelpSection { title: string; items: HelpItem[] }

/** Percentages derived from the live pricing config. */
export function feePercents(p: PricingConfig) {
  const worker = Math.round((p.workerCommissionRate ?? 0) * 100);
  const employer = Math.round((p.employerServiceFeeRate ?? 0) * 100);
  const cancel = Math.round((p.cancellationPenaltyRate ?? 0) * 100);
  return { worker, employer, cancel, workerKeeps: Math.max(0, 100 - worker) };
}

/**
 * Build the full, categorized help content with fee figures filled in from the
 * live pricing config.
 */
export function buildHelpSections(p: PricingConfig): HelpSection[] {
  const f = feePercents(p);

  return [
    {
      title: "Getting started",
      items: [
        { q: "What is MpahMapu?", a: "MpahMapu is Rwanda's on-demand workforce platform. Employers hire verified workers for jobs like cleaning, security, events, driving and more, and workers find paid gigs near them — all secured by escrow." },
        { q: "Do I need to download an app?", a: "No. MpahMapu is a website that works in your browser on any phone or computer — there's nothing to download. You can add it to your home screen for quick access." },
        { q: "How do I create an account?", a: "Open the site and tap Sign Up. Choose Worker (to be hired) or Employer (to hire), then enter your name, email and phone and set a password." },
        { q: "How do I get started as a worker?", a: "Sign up as a Worker, complete your profile (date of birth, education, the service categories you work in, your district, equipment and availability), then submit your verification badge with your national ID to get approved. You can then apply to jobs or be invited through Hire Now." },
        { q: "How do I get started as an employer?", a: "Sign up as an Employer (or post as a guest), create a job with the date, location, number of workers and rate, fund the escrow, then review applicants and hire." },
        { q: "Is it free to sign up?", a: "Yes — creating an account is completely free for both workers and employers. Charges only apply to jobs." },
      ],
    },
    {
      title: "Finding & doing work (workers)",
      items: [
        { q: "How do I get jobs?", a: "Complete your profile, add your specialties and district, and submit your verification badge. Then browse open jobs in the marketplace and apply, or get invited directly through 'Hire Now'. A complete, verified profile ranks higher." },
        { q: "How do I get paid?", a: `Your earnings are held safely in escrow when a job starts and released to your MpahMapu wallet the moment the employer marks the job complete. You keep ${f.workerKeeps}% of the job amount (after the ${f.worker}% commission). Withdraw to MTN MoMo or Airtel Money anytime.` },
        { q: "How do I verify completion?", a: "When you finish, ask the employer to scan your worker badge (QR) or mark the job complete from their dashboard — that releases your payout instantly." },
        { q: "Why am I not getting jobs?", a: "Make sure your profile is complete, your district is set correctly, and your badge is submitted. A complete, verified profile is shown first when employers browse." },
        { q: "Can I work in more than one category?", a: "Yes. Add all the service categories you practise to your profile and you'll be matched with more jobs." },
      ],
    },
    {
      title: "Hiring (employers)",
      items: [
        { q: "How do I post a job?", a: "Tap 'Post a Job', choose a category, set the date, time, location, number of workers and rate, then fund the escrow with your wallet, MTN MoMo, Airtel Money or card." },
        { q: "Can I hire without an account?", a: "Yes. You can post as a guest with your name, email and phone — we create a passwordless account so you can manage the job later." },
        { q: "How do I choose a worker?", a: "Review applicants' profiles, ratings and districts and accept the ones you want, or invite a verified worker directly with 'Hire Now'. You can accept several applicants at once." },
        { q: "Can I hire more than one worker?", a: "Yes. Set the number of workers when posting and the escrow is calculated for all of them." },
        { q: "How do I release payment?", a: "Scan the worker's badge or tap 'Mark Complete' when the work is done — the escrow is released to the worker instantly." },
      ],
    },
    {
      title: "Payments, escrow & fees",
      items: [
        {
          q: "What is the platform fee?",
          a: `A ${f.worker}% commission is deducted from worker earnings to run the service — verification, support and payment processing — so workers keep ${f.workerKeeps}% of the job amount. Employers pay a ${f.employer}% escrow service fee on top of the job amount. The exact figures are always shown before you confirm, and set by MpahMapu (they can change over time).`,
        },
        { q: "How much will I actually earn from a job?", a: `Workers keep ${f.workerKeeps}% of the job amount after the ${f.worker}% commission. The exact payout is shown before you accept a job.` },
        { q: "How does escrow work?", a: "When an employer posts or confirms a job, the payment is locked in escrow. It's only released to the worker after the employer marks the job complete — protecting workers from non-payment and employers from paying for undelivered work." },
        { q: "What payment methods are supported?", a: "MTN Mobile Money, Airtel Money, and Visa or Mastercard cards." },
        { q: "How do I withdraw my earnings?", a: "Open your wallet and tap Withdraw to cash out to MTN MoMo or Airtel Money. Withdrawals are confirmed with a one-time code for security." },
        { q: "Are there any hidden fees?", a: `No hidden fees. Employers pay a ${f.employer}% escrow service fee shown before checkout, and workers see the ${f.worker}% commission on their payout. Both are displayed clearly before you confirm.` },
        { q: "What happens to my money if a job is cancelled?", a: `Escrowed funds are refunded to the employer's wallet. A late cancellation (close to the start time) may incur a ${f.cancel}% penalty that compensates the worker.` },
      ],
    },
    {
      title: "Verification & safety",
      items: [
        { q: "How do I get verified?", a: "Submit your verification badge with your national ID from your profile. Verification builds trust, ranks you higher when employers browse, and unlocks the verified badge." },
        { q: "Are workers verified?", a: "Workers can submit a verification badge with their national ID. Verified workers carry a badge so employers can hire with confidence." },
        { q: "Is my payment safe?", a: "Yes — escrow holds the payment until the job is completed, and disputes are reviewed by our support team before any funds move." },
      ],
    },
    {
      title: "Disputes & support",
      items: [
        { q: "What happens if there's a dispute?", a: "If an employer refuses to release payment or opens a dispute, our support team reviews the case and contacts both parties to resolve it based on the work evidence. Escrowed funds stay frozen until a decision is made." },
        { q: "How do I contact support?", a: "Use the live chat (BazaBot) on any page — it can answer most questions instantly and connect you to a human agent when needed. You can also reach us on WhatsApp, email or phone below." },
        { q: "I forgot my password.", a: "Tap 'Forgot Password' on the sign-in page and use the email you registered with to set a new one. Guest posters can use the same flow to add a password." },
      ],
    },
  ];
}

/** Flatten all items — handy for search or the dashboard mini-FAQ. */
export function allHelpItems(p: PricingConfig): HelpItem[] {
  return buildHelpSections(p).flatMap(s => s.items);
}
