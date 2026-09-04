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
      "You will see the matched motari's name, photo, plate number and star rating, track them live on the map, and pay cash or " +
      "mobile money at the end. You can rate the driver after the ride, and the motari rates you too.",
  },
  {
    id: "guide-ride-runs-itself",
    title: "How a ride runs itself: no buttons to press",
    category: "guide",
    text: "Once a motari has accepted, the ride mostly looks after itself and neither side has to keep tapping. " +
      "The motari taps 'I have arrived' at the pickup, and that is normally the last thing they press. " +
      "The ride starts on its own when both phones pull away from the pickup together, so nobody presses start. " +
      "About a kilometre from the destination the passenger is asked to settle the fare, with the amount already set. " +
      "The ride completes on its own when the phones come within about 400 metres of the destination, and if the fare " +
      "was already paid the whole ride closes there. A destination typed as free text has no coordinates to sense, so " +
      "for those rides the motari still taps Complete ride.",
  },
  {
    id: "policy-paying-for-a-ride",
    title: "Paying for a ride: mobile money and cash",
    category: "policy",
    text: "The platform works out how the fare was paid, so the motari is never asked to pick a payment method. " +
      "Paying through the platform sends a mobile money prompt to the passenger's phone; when the money lands the ride " +
      "is marked paid and the motari's share reaches their wallet at once, with instant payout if they have it switched on. " +
      "Paying in cash is one tap by the passenger: 'I paid cash'. That declaration stands on its own after 20 minutes " +
      "and the ride closes as paid. Within that window, and afterwards too, the motari can say 'I was not paid', which " +
      "reopens the ride as unpaid. A ride only ever counts once towards a motari's totals and daily fee, however many " +
      "times its payment is disputed and settled again.",
  },
  {
    id: "policy-motari-daily-fee",
    title: "The motari daily fee",
    category: "policy",
    text: "A motari pays a flat daily platform fee of 500 RWF, but only for a day they actually worked: a day with " +
      "fewer than 3 rides costs nothing at all. The fee for a day appears once that day ends, and unpaid days add up. " +
      "After 3 unpaid days (1,500 RWF) the account is paused: no ride or courier requests reach the motari and they " +
      "cannot accept until the balance is cleared, with the app saying the account is inactive. Paying is one tap: " +
      "Pay now sends a mobile money prompt for the outstanding amount to the motari's phone, and the account reopens " +
      "as soon as the money lands. If a prompt fails or expires, the app offers Try again. The fee is shown on the " +
      "top bar of the driver app from 4pm through 8am, and any time of day in the Money tab.",
  },
  {
    id: "guide-courier",
    title: "Courier: send a parcel by motari (gutwara imizigo)",
    category: "guide",
    text: "The Ask Motari page carries parcels as well as people. Switch from Motari to Courier at the top of the " +
      "request panel: a counter next to it shows how many motari are available for parcels right now and how far the " +
      "closest one is. Set the pickup and where it is going, optionally say what you are sending, and name your price. " +
      "A courier request starts at 1,000 RWF, higher than a passenger ride, because the motari makes the whole trip " +
      "for the parcel. Everything else works the same: a nearby motari accepts, you track them live, and you pay cash " +
      "or through the platform. Motari carry parcels by default and can switch it off under More on their dashboard, " +
      "so courier requests only reach drivers who want them.",
  },
  {
    id: "guide-become-motari",
    title: "Become a motari (moto taxi driver)",
    category: "guide",
    text: "Motari have their own registration, separate from worker and employer signup. Open Ask Motari and choose " +
      "'Register as motari' in the menu (also linked from the site footer and the signup page). One form collects your " +
      "legal name as written on your ID, plate number, moto brand or model, phone number, email and password. Every " +
      "field is checked as you fill it in and the form will not submit while anything is wrong. The moto details are " +
      "saved with the account when you press create, not afterwards, so there is no second form and nobody ends up " +
      "registered with no moto. Verify the six digit code emailed to you " +
      "and you land on the driver dashboard at /drive. It works like the passenger app: a live map with passengers " +
      "seeking rides shown as pins, an online/offline toggle, and a bottom panel with four tabs. Rides: accept nearby " +
      "requests and run the trip. Money: wallet balance, total collected, total paid out and every payout with its " +
      "status (cash fares are yours on the spot; platform fares land minus commission). Trips: recent travels and " +
      "travellers with fares and ratings. Settings: turn instant payout on so each platform fare is sent straight to " +
      "your MTN MoMo or Airtel Money number instead of resting in the wallet, choose that number, carry parcels or " +
      "not, ask support to change your account number, raise a complaint, and log out. The session " +
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
      "nearby motari at a time for 40 seconds, and the scan widens 1 km at a time up to 15 km until a motari accepts.",
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
    id: "guide-download-the-app",
    title: "Downloading and installing the Ask Motari app",
    category: "guide",
    text: "Ask Motari is an Android app, downloaded from the app page of this site rather than from the Play Store. " +
      "The page asks the server what has actually been published before it shows a button, so a missing button means " +
      "there is no build up yet rather than a link that will fail; the version and the file size are shown next to it. " +
      "To install: tap Download for Android and the file lands in your Downloads. Open it. Android will ask whether to " +
      "allow installing apps from this source, which it asks for anything outside the Play Store; allow it. Tap Install, " +
      "then Open. Then say yes to location, notifications and sound, because a motari cannot be found by a passenger, " +
      "or hear work arriving while the phone is in a pocket, without them. Updating is the same download again, " +
      "installed over the top; the account and history stay. There is no iPhone build: on an iPhone, open the Ask " +
      "Motari page in Safari and use Share then Add to Home Screen, which gives a full screen app from the home screen. " +
      "Nothing has to be installed at all to ask for a moto, on any phone: the website does the whole job. The app is " +
      "worth having for a motari, whose work depends on hearing an offer arrive. The Get the app link sits in the " +
      "footer and on the motari, drive, jobs, browse, about, donate and help pages.",
  },
  {
    id: "guide-motari-registration",
    title: "Registering as a motari, field by field",
    category: "guide",
    text: "One form, opened from Ask Motari's menu, the site footer or the sign in page. Legal name: both your names " +
      "as written on your ID. Plate number: typed however you like, with or without a space and in any case, and shown " +
      "back in the standard shape RA 123B. Brand or model of the moto. Phone number: a Rwandan number passengers can " +
      "call. Email: an address you can open, because a six digit code is sent to it. Password: at least eight " +
      "characters, with an eye to show what you typed. Each field checks itself once you leave it and keeps checking " +
      "as you correct it, turning red with the reason underneath, and the create button stays refused while anything " +
      "is wrong. The plate is checked with RURA about two seconds after you stop typing, without waiting for you to " +
      "leave the field. Everything, moto included, is saved when the account is created. After the code, the driver " +
      "dashboard. An admin verifies the moto before passengers see you as verified, but you can go online and work " +
      "while that is pending. Registration costs nothing.",
  },
  {
    id: "help-plate-not-accepted",
    title: "When a plate number is not accepted",
    category: "help",
    text: "The registration form asks RURA about every plate and will not let an unconfirmed one through, because the " +
      "plate is what a passenger checks before getting onto a stranger's moto. Three different answers, and they mean " +
      "different things. 'RURA has no record of this plate' means the regulator does not know it: read the plate off " +
      "the moto again, letter by letter, and mind the letters that look like digits. 'A real plate, but another motari " +
      "has already registered it' means the plate is genuine and simply spoken for, because no plate can belong to two " +
      "accounts; if the moto is genuinely yours, support can sort it out, and there is nothing to argue with RURA " +
      "about. 'We could not reach RURA to confirm this plate' is about the check, not about you: it failed to run, so " +
      "the answer is neither yes nor no, and trying again in a moment usually works. Nothing goes through unconfirmed, " +
      "and there is no way to skip the check.",
  },
  {
    id: "guide-motari-invites",
    title: "Inviting other motari, and the bonuses",
    category: "guide",
    text: "Every motari has an invite link, shown in the Settings tab of the driver app and on the web. Somebody who " +
      "signs up through it sees who invited them on the registration page, by name, and is recorded as invited by you. " +
      "The referral reward is paid at the moment they register rather than waiting for their first ride, and the new " +
      "motari may receive a welcome bonus of their own. Bonus money lands in the same wallet as fares and is withdrawn " +
      "the same way, with one difference: no withdrawal fee is taken from it. Other bonuses can be running at any " +
      "time, set by the platform: for a number of rides, for kilometres covered, for a run of good ratings, or for " +
      "paying the daily fee without falling behind. What is currently on offer is shown in the app's rewards screen.",
  },
  {
    id: "help-motari-account-blocked",
    title: "A motari account that will not work",
    category: "help",
    text: "Two different things read alike from inside the app. Unpaid daily fees pause an account: after three unpaid " +
      "days no ride or courier request reaches the motari and none can be accepted, and the app says the account is " +
      "inactive. That one is self service, Pay now in the Money tab sends a mobile money prompt for the outstanding " +
      "amount and the account reopens the moment the money lands. Suspension is the other: an admin has closed the " +
      "account, and then the app says the account has been suspended or deactivated and signs the person out. Nothing " +
      "the motari does reopens that one; support has to. A suspended account cannot use the service at all, on any " +
      "device, from the moment it is suspended.",
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
