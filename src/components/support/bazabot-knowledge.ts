/**
 * BazaBot knowledge base - a large set of frequently-asked questions and answers
 * about MpahMapu. Matched by significant-word overlap against the visitor's
 * message; used for the long tail after the multilingual intent engine and
 * before escalating to a human agent.
 *
 * Answers are written in English (the platform's primary language). To extend
 * coverage, just add more { q, a } entries - keywords are derived automatically.
 */

export interface QA { q: string; a: string }

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "am", "be", "do", "does",
  "did", "can", "could", "would", "should", "will", "shall", "my", "me", "i", "you", "your", "we", "our",
  "it", "its", "this", "that", "these", "those", "how", "what", "when", "where", "who", "why", "which",
  "if", "so", "as", "at", "by", "with", "from", "up", "out", "get", "got", "have", "has", "had", "was",
  "were", "there", "here", "about", "into", "than", "then", "them", "they", "he", "she", "his", "her",
  "just", "any", "all", "some", "more", "most", "not", "no", "yes", "please", "hi",
  "hello", "hey", "want", "need", "know", "tell", "help", "use", "using", "make", "made", "mpahmapu",
]);

/** Light stemmer so plural/verb forms match (disputes→dispute, ratings→rating). */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(w => w.length > 2 && !STOP.has(w)).map(stem);
}

/** Who is asking. Mirrors BazaBotRole in bazabot.tsx (owner = employer, seeker = worker). */
export type Audience = "owner" | "seeker" | "public";

// Unambiguous, action-oriented phrases that reveal whether a question is asked
// from the worker's or the employer's point of view. Used only to break ties
// between equally-scoring answers, so the visitor's role decides which one wins.
const WORKER_SIGNALS = [
  "get paid", "payout", "earn", "earnings", "apply", "applying", "application",
  "get hired", "find jobs", "get jobs", "start earning", "my badge",
  "withdraw a job application",
];
const EMPLOYER_SIGNALS = [
  "post a job", "posting", "hire", "hiring", "applicant", "applicants",
  "headcount", "refund", "top up", "review applicants", "how many workers",
];

/** Classify a canned question as worker-, employer- or role-neutral. */
function leanOf(q: string): "worker" | "employer" | null {
  const h = ` ${normalize(q)} `;
  let w = 0, e = 0;
  for (const s of WORKER_SIGNALS) if (h.includes(` ${s} `)) w++;
  for (const s of EMPLOYER_SIGNALS) if (h.includes(` ${s} `)) e++;
  return w > e ? "worker" : e > w ? "employer" : null;
}

/** The FAQ corpus. */
export const KNOWLEDGE: QA[] = [
  // ── Getting started & accounts ───────────────────────────────────────────
  { q: "What is MpahMapu?", a: "MpahMapu is Rwanda's on-demand workforce platform. Employers hire verified workers for jobs like cleaning, events, security, driving and more, and workers find paid gigs near them." },
  { q: "How do I create an account?", a: "Tap Sign Up, choose Worker or Employer, then enter your name, email and phone number. Workers add their skills and district; employers can start posting jobs right away." },
  { q: "What is required to register as a worker?", a: "Just a phone or computer with a web browser - MpahMapu is a website, not an app, so there's nothing to download. Open the site, tap Sign Up, choose Worker, and enter your name, email and phone number. Then complete your profile, add your skills and district, and submit your verification badge to get approved. No app install or payment setup is needed to register." },
  { q: "Do I need to download an app to use MpahMapu?", a: "No. MpahMapu is a website that works in your browser on any phone or computer - there is no app to download. You can add the site to your home screen for quick access." },
  { q: "Is it free to sign up?", a: "Yes, creating an account on MpahMapu is completely free for both workers and employers." },
  { q: "Do I need an account to post a job?", a: "No. You can post a job as a guest by entering your name, email and phone. We create a passwordless account for you automatically so you can manage the job later." },
  { q: "Should I sign up as a worker or an employer?", a: "Sign up as a Worker if you want to be hired for jobs, or as an Employer if you want to hire people. You can create a separate account for the other role if you need both." },
  { q: "How do I log in?", a: "Tap Log In and enter your email and password. If you signed up with Google or Facebook, use that same button to sign in." },
  { q: "I forgot my password. What do I do?", a: "Tap 'Forgot Password' on the sign-in page, enter your email, and we'll send you a reset link to set a new password." },
  { q: "I posted a job as a guest and now can't log in. Why?", a: "Guest job posts create an account without a password. Use 'Forgot Password' with the email you posted with to set a password, then sign in." },
  { q: "How do I reset my password?", a: "Open the reset link we email you after tapping 'Forgot Password', then enter and confirm your new password." },
  { q: "Can I change my email address?", a: "You can update your contact details from your profile settings. If you have trouble, our support team can help you change it." },
  { q: "Can I change my phone number?", a: "Yes, update your phone number in your profile settings. Keep it current so employers and workers can reach you." },
  { q: "How do I sign up with Google?", a: "On the sign-up or sign-in page, tap 'Continue with Google' and choose your Google account. No password is needed for social sign-in." },
  { q: "How do I sign up with Facebook?", a: "Tap 'Continue with Facebook' on the sign-up or sign-in page and authorise the app to create or access your account." },
  { q: "Why do I need to verify my email?", a: "Email verification keeps your account secure and lets us send you job alerts, receipts and important updates. Enter the code we email you to verify." },
  { q: "I didn't receive my verification code.", a: "Check your spam folder, then tap 'Resend Code'. If it still doesn't arrive, make sure your email is spelled correctly or contact support." },
  { q: "Can I have both a worker and an employer account?", a: "Yes, but each role uses its own account. Register separately as a worker and as an employer if you want to both hire and be hired." },
  { q: "How do I delete my account?", a: "Contact our support team to request account deletion. We'll confirm your identity and remove your data according to our privacy policy." },
  { q: "How do I enable two-factor authentication?", a: "Go to your account security settings and turn on 2FA. You'll scan a QR code with an authenticator app and enter a 6-digit code to confirm." },
  { q: "What is 2FA?", a: "Two-factor authentication (2FA) adds a second security step at login using a 6-digit code from an authenticator app, protecting your account even if your password is leaked." },
  { q: "Do you support login on multiple devices?", a: "Yes, you can sign in on your phone and computer. For your security we may ask you to re-verify from new devices." },

  // ── Posting jobs (employers) ─────────────────────────────────────────────
  { q: "How do I post a job?", a: "Tap 'Post a Job', choose a category, set the date, time, location, number of workers and the rate, then pay the escrow with your wallet, MTN MoMo, Airtel Money or card." },
  { q: "How much does it cost to post a job?", a: "Posting is free. You only pay the workers' agreed amount plus a 5% escrow handling fee, which is held safely until the job is complete." },
  { q: "Can I post a job without paying upfront?", a: "No. To protect workers, the job amount plus the 5% fee is held in escrow when you post, and only released once you mark the job complete." },
  { q: "How do I choose the right rate for a job?", a: "Set a fair rate for the skill and hours involved. When you pick a category, MpahMapu shows typical rates to guide you." },
  { q: "Can I hire more than one worker for a job?", a: "Yes. Set the number of workers you need when posting, and the escrow is calculated for all of them." },
  { q: "Can I set the exact location of a job?", a: "Yes. Choose the province and district, then drop a pin on the map or use 'Detect my GPS' for the precise spot." },
  { q: "How do I edit a job after posting?", a: "Open the job from your dashboard and tap edit. You can change details like description, workers, duration and location; the rate and category are locked after posting." },
  { q: "Can I change the rate after posting a job?", a: "No, the rate is locked once a job is posted to keep it fair for applicants. You can cancel and repost if you need a different rate." },
  { q: "How do I cancel a job I posted?", a: "Open the job and tap Cancel. Free cancellation is available up to 2 hours before the start time; the escrow is refunded to your wallet." },
  { q: "What happens to my money if I cancel a job?", a: "The escrowed amount is refunded to your wallet. Late cancellations, within 2 hours of the start, may incur a 10% fee to compensate the worker." },
  { q: "How do workers find my job?", a: "Your open job appears in the marketplace and active workers in the area are notified instantly, so they can apply." },
  { q: "Can I invite a specific worker to my job?", a: "Yes. Use 'Hire Now' or 'Hire [name]' to invite a verified worker directly, or review applicants and accept the ones you want." },
  { q: "How do I review applicants?", a: "Open your job and tap Applications to see each applicant's profile, rating and district, then accept or decline them." },
  { q: "Can I accept all applicants at once?", a: "Yes, if you need several workers you can accept all pending applicants for a job in one tap." },
  { q: "How long does my job stay open?", a: "Jobs stay open until you fill the positions or the start time passes. You can set an expiry when posting if you want it to close earlier." },
  { q: "Can I repost a job?", a: "Yes, you can post a new job with the same details anytime from your dashboard." },
  { q: "What details should I include in a job?", a: "Add the category, date, time, duration, number of workers, precise location and any notes like attire, tools provided, or special requirements." },
  { q: "Can I add notes or requirements to a job?", a: "Yes. Use the notes field to add requirements such as formal attire, required tools, or that it's an outdoor event." },
  { q: "What is headcount when posting a job?", a: "Headcount is the number of workers you want to hire for the job. The escrow total is multiplied by this number." },
  { q: "Can I schedule a job for a future date?", a: "Yes. Pick any future date and time when posting so workers know exactly when to show up." },

  // ── Finding & applying for jobs (workers) ────────────────────────────────
  { q: "How do I find jobs?", a: "Browse open jobs in the marketplace, filter by category or district, and apply to the ones that fit your skills and location." },
  { q: "How do I apply for a job?", a: "Open a job and tap Apply. Add a short note on why you're a good fit, and the employer will review your application." },
  { q: "How do I get hired faster?", a: "Complete your profile, add your specialties and district, submit your verification badge, and keep a high rating by doing great work." },
  { q: "Why am I not getting jobs?", a: "Make sure your profile is complete, your district is set correctly, and your badge is submitted. A complete, verified profile ranks higher when employers browse." },
  { q: "Can employers invite me directly?", a: "Yes. With a complete profile you can be invited through 'Hire Now', where an employer picks you directly for a job." },
  { q: "How do I know if I've been hired?", a: "You'll get a notification and an email when an employer accepts your application or invites you through Hire Now." },
  { q: "Can I apply to more than one job?", a: "Yes, apply to as many open jobs as you like. Just make sure you can honour the schedules if you're accepted." },
  { q: "How do I withdraw a job application?", a: "Open the application from your dashboard and tap Withdraw. You can only withdraw applications that are still pending." },
  { q: "What does 'Hire Now' mean?", a: "'Hire Now' is when an employer selects and hires you directly instead of waiting for you to apply. You'll be notified to confirm." },
  { q: "Can I choose which district I work in?", a: "Yes. Set your district in your profile, and you'll be matched with nearby jobs first." },
  { q: "How do I filter jobs by category?", a: "In the marketplace, use the category filter to show only jobs that match your skills, like cleaning, security or events." },
  { q: "Do I get notified about new jobs?", a: "Yes. Active workers receive alerts for new jobs matching their category and area so you can apply quickly." },
  { q: "Can I see the pay before applying?", a: "Yes, every job shows the rate and estimated total before you apply, so you know exactly what you'll earn." },
  { q: "What happens after I'm accepted for a job?", a: "Show up at the scheduled time and location, complete the work, then verify completion with your badge so the employer can release your payment." },
  { q: "Can I reject a Hire Now offer?", a: "Yes. If you're invited through Hire Now you can accept or decline the offer before the job begins." },
  { q: "How many jobs can I do?", a: "There's no limit. Take on as many jobs as you can reliably complete while keeping your ratings high." },
  { q: "Do I need experience to get jobs?", a: "Not always. Many jobs welcome beginners. Set your experience level honestly and start with jobs that match your skills." },
  { q: "How do I stand out to employers?", a: "Add a clear profile, list real skills, keep your availability updated, get verified, and build up strong ratings from completed jobs." },

  // ── Payments, escrow & wallet ────────────────────────────────────────────
  { q: "How does escrow work?", a: "When an employer posts or confirms a job, the payment is locked in escrow. It's only released to the worker after the employer marks the job complete." },
  { q: "What is escrow?", a: "Escrow is a secure holding account. The employer's payment sits there safely and is released to the worker only when the job is done, protecting both sides." },
  { q: "How do I get paid as a worker?", a: "Your earnings are held in escrow when the job starts and released to your wallet once the employer marks the job complete. You can withdraw to MoMo anytime." },
  { q: "When do I receive my payment?", a: "Payment is released to your wallet as soon as the employer marks the job complete after you verify it with your badge." },
  { q: "What payment methods are supported?", a: "MpahMapu supports MTN Mobile Money, Airtel Money, and Visa or Mastercard cards. Bank transfers are coming soon." },
  { q: "Can I pay with MTN MoMo?", a: "Yes. Choose MTN Mobile Money at checkout and confirm the payment prompt on your phone." },
  { q: "Can I pay with Airtel Money?", a: "Yes. Select Airtel Money at checkout and approve the payment request sent to your phone." },
  { q: "Can I pay with a card?", a: "Yes, you can pay with Visa or Mastercard by entering your card number, expiry and CVV at checkout." },
  { q: "What is the wallet?", a: "Your wallet holds your MpahMapu balance. Employers top it up to fund jobs, and workers receive their payouts there after completed jobs." },
  { q: "How do I top up my wallet?", a: "Go to your wallet and tap Top Up, then pay with MTN MoMo, Airtel Money or card. The amount is added to your balance instantly." },
  { q: "Can I pay for a job from my wallet?", a: "Yes. If your wallet balance covers the escrow, you can pay directly from it. Otherwise pay with MoMo, Airtel or card." },
  { q: "How do I withdraw money from my wallet?", a: "Open your wallet, tap Withdraw, enter the amount and your Mobile Money number, and the funds are sent to your MoMo or Airtel account." },
  { q: "Is there a minimum withdrawal amount?", a: "You can withdraw your available balance. If a minimum applies it's shown on the withdrawal screen before you confirm." },
  { q: "How long do withdrawals take?", a: "Withdrawals to Mobile Money are usually processed quickly. If it's delayed, check the transaction status in your wallet or contact support." },
  { q: "What is the platform fee?", a: "A commission is deducted from worker earnings to run the service, verify users and process payments. The exact rate is set by MpahMapu and shown before you accept a job and in your earnings - you keep the rest of the job amount." },
  { q: "What is the 5% escrow fee?", a: "Employers pay a 5% escrow handling fee on top of the job amount. It covers secure payment processing and protection of the funds." },
  { q: "How much will I actually earn from a job?", a: "Your exact payout - the job amount minus the platform commission - is shown before you accept a job, so you always know what you will earn." },
  { q: "How much does an employer pay in total?", a: "An employer pays the workers' total amount plus a 5% escrow handling fee. This full amount is held in escrow." },
  { q: "Why was a fee deducted from my earnings?", a: "The platform commission funds verification, support and payment processing that keep MpahMapu safe and reliable. The current rate is shown before you accept a job and in your earnings." },
  { q: "Can I see my transaction history?", a: "Yes. Your wallet shows every top-up, payment, payout and withdrawal with its status and date." },
  { q: "Is my payment secure?", a: "Yes. Payments are held in escrow and processed through trusted providers, so your money is protected until the job is complete." },
  { q: "What happens to escrow if the job isn't done?", a: "If the job is cancelled or not completed, the escrow is refunded to the employer's wallet according to our cancellation policy." },
  { q: "Can I get a receipt for my payment?", a: "Yes, each transaction in your wallet serves as a receipt, and we email confirmations for top-ups and payouts." },
  { q: "Why is my wallet balance zero?", a: "Your balance is zero until you top up (employers) or complete a job and receive a payout (workers). Check your transactions for details." },
  { q: "Can I transfer money to another user?", a: "MpahMapu payments flow through jobs and escrow rather than direct user-to-user transfers. Post or accept a job to move funds securely." },

  // ── Verification, badges, safety ─────────────────────────────────────────
  { q: "How are workers verified?", a: "Workers go through ID verification and reference checks before being listed. A verified badge shows the checks are complete." },
  { q: "What is a worker badge?", a: "Every verified worker gets a digital badge with a QR code. Employers scan it to confirm identity and to verify job completion." },
  { q: "How do I get verified?", a: "Complete your profile and submit your verification badge with your photo, national ID and legal name. Our team reviews and approves it." },
  { q: "How do I submit my badge?", a: "In your profile, open the badge section, upload your photo and national ID, enter your legal name, and submit for review." },
  { q: "How long does verification take?", a: "Verification is usually reviewed within a couple of business days. You'll be notified once your badge is approved." },
  { q: "What is the QR code on my badge for?", a: "The QR code lets employers scan and confirm your identity, and it's used to verify that you completed a job so payment can be released." },
  { q: "How do I verify a worker's badge?", a: "Scan the QR code on the worker's badge or enter their badge ID on the verify page to confirm they're a genuine, active worker." },
  { q: "Are all workers on MpahMapu verified?", a: "Workers must pass ID verification and reference checks to be listed. Look for the verified badge on a worker's profile." },
  { q: "Is MpahMapu safe to use?", a: "Yes. Workers are ID-verified, payments are protected in escrow, and our support team reviews any dispute within 2 hours." },
  { q: "How do you keep my data safe?", a: "We protect your data with secure storage and encryption, and only use it to run the platform. See our privacy policy for details." },
  { q: "What if a worker doesn't show up?", a: "If a worker doesn't arrive, you can raise a dispute. Your escrow is protected and our team will help resolve it, including a refund if appropriate." },
  { q: "What if an employer doesn't pay?", a: "Payment is held in escrow before the job starts, so the funds are already secured. If there's an issue, raise a dispute and we'll step in." },
  { q: "How do I report a suspicious user?", a: "Use the report option or contact support with details. We review reports quickly and take action to keep the community safe." },
  { q: "Do you do background checks?", a: "Yes, workers go through ID verification and reference checks as part of getting their verified badge." },
  { q: "Can I trust a worker with high ratings?", a: "High ratings reflect real completed jobs and satisfied employers, so they're a strong sign of a reliable worker, especially alongside a verified badge." },

  // ── Ratings & reviews ────────────────────────────────────────────────────
  { q: "How do ratings work?", a: "After each job, both the employer and worker leave a rating from 1 to 5. Ratings are based only on real completed jobs." },
  { q: "How do I rate a worker?", a: "When you mark a job complete, you can give the worker a rating and optional feedback about their work." },
  { q: "How do I rate an employer?", a: "After verifying the job is complete, you can rate the employer and leave feedback about the experience." },
  { q: "Why is my rating important?", a: "A higher rating helps workers get hired faster and helps employers attract better workers. It builds your reputation on the platform." },
  { q: "Can I change a rating I gave?", a: "Ratings are final once submitted to keep them fair. Contact support if you believe a rating was left in error." },
  { q: "What is a good rating?", a: "Ratings run from 1 to 5. Aim to stay above 4.5 by being reliable, punctual and doing quality work." },
  { q: "Do ratings affect how I appear in search?", a: "Yes. Workers with higher ratings and complete profiles tend to appear higher when employers browse and search." },
  { q: "Can I see reviews before hiring?", a: "Yes, a worker's profile shows their average rating and number of completed jobs so you can hire with confidence." },
  { q: "What happens if I get a bad rating?", a: "One low rating won't ruin your reputation. Keep doing good work and your average will recover over time." },
  { q: "Are ratings public?", a: "A worker's average rating and review count are visible to employers, helping them choose reliable people." },

  // ── Job completion & disputes ────────────────────────────────────────────
  { q: "How do I mark a job complete?", a: "Once the work is done and the worker has verified completion with their badge, open the job and tap Mark Complete to release payment." },
  { q: "How do I verify job completion as a worker?", a: "When you finish, ask the employer to scan your badge, or verify completion from your side so the employer can release your payout." },
  { q: "Why can't I mark a job complete?", a: "You can only mark a job complete after the worker has verified completion. Ask the worker to verify with their badge first." },
  { q: "How do I raise a dispute?", a: "Open the relevant job and tap 'Raise Dispute'. Our team reviews all disputes within 2 business hours and contacts both parties." },
  { q: "How long do disputes take to resolve?", a: "Our support team reviews disputes within 2 business hours and works with both sides to reach a fair resolution based on the evidence." },
  { q: "What happens during a dispute?", a: "We pause the payment, review the details from both parties and any evidence, and decide a fair outcome, which may include a refund or release." },
  { q: "Can I get a refund if the work was poor?", a: "If work isn't done as agreed, raise a dispute. Our team reviews it and may refund some or all of the escrow depending on the evidence." },
  { q: "What evidence should I provide for a dispute?", a: "Share photos, messages, or any proof of what was or wasn't done. Clear evidence helps our team resolve the case fairly and quickly." },
  { q: "The worker did only part of the job. What now?", a: "Raise a dispute and explain what was completed. Our team can arrange a partial payment or refund based on the work done." },
  { q: "Can I cancel after the job started?", a: "Once a job has started, cancelling should go through a dispute so any completed work is fairly accounted for." },

  // ── Categories & services ────────────────────────────────────────────────
  { q: "What kinds of jobs are on MpahMapu?", a: "Jobs span many categories including cleaning, events, security, driving, moving, gardening, cooking and construction help." },
  { q: "Can I hire cleaners?", a: "Yes. Post a cleaning job with the date, location and number of cleaners, and verified workers can apply or be invited directly." },
  { q: "Can I hire security guards?", a: "Yes. Choose the security category, set your schedule and location, and hire verified guards for your event or premises." },
  { q: "Can I hire event staff?", a: "Yes. Post an events job for waiters, ushers, setup crew and more, and hire the number of workers you need." },
  { q: "Can I hire a driver?", a: "Yes. Post a driving job with the schedule and route details, and verified drivers can apply." },
  { q: "Can I find movers or porters?", a: "Yes. Post a moving job describing the load and locations, and workers who do moving and lifting can apply." },
  { q: "Can I hire a gardener?", a: "Yes. Choose the gardening category, describe the work, and hire a worker for your outdoor space." },
  { q: "Can I hire a cook?", a: "Yes. Post a cooking job with the menu or event details, and workers with cooking experience can apply." },
  { q: "Do you have construction workers?", a: "Yes, you can hire construction helpers and labourers for building and renovation tasks through the construction category." },
  { q: "What category should I choose?", a: "Pick the category that best matches your task. It helps the right workers find your job and shows typical rates." },
  { q: "Can I hire for a one-day event?", a: "Yes. Set the date and duration for a single day, choose how many workers you need, and post the job." },
  { q: "Can I hire long-term or recurring workers?", a: "You can set longer durations like days, weeks or months when posting, and rehire workers you liked for future jobs." },
  { q: "What if my job doesn't fit a category?", a: "Choose the closest category and use the notes field to describe your specific needs, or ask support for guidance." },
  { q: "Do you offer household help?", a: "Yes, categories like cleaning, cooking and gardening cover common household tasks. Post the job and hire a verified worker." },
  { q: "Can I hire multiple types of workers for one event?", a: "Post separate jobs for each role, for example security and event staff, so the right workers apply to each." },

  // ── Rates, pricing & duration ────────────────────────────────────────────
  { q: "How are rates calculated?", a: "You set a rate per hour, day, week, month or year. The total is the rate multiplied by the duration and the number of workers." },
  { q: "Can I pay per day instead of per hour?", a: "Yes. When posting, choose the rate period, per hour, day, week, month or year, that suits your job." },
  { q: "What currency does MpahMapu use?", a: "All amounts are in Rwandan Francs (RWF)." },
  { q: "How do I know a fair rate to offer?", a: "When you pick a category, MpahMapu suggests typical rate ranges so you can offer a competitive, fair amount." },
  { q: "Can I negotiate the rate with a worker?", a: "The posted rate is what applicants agree to. For custom arrangements, use the notes or invite a specific worker with the terms you want." },
  { q: "How is the total cost shown before I pay?", a: "Before you pay, MpahMapu shows the job amount, the 5% escrow fee and the total to be held in escrow." },
  { q: "Do longer jobs cost more?", a: "Yes. The total is your rate multiplied by the duration and number of workers, so longer jobs cost more." },
  { q: "Can I offer a higher rate to attract workers?", a: "Yes, offering a competitive rate can attract more applicants and faster responses for urgent jobs." },
  { q: "What is the minimum rate I can set?", a: "Set a fair rate for the work. The posting screen will flag if a rate is too low to be valid." },
  { q: "Is the rate per worker or total?", a: "The rate you set is per worker. The escrow multiplies it by the number of workers you're hiring." },

  // ── Profile & onboarding ─────────────────────────────────────────────────
  { q: "How do I complete my profile?", a: "Add your specialties, education, availability and district, and submit your verification badge. A complete profile gets you noticed by employers." },
  { q: "What is profile completion?", a: "It's how much of your profile is filled in. Completing details is worth 80% and submitting your badge the final 20%." },
  { q: "How do I add my skills?", a: "In your profile, choose your service type and specialties so employers can find you for the right jobs." },
  { q: "How do I set my availability?", a: "In your profile, select the days or times you're available so you're matched with jobs that fit your schedule." },
  { q: "How do I add a profile photo?", a: "Upload a clear photo in your profile or during badge submission. A real photo builds trust with employers." },
  { q: "Why should I complete onboarding?", a: "Onboarding collects your role, location and service details so we can match you with the right jobs or workers." },
  { q: "What is an account type?", a: "Your account type can be Individual, Team, Company or Crew. Teams and companies can add members and a tax ID (TIN)." },
  { q: "Can I register as a company?", a: "Yes. Choose the Company account type during onboarding and add your TIN and team members if needed." },
  { q: "What is a TIN and do I need one?", a: "A TIN is a tax identification number. It's optional and used for team, company or crew accounts." },
  { q: "Can I add team members?", a: "Team, company and crew accounts can add member emails for notifications. Members don't get separate logins." },
  { q: "How do I update my district?", a: "Edit your location in your profile to set your district. This controls which nearby jobs and workers you're matched with." },
  { q: "What education level should I add?", a: "Add your highest education level honestly. It helps employers understand your background, though many jobs don't require formal education." },
  { q: "Can I list my equipment?", a: "Yes. In onboarding you can list equipment you have and whether it's available, which helps for jobs that need tools." },
  { q: "Why is my profile not approved yet?", a: "Worker profiles are reviewed by our team before approval. Make sure your details and badge are complete, then wait for the approval notice." },
  { q: "Do employers need onboarding?", a: "Employers provide their identifier, working location and service type. Once done, you can post and manage jobs." },

  // ── Cancellations & refunds ──────────────────────────────────────────────
  { q: "What is your cancellation policy?", a: "Free cancellation is available up to 2 hours before the scheduled start. Late cancellations may incur a 10% fee to compensate the worker." },
  { q: "How do I get a refund?", a: "Cancelling a job within policy refunds the escrow to your wallet automatically. For other cases, raise a dispute and our team will review it." },
  { q: "When am I charged a cancellation fee?", a: "A 10% fee may apply if you cancel within 2 hours of the start time, to compensate the worker for the short notice." },
  { q: "How long do refunds take?", a: "Refunds to your wallet are usually immediate. If you don't see it, check your transactions or contact support." },
  { q: "Can I get a full refund?", a: "Yes, if you cancel within the free-cancellation window or a dispute is resolved in your favour, the full escrow is refunded." },
  { q: "Where does my refund go?", a: "Refunds are returned to your MpahMapu wallet, from where you can reuse the balance or withdraw it to Mobile Money." },
  { q: "Can a worker cancel a job?", a: "Workers should only cancel if truly necessary, as it affects their rating. If you must, do it early and let the employer know." },
  { q: "What if I need to reschedule a job?", a: "Edit the job's date and time if it hasn't started, or cancel and repost. Let the worker know so they can adjust." },
  { q: "Do I lose the escrow fee on cancellation?", a: "When a job is cancelled within policy, the escrowed amount is refunded to your wallet. Late cancellations may keep a 10% worker fee." },
  { q: "Can I cancel just one worker from a multi-worker job?", a: "Adjust the headcount when editing the job if it hasn't started. For accepted workers, contact support or raise a dispute if needed." },

  // ── Referrals & rewards ──────────────────────────────────────────────────
  { q: "How does the referral program work?", a: "Share your referral code with friends. When they join and complete their first job, you earn a reward credited to your account." },
  { q: "Where do I find my referral code?", a: "Open the Referrals section of your dashboard to see your unique code and share link, plus your rewards so far." },
  { q: "How much do I earn per referral?", a: "You earn a set reward for each friend who joins with your code and completes their first job. The exact amount is shown in the Referrals section." },
  { q: "When do I get my referral reward?", a: "The reward is granted after the person you referred completes their first job on MpahMapu." },
  { q: "Can I refer both workers and employers?", a: "Yes, share your code with anyone. You're rewarded when they sign up and complete their first job." },
  { q: "How many people can I refer?", a: "There's no limit. Invite as many friends as you like and earn a reward for each qualifying referral." },
  { q: "My referral didn't count. Why?", a: "The reward is granted only after your friend completes their first job. Make sure they used your code at sign-up, then contact support if it's still missing." },
  { q: "Can I use someone else's referral code?", a: "Yes. Enter a referral code when you sign up to credit the person who invited you." },

  // ── Coverage, languages & the app ────────────────────────────────────────
  { q: "Where does MpahMapu operate?", a: "MpahMapu operates across Rwanda, with the strongest coverage in Rwanda and all provinces." },
  { q: "Is MpahMapu available in my area?", a: "MpahMapu covers all of Rwanda. Set your district so we can match you with nearby jobs and workers." },
  { q: "What languages does MpahMapu support?", a: "You can use MpahMapu in English, French, Swahili and Kinyarwanda. Switch languages from the menu anytime." },
  { q: "How do I change the language?", a: "Use the language switcher in the menu to choose English, French, Swahili or Kinyarwanda." },
  { q: "Is there a mobile app?", a: "MpahMapu works in your browser on phone and computer, and you can add it to your home screen for quick access." },
  { q: "Does MpahMapu work on my phone?", a: "Yes. MpahMapu is mobile-friendly and works in any modern phone browser." },
  { q: "Do I need internet to use MpahMapu?", a: "Yes, an internet connection is needed to browse jobs, chat and make payments." },
  { q: "Can I use MpahMapu on a computer?", a: "Yes, MpahMapu works fully in a desktop browser as well as on mobile." },
  { q: "How do I add MpahMapu to my home screen?", a: "Open MpahMapu in your phone browser and choose 'Add to Home Screen' from the browser menu for app-like access." },
  { q: "Which browsers are supported?", a: "MpahMapu works on modern browsers like Chrome, Safari, Edge and Firefox. Keep your browser updated for the best experience." },

  // ── Support & contact ────────────────────────────────────────────────────
  { q: "How do I contact support?", a: "Reach our team on WhatsApp at +250 781 121 117, by email at info@mpahmapu.com, or by phone at +250 781 121 117. I can also connect you to an agent here." },
  { q: "What is the support phone number?", a: "You can call or WhatsApp support at +250 781 121 117." },
  { q: "What is the support email?", a: "Email our team anytime at info@mpahmapu.com and we'll get back to you." },
  { q: "Can I chat with a human agent?", a: "Yes. If I can't answer your question, I'll log it and connect you with a live agent right here in this chat." },
  { q: "What are your support hours?", a: "Our team typically replies within 5 minutes during working hours, and we review disputes within 2 business hours." },
  { q: "How fast will I get a reply?", a: "Live chat usually gets a reply within about 5 minutes. Keep this tab open and an agent will respond here." },
  { q: "Can I reach you on WhatsApp?", a: "Yes, message us on WhatsApp at +250 781 121 117 for quick help." },
  { q: "Who are you?", a: "I'm BazaBot, your MpahMapu assistant. I can explain how the platform works, payments, verification, posting and finding jobs, and connect you to a human agent when needed." },
  { q: "What can you help me with?", a: "I can help with accounts, posting or finding jobs, payments and escrow, fees, verification, ratings, disputes and more. Just ask." },
  { q: "Are you a real person?", a: "I'm BazaBot, an automated assistant. For anything I can't handle, I'll connect you with a real support agent." },

  // ── Trust, policy & company ──────────────────────────────────────────────
  { q: "Is MpahMapu legit?", a: "Yes. MpahMapu is a genuine Rwandan workforce platform with verified workers, secure escrow payments and a support team that handles disputes." },
  { q: "Where can I read your privacy policy?", a: "You can read our privacy policy on the website's Privacy Policy page, linked in the footer." },
  { q: "Where are your terms and conditions?", a: "Our terms and conditions are available on the Terms page, linked in the footer of the website." },
  { q: "How does MpahMapu make money?", a: "MpahMapu charges an escrow service fee to employers and a commission on worker earnings to run and protect the service. The current rates are shown at checkout and in your earnings." },
  { q: "Who can use MpahMapu?", a: "Anyone in Rwanda looking to hire verified workers or to be hired for jobs can use MpahMapu. Sign up as an employer or a worker." },
  { q: "Is there a fee to join?", a: "No. Signing up is free. Fees only apply to jobs: an escrow service fee for employers and a commission on worker payouts, both shown before you confirm." },
  { q: "How do I give feedback about the platform?", a: "We'd love your feedback, send it to info@mpahmapu.com or share it with an agent in this chat." },
  { q: "Can businesses use MpahMapu?", a: "Yes. Businesses can register as Company accounts, add team members and a TIN, and hire workers at scale." },
  { q: "Is my personal information shared?", a: "We only use your information to run the platform and never sell it. See our privacy policy for full details." },
  { q: "What makes MpahMapu different?", a: "Verified workers, secure escrow payments, instant local matching across Rwanda, and fast human support set MpahMapu apart." },

  // ── Notifications & account management ───────────────────────────────────
  { q: "How do I turn on job alerts?", a: "Job alerts are on by default for active workers. Keep your profile and district set so you receive relevant notifications." },
  { q: "Why am I not getting notifications?", a: "Make sure your email is verified, your profile is active, and notifications aren't blocked in your browser or email spam folder." },
  { q: "How do I stop getting emails?", a: "You can manage email preferences from your account, or use the unsubscribe link at the bottom of our emails." },
  { q: "Where do I see my active jobs?", a: "Open your dashboard to see your active jobs, applications and their current status." },
  { q: "How do I see jobs I applied to?", a: "Workers can view all their applications and statuses in the Applications section of the dashboard." },
  { q: "How do I see who applied to my job?", a: "Open the job from your dashboard and tap Applications to review everyone who applied." },
  { q: "Can I see completed jobs?", a: "Yes, your dashboard keeps a history of completed jobs along with their ratings and payments." },
  { q: "How do I check a payment's status?", a: "Open your wallet to see each payment, payout or withdrawal with its current status, held, released, refunded or successful." },
  { q: "What does 'pending' mean on my application?", a: "'Pending' means the employer hasn't yet accepted or declined your application. You'll be notified when they respond." },
  { q: "What does 'held' mean on a payment?", a: "'Held' means the money is safely in escrow and will be released to the worker once the job is marked complete." },

  // ── Troubleshooting ──────────────────────────────────────────────────────
  { q: "My payment failed. What should I do?", a: "Check your MoMo or card balance and details, then try again. If it keeps failing, contact support and we'll help." },
  { q: "The app isn't loading. What do I do?", a: "Refresh the page, check your internet connection, and clear your browser cache. If it persists, tell us and we'll investigate." },
  { q: "I can't upload my ID photo.", a: "Make sure the file is a clear image and not too large. Try again on a stable connection, or contact support if it still fails." },
  { q: "My location isn't detecting.", a: "Allow location access in your browser, or set your district and drop a pin on the map manually when posting." },
  { q: "I entered the wrong details on a job. Can I fix it?", a: "Edit the job from your dashboard before it starts. Rate and category are locked, but most other details can be updated." },
  { q: "I was charged twice. What now?", a: "Check your wallet transactions first. If you see a duplicate charge, contact support with the details and we'll resolve it." },
  { q: "The worker's badge won't scan.", a: "Enter the badge ID manually on the verify page, or ask the worker to show their badge again in good lighting." },
  { q: "I can't mark my job complete.", a: "The worker must verify completion with their badge first. Once they do, the Mark Complete button becomes available." },
  { q: "My verification is taking too long.", a: "Reviews usually finish within a couple of business days. If it's much longer, contact support and we'll check your submission." },
  { q: "I didn't get my payout.", a: "Confirm the employer marked the job complete, then check your wallet. If the payout is missing, contact support with the job details." },

  // ── Misc & small talk ────────────────────────────────────────────────────
  { q: "Thank you", a: "You're welcome! 😊 Is there anything else I can help you with on MpahMapu?" },
  { q: "Goodbye", a: "Thanks for chatting! Have a great day, and come back anytime you need help on MpahMapu. 👋" },
  { q: "Good morning", a: "Good morning! ☀️ How can I help you with MpahMapu today?" },
  { q: "Are you there?", a: "Yes, I'm here and ready to help! What would you like to know about MpahMapu?" },
  { q: "Can you help me?", a: "Of course! Tell me what you need, whether it's posting a job, finding work, payments, verification or anything else." },
  { q: "I have a question", a: "Go ahead and ask, I'm happy to help with anything about MpahMapu." },
  { q: "That was helpful", a: "I'm glad that helped! 😊 Let me know if there's anything else you need." },
  { q: "How do I start earning?", a: "Sign up as a worker, complete your profile, get your badge verified, then apply to jobs or get invited through Hire Now to start earning." },
  { q: "How do I start hiring?", a: "Sign up as an employer or post as a guest, create a job with the details and rate, pay the escrow, and review applicants to hire." },
  { q: "Is my money safe with you?", a: "Yes. Funds are held in secure escrow and only released when a job is complete, protecting both employers and workers." },

  // ── More payments & Mobile Money ─────────────────────────────────────────
  { q: "Which MoMo number will be charged?", a: "The Mobile Money number you enter at checkout is the one charged. Make sure it has enough balance before you confirm." },
  { q: "Can I use a different phone number to pay?", a: "Yes. Enter whichever MTN or Airtel number you want to pay from at checkout, even if it's different from your account phone." },
  { q: "I approved the MoMo prompt but nothing happened.", a: "Give it a moment to confirm, then refresh your wallet. If the payment isn't reflected, check your MoMo messages and contact support if needed." },
  { q: "Can I pay in instalments?", a: "Jobs are funded in full into escrow when posted, so instalments aren't supported. You can top up your wallet gradually before posting." },
  { q: "Do you accept cash?", a: "No. To keep payments safe and traceable, MpahMapu uses Mobile Money and cards only, not cash." },
  { q: "Is there a payment confirmation?", a: "Yes. Successful payments appear instantly in your wallet transactions, and we email a confirmation." },
  { q: "Can I top up more than a job costs?", a: "Yes. You can keep extra balance in your wallet for future jobs or withdraw it to Mobile Money anytime." },
  { q: "What happens to leftover wallet balance?", a: "Any balance stays in your wallet for future jobs, or you can withdraw it to your MoMo or Airtel account." },
  { q: "Are there any hidden fees?", a: "No hidden fees. Employers see the escrow service fee before checkout, and workers see the commission on their payout - both shown clearly before you confirm." },
  { q: "Why is the total more than the rate?", a: "The employer total includes the workers' amount plus the 5% escrow handling fee, which is shown clearly before you pay." },

  // ── More about verification & badges ─────────────────────────────────────
  { q: "What documents do I need to get verified?", a: "You'll need a clear photo of yourself, your national ID, and your legal name as it appears on the ID." },
  { q: "Is verification mandatory?", a: "Workers need a verified badge to be trusted and hired widely. It's the best way to win employers' confidence." },
  { q: "Can I work before I'm verified?", a: "You can complete your profile and apply, but a verified badge greatly improves your chances and unlocks completion verification." },
  { q: "What is a badge ID?", a: "A badge ID is the unique identifier on your verification badge. Employers can enter it on the verify page to confirm you're genuine." },
  { q: "Where do I find my badge?", a: "Your verified badge, including its QR code and ID, appears in your profile once your submission is approved." },
  { q: "Can employers get verified too?", a: "Employers build trust through completed jobs and ratings. Workers see an employer's rating before accepting a Hire Now offer." },
  { q: "My badge was rejected. Why?", a: "A badge may be rejected if the photo or ID is unclear or the details don't match. Resubmit with clear images and correct information." },
  { q: "Can I update my badge details?", a: "Yes, you can resubmit your badge with updated photo, ID or legal name if something changes." },
  { q: "Does the badge expire?", a: "Your badge stays active while your account is in good standing. If anything changes, our team may ask you to re-verify." },
  { q: "How do employers know I'm real?", a: "Your verified badge, profile photo, ratings and completed job history all show employers you're a genuine, reliable worker." },

  // ── More for workers ─────────────────────────────────────────────────────
  { q: "How do I increase my chances of getting hired?", a: "Verify your badge, complete every profile field, keep your availability current, respond quickly, and maintain high ratings." },
  { q: "Can I set my own working hours?", a: "Yes. Set your availability in your profile and only apply to jobs whose schedule you can meet." },
  { q: "What if I can't make it to a job I accepted?", a: "Let the employer know as early as possible. Cancelling late affects your rating and may lead to a dispute, so avoid it when you can." },
  { q: "Will I be paid if the employer is unhappy?", a: "If the work was done as agreed, payment is released. If there's a disagreement, our team reviews the dispute fairly using the evidence." },
  { q: "How do I get repeat work from an employer?", a: "Do great work, be punctual and professional. Employers can re-invite workers they liked through Hire Now for future jobs." },
  { q: "Can I see how many jobs I've completed?", a: "Yes, your profile and dashboard show your completed jobs, which build your reputation and rating count." },
  { q: "Do I need my own tools?", a: "It depends on the job. Check the job notes; some employers provide tools, others expect you to bring your own." },
  { q: "How do I know where the job is?", a: "Accepted jobs show the province, district, precise map location and any notes the employer added about getting there." },
  { q: "What should I do when I arrive at a job?", a: "Check in with the employer, do the work as agreed, then verify completion with your badge so your payment can be released." },
  { q: "Can I bring a helper to a job?", a: "That's up to the employer. Discuss it through the job notes or with support; payment is based on the workers hired for the job." },

  // ── More for employers ───────────────────────────────────────────────────
  { q: "How many workers can I hire at once?", a: "Set any headcount you need when posting. The escrow covers all workers, and you can accept multiple applicants." },
  { q: "How do I hire the same worker again?", a: "Use Hire Now or Hire [name] to invite a worker you've worked with before directly to a new job." },
  { q: "Can I message a worker before hiring?", a: "You can review a worker's profile and ratings before inviting them. For coordination, use the job notes and our support if needed." },
  { q: "What if I need workers urgently?", a: "Post the job with an immediate or same-day start and a competitive rate; active nearby workers are notified right away." },
  { q: "Can I hire for recurring cleaning?", a: "Yes. Post with a longer duration or repost regularly, and rehire the same trusted worker through Hire Now." },
  { q: "How do I know a worker will show up?", a: "Hire verified workers with strong ratings and completed jobs. Escrow protects your money if a worker doesn't perform." },
  { q: "Can I set requirements like uniform or tools?", a: "Yes. Add requirements such as uniform, tools or attire in the job notes so applicants know what's expected." },
  { q: "What if I need to add more workers later?", a: "Edit the job to increase the headcount before it starts; the escrow adjusts for the extra workers." },
  { q: "Can I hire workers from a specific district?", a: "Set the job's district and location, and nearby workers are matched first so you get local applicants." },
  { q: "How do I give feedback on a worker?", a: "When you mark a job complete, rate the worker and add feedback about their performance." },

  // ── More categories & use cases ──────────────────────────────────────────
  { q: "Can I hire waiters for a wedding?", a: "Yes. Post an events job for the wedding date, choose how many waiters you need, and hire verified event staff." },
  { q: "Can I hire someone to clean after an event?", a: "Yes. Post a cleaning job for after the event with the location and time, and cleaners can apply." },
  { q: "Can I get help moving house?", a: "Yes. Post a moving job describing the items and both locations, and workers who do moving and lifting can apply." },
  { q: "Can I hire a night guard?", a: "Yes. Post a security job with night-time hours and your location to hire a verified guard." },
  { q: "Do you have painters?", a: "Painting falls under construction and handywork. Post the job describing the task and hire a suitable worker." },
  { q: "Can I hire dishwashers for a party?", a: "Yes. Post an events or cleaning job with the number of workers and time, and staff can apply." },
  { q: "Can I hire a driver for a day trip?", a: "Yes. Post a driving job with the date, route and hours, and verified drivers can apply." },
  { q: "Can I hire farm workers?", a: "Yes, post an agriculture or general labour job describing the work and location to find workers." },
  { q: "Can I hire someone to fetch and deliver?", a: "Yes. Post an errand or delivery job with the pickup and drop-off details, and nearby workers can help." },
  { q: "Do you have baby-sitting or house help?", a: "House help such as cleaning and cooking is available. Post the job with your needs and hire a verified worker." },

  // ── More disputes, safety & policy ───────────────────────────────────────
  { q: "What if a worker damages my property?", a: "Raise a dispute with photos and details. Our team reviews the case and works with both parties toward a fair resolution." },
  { q: "What if the employer asks me to do extra unpaid work?", a: "You only need to do the work agreed and paid for. If asked to do more, agree a new job or decline, and contact support if there's a problem." },
  { q: "Is it safe to share my phone number?", a: "Share only what's needed to coordinate a job. Keep sensitive details private and report anyone who behaves suspiciously." },
  { q: "How do I report a problem with a job?", a: "Open the job and raise a dispute, or contact support with the details. We review issues quickly." },
  { q: "What if I feel unsafe at a job?", a: "Leave if you feel unsafe and contact support immediately. Your safety comes first, and we'll help handle the situation." },
  { q: "Can I block a user?", a: "If someone is causing problems, report them to support with details and we'll take appropriate action." },
  { q: "What happens to users who break the rules?", a: "Users who violate our policies can be warned, suspended or removed to keep the community safe and trustworthy." },
  { q: "Do you protect against fraud?", a: "Yes. Verification, secure escrow and active monitoring help protect against fraud. Report anything suspicious to support." },
  { q: "Can I get a refund if a worker never came?", a: "Yes. Raise a dispute and, since your money is in escrow, our team can refund it if the worker didn't show up." },
  { q: "Who decides the outcome of a dispute?", a: "Our support team reviews the evidence from both sides and decides a fair outcome, which may be a full or partial refund or release." },

  // ── More account, profile & settings ─────────────────────────────────────
  { q: "How do I change my name?", a: "Update your name in your profile settings. If it's linked to your verified badge, you may need to resubmit for review." },
  { q: "How do I update my profile photo?", a: "Open your profile and upload a new clear photo. It helps build trust with employers." },
  { q: "Can I switch from worker to employer?", a: "Each role uses its own account. Create an employer account to hire, while keeping your worker account to be hired." },
  { q: "How do I keep my account secure?", a: "Use a strong password, enable two-factor authentication, and never share your login or verification codes with anyone." },
  { q: "Someone accessed my account. What do I do?", a: "Reset your password immediately, enable 2FA, and contact support so we can secure your account." },
  { q: "How do I log out?", a: "Open the menu and tap Log Out. On shared devices, always log out when you're done." },
  { q: "Why was my account suspended?", a: "Accounts may be suspended for policy violations or suspicious activity. Contact support to understand the reason and next steps." },
  { q: "Can I reactivate a suspended account?", a: "Contact support to review your case. If the issue is resolved, we can help restore your access." },
  { q: "How do I update my availability?", a: "Edit the availability section in your profile to reflect the days and times you can work." },
  { q: "Do you send SMS notifications?", a: "We primarily notify you by email and in-app. Keep your email verified so you don't miss job updates." },

  // ── More small talk & guidance ───────────────────────────────────────────
  { q: "What should I do first?", a: "If you want to work, sign up as a worker and complete your profile. If you want to hire, post a job. I can guide you through either." },
  { q: "How do I get started on MpahMapu?", a: "Open the website and tap Sign Up. Choose Worker (to be hired) or Employer (to hire). Enter your name, email, phone and a password. Workers then do a short onboarding - date of birth, education, the service categories you work in, account type, your district, equipment and availability - and submit a verification badge to get approved. It's all in the browser; there's no app to download." },
  { q: "What are the steps to sign up as a worker?", a: "1) Tap Sign Up and choose Worker. 2) Enter your name, email, phone and password. 3) Complete onboarding: date of birth, education level, the categories you work in (e.g. Cleaning, Electrical, Security), account type, your province and district, equipment and availability. 4) Submit your verification badge with your national ID to get approved. Then you can apply to jobs or be invited through Hire Now." },
  { q: "I'm new here, where do I begin?", a: "Welcome! Choose whether you want to hire or be hired, then create your account. Ask me anything as you go." },
  { q: "Can you explain how it works simply?", a: "Employers post jobs and pay into secure escrow; workers get hired, do the job, verify it, and get paid to their wallet. I'm here to help at each step." },
  { q: "Do you have any tips for me?", a: "Keep your profile complete and verified, respond quickly, be reliable, and maintain high ratings, that's the recipe for success on MpahMapu." },
  { q: "How do I make more money on MpahMapu?", a: "Get verified, keep a high rating, stay available, apply promptly, and take on more jobs to grow your earnings." },
  { q: "What is BazaBot?", a: "BazaBot is me, your MpahMapu virtual assistant. I answer questions instantly and connect you to a human agent when you need one." },
  { q: "Can you speak other languages?", a: "Yes, I understand English, French, Swahili and Kinyarwanda, and I try to reply in the language you write in." },
  { q: "I need more help", a: "No problem, I can connect you with a human support agent who'll assist you right here in this chat." },
  { q: "How do I talk to a human?", a: "Just let me know, or ask a question I can't fully answer, and I'll route you to a live agent in this chat." },
  { q: "Okay thanks a lot", a: "Anytime! 😊 I'm here whenever you need help with MpahMapu." },
];

// Precomputed question token sets + inverse-document-frequency weights so that
// distinctive words (e.g. "refund", "escrow") count far more than common ones
// (e.g. "work", "job") when scoring a match.
const INDEX = KNOWLEDGE.map(e => ({ a: e.a, qlen: e.q.length, qt: new Set(tokens(e.q)), lean: leanOf(e.q) }));
const DF = new Map<string, number>();
for (const e of INDEX) for (const t of e.qt) DF.set(t, (DF.get(t) ?? 0) + 1);
const N = INDEX.length;
function idf(t: string): number {
  return Math.log((N + 1) / ((DF.get(t) ?? 0) + 1)) + 0.05;
}

/**
 * Returns the best-matching answer for a message, or null if nothing is
 * confident enough. Scores by the IDF-weighted overlap between the message and
 * each question, and only accepts a match that covers most of the message's
 * distinctive words - so vague or unknown messages fall through to an agent.
 *
 * When two answers are equally relevant (e.g. "how do I withdraw" matches both
 * "withdraw money from wallet" and "withdraw a job application"), the visitor's
 * role breaks the tie: an employer prefers employer/neutral answers, a worker
 * prefers worker/neutral ones, so everyone gets the answer meant for them.
 */
export function matchKnowledge(message: string, role: Audience = "public"): string | null {
  const seen = new Set(tokens(message));
  if (seen.size === 0) return null;

  let queryWeight = 0;
  seen.forEach(w => { queryWeight += idf(w); });

  const wanted = role === "owner" ? "employer" : role === "seeker" ? "worker" : null;
  // 2 = written for this visitor's role, 1 = role-neutral, 0 = the other role.
  const roleScore = (lean: "worker" | "employer" | null) =>
    wanted === null ? (lean === null ? 1 : 0) : lean === wanted ? 2 : lean === null ? 1 : 0;

  let best: { a: string; qlen: number; score: number; rs: number } | null = null;
  for (const e of INDEX) {
    let score = 0;
    seen.forEach(w => { if (e.qt.has(w)) score += idf(w); });
    if (score <= 0) continue;
    const rs = roleScore(e.lean);
    if (!best || score > best.score ||
        (score === best.score && (rs > best.rs || (rs === best.rs && e.qlen < best.qlen)))) {
      best = { a: e.a, qlen: e.qlen, score, rs };
    }
  }

  // Accept only if the match covers at least half the message's information.
  return best && best.score >= 0.5 * queryWeight ? best.a : null;
}

export const KNOWLEDGE_COUNT = KNOWLEDGE.length;
