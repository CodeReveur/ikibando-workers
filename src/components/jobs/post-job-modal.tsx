"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  X, Calendar, Clock, Users, ChevronDown,
  CheckCircle, AlarmClock, Loader2, Navigation, Search, MapPin,
} from "lucide-react";
import { JOB_CATEGORIES, RWANDA_PROVINCES, CURRENCY, MIN_RATE_BY_PERIOD } from "@/lib/constants";
import { geoSectors, geoCells, geoVillages } from "@/lib/rwanda-geo";
import { forwardGeocode } from "@/lib/geocoding";
import { postJob, postGuestJob, getWallet, apiError, checkGuestAccount, getPricingConfig, getJobCategories, workerCommissionOf, employerServiceFeeOf, employerServiceFeeRateOf, DEFAULT_PRICING, type PricingConfig, type PaymentMode, type JobCategoryMeta } from "@/lib/api";
import { getReferralCode } from "@/lib/referral";
import { runWalletTopup, runGuestPayment, isCardMethod, type PayMethod } from "@/lib/pay-flow";
import { saveRedirect } from "@/lib/auth-redirect";
import { useToast } from "@/components/ui/toast";
import { RichTextEditor, RichTextDisplay } from "@/components/ui/rich-text-editor";
import { useSession, type Session } from "@/components/dashboard/session-ctx";
import { PayMethodSelector, payFieldsOf, type PayMethodValue, type SelectedMethod } from "@/components/ui/pay-logos";
import { DonationAddon } from "@/components/donate/donation-addon";

// Leaflet must render client-side only
const MapPicker = dynamic(
  () => import("./map-picker").then(m => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: 220, borderRadius: 10, border: "1px solid #2a2a2a",
        background: "#141414", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 12, color: "#555",
      }}>
        Loading map…
      </div>
    ),
  }
);

type RateType = "hr" | "day" | "week" | "month" | "year";
const getDurations = (rt: RateType) => {
  if (rt === "hr") return [1, 2, 3, 4, 6, 8, 10, 12];
  if (rt === "day") return Array.from({length: 30}, (_, i) => i + 1);
  if (rt === "week") return Array.from({length: 12}, (_, i) => i + 1);
  if (rt === "month") return Array.from({length: 12}, (_, i) => i + 1);
  if (rt === "year") return Array.from({length: 5}, (_, i) => i + 1);
  return [1];
};
const getUnit = (rt: RateType, n: number) => {
  if (rt === "hr") return `hour${n !== 1 ? "s" : ""}`;
  if (rt === "day") return `day${n !== 1 ? "s" : ""}`;
  if (rt === "week") return `week${n !== 1 ? "s" : ""}`;
  if (rt === "month") return `month${n !== 1 ? "s" : ""}`;
  if (rt === "year") return `year${n !== 1 ? "s" : ""}`;
  return "";
};
const RATE_LABEL: Record<RateType, string> = { hr:"/hr", day:"/day", week:"/wk", month:"/mo", year:"/yr" };

// The 8 installment payment modes the employer chooses, and the pricing/threshold unit each maps to.
// The worker can then request payment after each completed period (Duration = number of periods).
const PAYMENT_MODES: { value: PaymentMode; label: string; rt: RateType }[] = [
  { value: "HOURLY",        label: "Hourly",        rt: "hr" },
  { value: "CUSTOM_HOURS",  label: "Custom Hours",  rt: "hr" },
  { value: "DAILY",         label: "Daily",         rt: "day" },
  { value: "CUSTOM_DAYS",   label: "Custom Days",   rt: "day" },
  { value: "WEEKLY",        label: "Weekly",        rt: "week" },
  { value: "MONTHLY",       label: "Monthly",       rt: "month" },
  { value: "CUSTOM_MONTHS", label: "Custom Months", rt: "month" },
  { value: "YEARLY",        label: "Yearly",        rt: "year" },
];
const todayStr  = () => new Date().toISOString().split("T")[0];
const fmt       = (n: number) => `${CURRENCY} ${n.toLocaleString()}`;

type Province = (typeof RWANDA_PROVINCES)[number];
type Category = (typeof JOB_CATEGORIES)[number];

function allDistricts(): string[] {
  return RWANDA_PROVINCES.flatMap(p => [...p.districts]);
}
function districtsFor(province: string): string[] {
  const p = RWANDA_PROVINCES.find(p => p.label === province);
  return p ? [...p.districts] : allDistricts();
}


// ── types ────────────────────────────────────────────────────────────────────
interface JobForm {
  category: string;
  headcount: string;
  date: string;
  time: string;
  durationHours: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  street: string;
  houseNumber: string;
  latitude:  number | null;
  longitude: number | null;
  ratePerHour: string;
  rateType: RateType;
  paymentMode: PaymentMode;
  paymentInterval: string;
  notes: string;
  requirements: string;
}

const STEPS = ["Job details", "Review & post"];

// Shown when a guest's contact details already belong to a worker (seeker) account.
const WORKER_ACCOUNT_MSG =
  "These details match a worker account, so you can't post as an employer with this email. Please use a new email, or an existing employer email.";

// ── styles ───────────────────────────────────────────────────────────────────
const CSS = `
  .pj-ta { resize: vertical; }
  @media (max-width: 500px) { .pj-2col { grid-template-columns: 1fr !important; } }
`;
const inp: React.CSSProperties = {
  width: "100%", background: "#141414", border: "1px solid #2a2a2a",
  borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#f0f0f0",
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const modalCard: React.CSSProperties = {
  background: "#1a1a1a", border: "1px solid #272727", borderRadius: 20,
  width: "100%", maxWidth: 520, maxHeight: "92vh",
  display: "flex", flexDirection: "column", overflow: "hidden",
};
const btnPrimary: React.CSSProperties = {
  background: "#f97316", color: "#fff", border: "none",
  borderRadius: 10, padding: "12px 20px", fontSize: 13,
  fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};
const btnBack: React.CSSProperties = {
  background: "#141414", border: "1px solid #2a2a2a",
  borderRadius: 10, padding: "12px 18px", fontSize: 13,
  fontWeight: 600, color: "#aaa", cursor: "pointer", fontFamily: "inherit",
};
const iconL: React.CSSProperties = {
  position: "absolute", left: 12, top: "50%",
  transform: "translateY(-50%)", pointerEvents: "none",
};

// ── component ────────────────────────────────────────────────────────────────
import { useLanguage } from "@/lib/language-context";

export function PostJobModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const { error: toastError, success: toastSuccess } = useToast();
  const [step, setStep]           = useState(0);
  const [done, setDone]           = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [walletBal, setWalletBal] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const ctxSession = useSession();
  // These modals also open on public pages where SessionProvider isn't mounted, so the
  // context is null there. Fall back to the persisted "user" in localStorage - the same
  // source the navbar uses to detect a logged-in user.
  const [lsUser] = useState<Session | null>(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  });
  const session = ctxSession ?? lsUser;
  const hasSession = !!(session && session.role === "EMPLOYER");

  // Anonymous user fields
  const [anonName, setAnonName] = useState("");
  const [anonEmail, setAnonEmail] = useState("");
  const [anonPhone, setAnonPhone] = useState("");
  // Guard: guest contact details must not match a worker (seeker) account.
  const [acctCheck, setAcctCheck] = useState<"idle" | "checking" | "ok" | "worker">("idle");

  // Payment method fields. Card details are collected on XentriPay's secure page (redirect),
  // so we only keep the selected method + the mobile-money phone here.
  const [payMethod, setPayMethod] = useState<"WALLET" | "MTN_MOMO" | "AIRTEL_MONEY" | "VISA" | "MASTERCARD">("MTN_MOMO");
  const [selMethod, setSelMethod] = useState<SelectedMethod | null>(null);
  const [donationRwf, setDonationRwf] = useState(0);
  // Job title: confirmed in a modal on the final Post click. Defaults to the category name,
  // but the employer can rename it (it stays a job in that category).
  const [jobTitle, setJobTitle] = useState("");
  const [titleModalOpen, setTitleModalOpen] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [payNote, setPayNote] = useState("");
  // When on, a worker's per-period payment request pays out immediately (no manual approval).
  const [directRelease, setDirectRelease] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return !!JSON.parse(localStorage.getItem("user") || "null")?.defaultAutoRelease; } catch { return false; }
  });  // defaults OFF; respects the employer account default

  const [job, setJob] = useState<JobForm>({
    category: "", headcount: "1", date: "", time: "",
    durationHours: "4", province: "", district: "",
    sector: "", cell: "", village: "",
    street: "", houseNumber: "",
    latitude: null, longitude: null,
    ratePerHour: "", rateType: "hr", paymentMode: "HOURLY", paymentInterval: "1", notes: "", requirements: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof JobForm, string>>>({});

  // Live platform charges (admin-configurable); falls back to defaults until loaded.
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  useEffect(() => { getPricingConfig().then(setPricing).catch(() => {}); }, []);

  // Job categories from the admin-managed database, so a category added there is immediately
  // postable. Falls back to the built-in list until the DB list loads.
  const [dbCats, setDbCats] = useState<JobCategoryMeta[]>([]);
  useEffect(() => { getJobCategories().then(setDbCats).catch(() => {}); }, []);

  const DRAFT_KEY = "MpahMapu_draft_postjob";

  const getUnit = (rt: RateType, n: number) => {
    if (rt === "hr") return t(n !== 1 ? "post_job.units.hours" : "post_job.units.hour") || `hour${n !== 1 ? "s" : ""}`;
    if (rt === "day") return t(n !== 1 ? "post_job.units.days" : "post_job.units.day") || `day${n !== 1 ? "s" : ""}`;
    if (rt === "week") return t(n !== 1 ? "post_job.units.weeks" : "post_job.units.week") || `week${n !== 1 ? "s" : ""}`;
    if (rt === "month") return t(n !== 1 ? "post_job.units.months" : "post_job.units.month") || `month${n !== 1 ? "s" : ""}`;
    if (rt === "year") return t(n !== 1 ? "post_job.units.years" : "post_job.units.year") || `year${n !== 1 ? "s" : ""}`;
    return "";
  };

  const getLocalizedCategoryLabel = (value: string) => {
    const defaultLabel = dbCats.find(c => c.slug === value)?.displayName
      ?? JOB_CATEGORIES.find(c => c.value === value)?.label ?? value;
    return t(`common.categories.${value}`) || defaultLabel;
  };

  // Category options come from the admin-managed DB (new categories appear at once); the built-in
  // list is only a fallback until the DB list loads.
  const categoryOptions = dbCats.length
    ? dbCats.map(c => ({ value: c.slug, label: getLocalizedCategoryLabel(c.slug) }))
    : JOB_CATEGORIES.map(c => ({ value: c.value, label: getLocalizedCategoryLabel(c.value) }));

  const getLocalizedProvinceLabel = (prov: string) => {
    if (!prov) return "";
    const key = prov.toLowerCase().replace(/\s+/g, "_");
    return t(`common.provinces.${key}`) || prov;
  };

  const stepsList = hasSession 
    ? [t("post_job.steps.details") || "Job details", t("post_job.steps.review") || "Review & Payment"]
    : [t("post_job.steps.details") || "Job details", "Account details", t("post_job.steps.review") || "Review & Payment"];

  // Wallet is the implicit money source for logged-in employers; MoMo/Airtel/Card
  // are only used to top up a short wallet (or as direct payment for guests).
  useEffect(() => {
    setPayMethod("MTN_MOMO");
  }, [hasSession]);

  // Restore draft on open
  useEffect(() => {
    try {
      const t = localStorage.getItem("access_token");
      if (t) {
        setToken(t);
        getWallet(t).then(w => setWalletBal(w.balance)).catch(() => {});
      }
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const { job: saved, step: savedStep } = JSON.parse(raw);
        if (saved) setJob(f => ({ ...f, ...saved }));
        if (typeof savedStep === "number") setStep(savedStep);
      }
    } catch {}
  }, []);

  // Save draft on change
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ job, step })); } catch {}
  }, [job, step]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Move the map to the chosen admin location: forward-geocode the deepest level available
  // (village → cell → sector → district), falling back to a broader query if a precise one misses.
  useEffect(() => {
    if (!job.district) return;
    const parts = [job.village, job.cell, job.sector, job.district].filter(Boolean) as string[];
    if (parts.length === 0) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      for (let i = 0; i < parts.length; i++) {
        const query = [...parts.slice(i), job.province || "", "Rwanda"].filter(Boolean).join(", ");
        const hit = await forwardGeocode(query);
        if (cancelled) return;
        if (hit) {
          setJob(f => ({ ...f, latitude: hit.latitude, longitude: hit.longitude }));
          return;
        }
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.province, job.district, job.sector, job.cell, job.village]);

  // Escape to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  // Run the worker-account check shortly after the guest finishes entering email + phone,
  // so the result is ready before they try to advance to the summary.
  useEffect(() => {
    if (hasSession) { setAcctCheck("idle"); return; }
    const email = anonEmail.trim();
    const phone = anonPhone.trim();
    if (!email || !phone) { setAcctCheck("idle"); return; }
    setAcctCheck("checking");
    const id = setTimeout(() => {
      checkGuestAccount({ email, phone })
        .then(r => setAcctCheck(r.isWorker ? "worker" : "ok"))
        .catch(() => setAcctCheck("ok")); // network hiccup: the server-side guard still blocks it
    }, 500);
    return () => clearTimeout(id);
  }, [anonEmail, anonPhone, hasSession]);

  function detectGps() {
    if (!navigator.geolocation) { setGpsStatus("error"); return; }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setJob(f => ({
          ...f,
          latitude:  +pos.coords.latitude.toFixed(7),
          longitude: +pos.coords.longitude.toFixed(7),
        }));
        setGpsStatus("ok");
      },
      () => setGpsStatus("error"),
      { timeout: 10000 }
    );
  }

  function validateStep0() {
    const errs: typeof errors = {};
    if (!job.category)     errs.category  = t("post_job.errors.required") || "Required";
    if (!job.date)         errs.date      = t("post_job.errors.required") || "Required";
    if (!job.time)         errs.time      = t("post_job.errors.required") || "Required";
    if (!job.district)     errs.district  = t("post_job.errors.required") || "Required";
    // Precise destination for worker navigation: require a street/avenue name OR a map pin.
    const hasPin = job.latitude != null && job.longitude != null;
    if (!job.street.trim() && !hasPin) {
      errs.street = t("post_job.errors.street_or_pin") || "Enter the street/avenue (and house number), or drop a pin on the map";
    }
    const minRate = MIN_RATE_BY_PERIOD[job.rateType];
    if (!job.ratePerHour || parseInt(job.ratePerHour) < minRate) {
      errs.ratePerHour = `Minimum is ${fmt(minRate)} ${RATE_LABEL[job.rateType]}`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleNext() {
    if (step === 0) {
      if (validateStep0()) {
        setErrors({});
        setStep(1);
      } else {
        toastError(t("post_job.errors.incomplete_form") || "Please fill in all required fields.", { title: t("post_job.errors.incomplete_form_title") || "Incomplete Form" });
      }
    } else if (step === 1 && !hasSession) {
      if (!anonName || !anonEmail || !anonPhone) {
        toastError("Please fill in all account fields.", { title: "Incomplete Form" });
        return;
      }
      if (acctCheck === "worker") {
        toastError(WORKER_ACCOUNT_MSG, { title: "Worker account" });
        return;
      }
      // Don't advance to the summary until the worker-account check has finished.
      if (acctCheck !== "ok") {
        setAcctCheck("checking");
        try {
          const r = await checkGuestAccount({ email: anonEmail.trim(), phone: anonPhone.trim() });
          if (r.isWorker) { setAcctCheck("worker"); toastError(WORKER_ACCOUNT_MSG, { title: "Worker account" }); return; }
          setAcctCheck("ok");
        } catch { setAcctCheck("ok"); }
      }
      setStep(2);
    }
  }

  async function handlePost() {
    setSubmitting(true);
    try {
      const startTime = job.date && job.time
        ? `${job.date}T${job.time}:00Z`
        : new Date().toISOString();

      const rateType = job.rateType === "hr" ? "PER_HOUR"
        : job.rateType === "day" ? "PER_DAY"
        : job.rateType === "week" ? "PER_WEEK"
        : job.rateType === "month" ? "PER_MONTH" : "PER_YEAR";

      // The employer picks the payment mode explicitly; the duration count is the number of
      // billable periods the worker can request payment for, one at a time.
      const paymentMode = job.paymentMode;
      const totalUnits = parseInt(job.durationHours) || 1;   // Duration = total work length
      const paymentInterval = Math.max(1, parseInt(job.paymentInterval) || 1); // Threshold
      const paymentPeriods = Math.max(1, Math.ceil(totalUnits / paymentInterval)); // parts of duration

      const jobPayload = {
        category:      job.category,
        title:         jobTitle.trim() || undefined,
        province:      job.province || undefined,
        district:      job.district,
        sector:        job.sector  || undefined,
        cell:          job.cell    || undefined,
        village:       job.village || undefined,
        latitude:      job.latitude  ?? undefined,
        longitude:     job.longitude ?? undefined,
        street:        job.street.trim()      || undefined,
        houseNumber:   job.houseNumber.trim() || undefined,
        ratePerHour:   parseInt(job.ratePerHour),
        headcount:     parseInt(job.headcount) || 1,
        urgency:       "SAME_DAY" as const,
        startTime,
        durationHours: totalUnits,
        rateType,
        paymentMode: paymentMode as import("@/lib/api").PaymentMode,
        paymentPeriods,
        paymentInterval,
        directRelease,
        locationNotes: job.notes || undefined,
        requirements: job.requirements || undefined,
        donationRwf: donationRwf > 0 ? donationRwf : undefined,
      };

      // payMethod is one of the 4 gateway methods (default MTN_MOMO); WALLET is never selected.
      const method = (payMethod === "WALLET" ? "MTN_MOMO" : payMethod) as PayMethod;
      const card = isCardMethod(method);
      const awaitingNote = card
        ? "Opening the secure card page… complete your payment there."
        : "Sent a prompt to your phone - approve it to continue.";

      if (!hasSession) {
        // Guest: take the real payment first (phase 1), then create the job (phase 2).
        const guestPayload = {
          job: jobPayload,
          guestName:  anonName,
          guestEmail: anonEmail,
          guestPhone: anonPhone,
          paymentMethod: method,
          paymentPhone: paymentPhone || anonPhone || undefined,
          referralCode: getReferralCode(),
          ...payFieldsOf(selMethod),
        };
        setPayNote(awaitingNote);
        const outcome = await runGuestPayment(guestPayload);
        if (outcome !== "success") {
          setPayNote("");
          toastError(outcome === "pending"
            ? "Payment not confirmed yet. If you were charged, it will reflect shortly - please try again."
            : "The payment was not completed. Please try again.", { title: "Payment not completed" });
          return;
        }
        await postGuestJob(guestPayload);
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        setDone(true);
        return;
      }

      const activeToken = token || localStorage.getItem("access_token");
      if (!activeToken) throw new Error("Failed to authenticate session");

      // The wallet is the money source. When it can't cover the escrow, top up only the
      // shortfall via MoMo/Airtel/Card and wait for it to settle - that money lands in the
      // wallet, then postJob freezes the full escrow from the wallet (never a direct-to-job
      // payment). A low-balance posting therefore reads as a direct deposit.
      if (walletBal === null || walletBal < chargeable) {
        const topupAmount = walletBal === null ? chargeable : Math.max(0, chargeable - walletBal);
        if (topupAmount > 0) {
          setPayNote(awaitingNote);
          const outcome = await runWalletTopup({
            amount: topupAmount,
            method,
            phone: paymentPhone || session?.phone,
            notes: "Direct deposit for job escrow",
            token: activeToken,
          });
          if (outcome !== "success") {
            setPayNote("");
            toastError(outcome === "pending"
              ? "Payment not confirmed yet. If you were charged, it will reflect shortly - please try again."
              : "The payment was not completed. Please try again.", { title: "Payment not completed" });
            return;
          }
        }
      }

      setPayNote("");
      await postJob(jobPayload, activeToken);

      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setDone(true);
    } catch (e: any) {
      toastError(apiError(e, t("post_job.errors.post_failed") || "Failed to post job. Please try again."), { title: t("post_job.errors.post_failed_title") || "Post Failed" });
    } finally {
      setSubmitting(false);
      setPayNote("");
    }
  }

  const rate        = parseInt(job.ratePerHour) || 0;
  // Model: Duration = how long the work takes (total units); Threshold = pay every N units.
  // Payments are parts OF the duration → periods = ceil(duration / threshold). No multiplication.
  const duration    = parseInt(job.durationHours) || 0;   // total units, drives pricing/escrow
  const interval    = Math.max(1, parseInt(job.paymentInterval) || 1); // threshold ("pay every")
  const periods     = Math.max(1, Math.ceil(duration / interval));     // number of payments
  const hours       = duration;
  const heads       = parseInt(job.headcount) || 1;
  const baseCost    = rate * hours * heads;
  const escrowFee   = employerServiceFeeOf(baseCost, pricing);
  const escrow      = baseCost + escrowFee;        // employer pays gross + non-refundable service fee
  const platformFee = workerCommissionOf(baseCost, pricing);
  const workerPay   = baseCost - platformFee;      // net the workers receive (all charges covered)
  const feeRate     = employerServiceFeeRateOf(baseCost, pricing);
  const feePctLabel = pricing.employerServiceFeeFixed > 0
    ? "platform fee"
    : `platform fee (${(feeRate * 100).toFixed(feeRate * 100 % 1 === 0 ? 0 : 1)}%)`;
  const catLabel = getLocalizedCategoryLabel(job.category);
  const dateLabel = job.date
    ? new Date(job.date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "-";
  const locationLabel = [getLocalizedProvinceLabel(job.province), job.district].filter(Boolean).join(" › ");

  // Cascading Rwanda location options - resilient to casing/whitespace drift (see rwanda-geo.ts).
  const sectorOpts    = geoSectors(job.province, job.district);
  const cellOpts      = geoCells(job.province, job.district, job.sector);
  const villageOpts   = geoVillages(job.province, job.district, job.sector, job.cell);

  // ── SUCCESS ────────────────────────────────────────────────────────────────
  if (done) return (
    <>
      <style>{CSS}</style>
      <Overlay onClose={onClose}>
        <div onClick={e => e.stopPropagation()} style={modalCard}>
          <div style={{ padding: "52px 28px 40px", textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 999, margin: "0 auto 22px",
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckCircle size={30} color="#22c55e" />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
              {t("post_job.success.title")}
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#aaa", lineHeight: 1.6 }}>
              {t("post_job.success.desc", { location: locationLabel || job.district })}
            </p>
            <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", marginBottom: 24, textAlign: "left" }}>
              {([
                [t("post_job.fields.category") || "Category",  catLabel],
                [t("post_job.fields.date") || "Date",      dateLabel],
                [t("post_job.fields.time") || "Time",      job.time || "-"],
                [t("post_job.fields.duration") || "Duration",  `${hours} ${getUnit(job.rateType, hours)}${interval > 1 ? ` (${t("post_job.every") || "every"} ${interval} ${getUnit(job.rateType, interval)})` : ""}`],
                [t("post_job.fields.workers") || "Workers",   `${heads}`],
                [t("post_job.fields.location") || "Location",  locationLabel || job.district],
                [t("post_job.fields.rate") || "Rate",      fmt(rate) + " " + RATE_LABEL[job.rateType]],
                ...(escrow > 0 ? [[t("post_job.fields.escrowed") || "Escrowed", fmt(escrow)]] : []),
              ] as [string, string][]).map(([k, v]) => <SRow key={k} k={k} v={v} />)}
            </div>
            <button onClick={onClose} style={{ ...btnPrimary, width: "100%" }}>{t("common.buttons.done") || "Done"}</button>
          </div>
        </div>
      </Overlay>
    </>
  );

  const isReviewStep = hasSession ? (step === 1) : (step === 2);

  // Logged-in employer pays from wallet; only top up (or, for guests, pay directly)
  // via MoMo/Airtel/Card when the wallet can't cover the escrow.
  // The employer pays the escrow plus any voluntary donation they added.
  const chargeable    = escrow + donationRwf;
  const needsTopup    = walletBal === null || walletBal < chargeable;
  const topupAmount   = walletBal === null ? chargeable : Math.max(0, chargeable - walletBal);
  const showPayMethods = !hasSession || needsTopup;

  const isPaymentDetailsValid = hasSession && !needsTopup
    ? true
    // Card is entered on the gateway's secure page, so it needs no in-modal fields;
    // mobile money just needs a phone number.
    : (payMethod === "VISA" || payMethod === "MASTERCARD"
       ? true
       : !!(paymentPhone || anonPhone || session?.phone));

  // ── MODAL ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <Overlay onClose={onClose}>
        <div onClick={e => e.stopPropagation()} style={modalCard}>

          {/* HEADER */}
          <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {t("post_job.step_indicator", { current: String(step + 1), total: String(stepsList.length) })}
                </p>
                <h2 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>
                  {stepsList[step]}
                </h2>
              </div>
              <button onClick={onClose} style={{
                flexShrink: 0, background: "#141414", border: "1px solid #2a2a2a",
                borderRadius: 999, width: 32, height: 32,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#555",
              }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
              {stepsList.map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 999,
                  background: i <= step ? "#f97316" : "#272727",
                  transition: "background 0.3s",
                }} />
              ))}
            </div>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 24px 4px" }}>

            {/* ── STEP 0: JOB DETAILS ── */}
            {step === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Category - searchable */}
                <FField label={t("post_job.labels.category") || "Job category *"} error={errors.category}>
                  <SearchSelect
                    options={categoryOptions}
                    value={job.category}
                    onChange={v => setJob(f => ({ ...f, category: v }))}
                    placeholder={t("post_job.placeholders.search_category") || "Search category…"}
                    icon={<Search size={13} color="#444" style={iconL} />}
                  />
                </FField>

                {/* Date + Time */}
                <div className="pj-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label={t("post_job.labels.start_date") || "Start date *"} error={errors.date}>
                    <div style={{ position: "relative" }}>
                      <Calendar size={13} color="#444" style={iconL} />
                      <input type="date" min={todayStr()}
                        value={job.date} onChange={e => setJob(f => ({ ...f, date: e.target.value }))}
                        style={{ ...inp, paddingLeft: 32, colorScheme: "dark" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                    </div>
                  </FField>
                  <FField label={t("post_job.labels.start_time") || "Start time *"} error={errors.time}>
                    <div style={{ position: "relative" }}>
                      <Clock size={13} color="#444" style={iconL} />
                      <input type="time"
                        value={job.time} onChange={e => setJob(f => ({ ...f, time: e.target.value }))}
                        style={{ ...inp, paddingLeft: 32, colorScheme: "dark" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                    </div>
                  </FField>
                </div>

                {/* Duration + Workers */}
                <div className="pj-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label={t("post_job.labels.payment_mode") || "Payment mode"}>
                    <div style={{ position: "relative" }}>
                      <select value={job.paymentMode}
                        onChange={e => {
                          const mode = PAYMENT_MODES.find(m => m.value === e.target.value) ?? PAYMENT_MODES[0];
                          setJob(f => ({ ...f, paymentMode: mode.value, rateType: mode.rt }));
                        }}
                        style={{ ...inp, appearance: "none", paddingRight: 28, color: "#f0f0f0" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      >
                        {PAYMENT_MODES.map(m => (
                          <option key={m.value} value={m.value}>
                            {t("post_job.payment_modes." + m.value.toLowerCase()) || m.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  </FField>
                  <FField label={t("post_job.labels.duration") || "Duration"}>
                    <div style={{ position: "relative" }}>
                      <AlarmClock size={13} color="#444" style={iconL} />
                      <select value={job.durationHours} onChange={e => setJob(f => ({ ...f, durationHours: e.target.value }))}
                        style={{ ...inp, paddingLeft: 32, paddingRight: 28, color: "#f0f0f0", appearance: "none" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      >
                        {getDurations(job.rateType).map(h => (
                          <option key={h} value={String(h)}>{h} {getUnit(job.rateType, h)}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  </FField>
                </div>

                {/* Threshold: pay every N units (all modes; default 1). Payments = duration ÷ this. */}
                <FField label={t("post_job.labels.pay_every") || "Pay every"}>
                  <div style={{ position: "relative", maxWidth: 220 }}>
                    <input type="number" min="1" max="365" value={job.paymentInterval}
                      onChange={e => setJob(f => ({ ...f, paymentInterval: e.target.value }))}
                      style={{ ...inp, paddingRight: 60 }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                      onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#777", pointerEvents: "none" }}>
                      {getUnit(job.rateType, interval)}
                    </span>
                  </div>
                </FField>

                {/* Plain-language schedule summary so the employer sees exactly what the worker gets. */}
                {periods > 0 && (
                  <p style={{ margin: "-4px 0 4px", fontSize: 12, color: "#8a8a8a", lineHeight: 1.6 }}>
                    {(t("post_job.schedule_summary", {
                      interval: String(interval),
                      unit: getUnit(job.rateType, interval),
                      count: String(periods),
                      total: String(hours),
                      totalUnit: getUnit(job.rateType, hours),
                    }) || `Worker is paid every ${interval} ${getUnit(job.rateType, interval)}, ${periods} time(s) - ${hours} ${getUnit(job.rateType, hours)} total.`)}
                  </p>
                )}

                {/* Rate - kept right after the schedule so the amount follows the payment terms. */}
                <FField label={(t("post_job.labels.rate_label", { period: RATE_LABEL[job.rateType] }) || `Rate per worker ${RATE_LABEL[job.rateType]} (RWF) *`)} error={errors.ratePerHour}>
                  <input type="number" min="0" placeholder={t("post_job.placeholders.rate") || "e.g. 3000"}
                    value={job.ratePerHour} onChange={e => setJob(f => ({ ...f, ratePerHour: e.target.value }))}
                    style={inp}
                    onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                    onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                  {rate > 0 && hours > 0 && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#555" }}>
                      Job Cost: <strong style={{ color: "#f97316" }}>{fmt(baseCost)}</strong>
                      {" "}({heads} × {hours}h × {fmt(rate)})
                    </p>
                  )}
                </FField>

                <div className="pj-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label={t("post_job.labels.workers_count") || "No. of workers"}>
                    <div style={{ position: "relative" }}>
                      <Users size={13} color="#444" style={iconL} />
                      <input type="number" min="1" max="50"
                        value={job.headcount} onChange={e => setJob(f => ({ ...f, headcount: e.target.value }))}
                        style={{ ...inp, paddingLeft: 32 }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                    </div>
                  </FField>
                </div>

                {/* Installment payments: how the worker gets paid over the periods above. */}
                <div style={{
                  background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10,
                  padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start",
                }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", flex: 1 }}>
                    <input type="checkbox" checked={directRelease}
                      onChange={e => setDirectRelease(e.target.checked)}
                      style={{ marginTop: 2, accentColor: "#f97316", width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ fontSize: 12.5, color: "#ccc", lineHeight: 1.5 }}>
                      <strong style={{ color: "#f0f0f0" }}>{t("post_job.direct_release.title") || "Auto-release each period"}</strong><br />
                      {t("post_job.direct_release.desc", { unit: getUnit(job.rateType, 1) })
                        || `The worker can request payment after each ${getUnit(job.rateType, 1)} is completed. With this on, approved amounts release instantly; with it off, you approve each request (auto-approves in 2h).`}
                    </span>
                  </label>
                </div>

                {/* Province + District - searchable */}
                <div className="pj-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label={t("post_job.labels.province") || "Province"}>
                    <SearchSelect
                      options={RWANDA_PROVINCES.map(p => ({ value: p.label, label: getLocalizedProvinceLabel(p.label) }))}
                      value={job.province}
                      onChange={v => setJob(f => ({ ...f, province: v, district: "", sector: "", cell: "", village: "" }))}
                      placeholder={t("post_job.placeholders.province") || "Province…"}
                      icon={<MapPin size={13} color="#444" style={iconL} />}
                    />
                  </FField>
                  <FField label={t("post_job.labels.district") || "District *"} error={errors.district}>
                    <SearchSelect
                      options={districtsFor(job.province).map(d => ({ value: d, label: d }))}
                      value={job.district}
                      onChange={v => setJob(f => ({ ...f, district: v, sector: "", cell: "", village: "" }))}
                      placeholder={t("post_job.placeholders.district") || "District…"}
                      icon={<MapPin size={13} color="#444" style={iconL} />}
                    />
                  </FField>
                </div>

                {/* Sector → Cell → Village - cascading, from the same Rwanda dataset as sign-up.
                    Geographic names are constant (not translated), so they match worker locations. */}
                <div className="pj-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <FField label={t("post_job.labels.sector") || "Sector"}>
                    <LocationSelect
                      options={sectorOpts}
                      value={job.sector}
                      disabled={!job.district}
                      placeholder={t("post_job.placeholders.sector") || "Select sector…"}
                      onChange={v => setJob(f => ({ ...f, sector: v, cell: "", village: "" }))}
                    />
                  </FField>
                  <FField label={t("post_job.labels.cell") || "Cell"}>
                    <LocationSelect
                      options={cellOpts}
                      value={job.cell}
                      disabled={!job.sector}
                      placeholder={t("post_job.placeholders.cell") || "Select cell…"}
                      onChange={v => setJob(f => ({ ...f, cell: v, village: "" }))}
                    />
                  </FField>
                  <FField label={t("post_job.labels.village") || "Village"}>
                    <LocationSelect
                      options={villageOpts}
                      value={job.village}
                      disabled={!job.cell}
                      placeholder={t("post_job.placeholders.village") || "Select village…"}
                      onChange={v => setJob(f => ({ ...f, village: v }))}
                    />
                  </FField>
                </div>

                {/* Street / avenue + house number - precise destination for worker navigation */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <FField
                    label={t("post_job.labels.street") || "Street / Avenue"}
                    error={errors.street}
                  >
                    <input
                      type="text"
                      placeholder={t("post_job.placeholders.street") || "e.g. KG 7 Ave"}
                      value={job.street}
                      onChange={e => setJob(f => ({ ...f, street: e.target.value }))}
                      style={{
                        width: "100%", background: "#141414",
                        border: `1px solid ${errors.street ? "rgba(239,68,68,0.5)" : "#2a2a2a"}`,
                        borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#fff", fontFamily: "inherit",
                      }}
                    />
                  </FField>
                  <FField label={t("post_job.labels.house_number") || "House / Plot no."}>
                    <input
                      type="text"
                      placeholder={t("post_job.placeholders.house_number") || "e.g. 12"}
                      value={job.houseNumber}
                      onChange={e => setJob(f => ({ ...f, houseNumber: e.target.value }))}
                      style={{
                        width: "100%", background: "#141414", border: "1px solid #2a2a2a",
                        borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#fff", fontFamily: "inherit",
                      }}
                    />
                  </FField>
                </div>
                <p style={{ margin: "-4px 0 4px", fontSize: 11, color: "#555" }}>
                  {t("post_job.hints.street_or_pin") || "Name the street & house number, or drop a pin on the map below - workers use this to navigate to you."}
                </p>

                {/* Map + GPS */}
                <FField label={t("post_job.labels.precise_location") || "Precise location (click map or use GPS)"}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <MapPicker
                      lat={job.latitude}
                      lng={job.longitude}
                      onChange={(lat, lng) => setJob(f => ({ ...f, latitude: lat, longitude: lng }))}
                    />

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={detectGps}
                        disabled={gpsStatus === "loading"}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "#141414", border: "1px solid #2a2a2a",
                          borderRadius: 8, padding: "7px 12px", fontSize: 12,
                          color: gpsStatus === "ok" ? "#22c55e" : "#aaa",
                          cursor: gpsStatus === "loading" ? "default" : "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {gpsStatus === "loading"
                          ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                          : <Navigation size={12} />}
                        {gpsStatus === "loading"
                          ? (t("post_job.gps.detecting") || "Detecting…")
                          : gpsStatus === "ok"
                            ? (t("post_job.gps.detected") || "GPS detected")
                            : (t("post_job.gps.detect") || "Detect my GPS")}
                      </button>

                      {gpsStatus === "error" && (
                        <span style={{ fontSize: 11, color: "#ef4444" }}>{t("post_job.gps.error") || "Could not access GPS"}</span>
                      )}

                      {job.latitude != null && job.longitude != null && (
                        <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>
                          {job.latitude.toFixed(5)}, {job.longitude.toFixed(5)}
                        </span>
                      )}
                    </div>
                  </div>
                </FField>

                {/* Requirements */}
                <FField label={t("post_job.labels.requirements") || "Requirements (optional)"}>
                  <RichTextEditor
                    placeholder={t("post_job.placeholders.requirements") || "What the worker must have or bring - skills, experience, tools, photos…"}
                    value={job.requirements}
                    onChange={v => setJob(f => ({ ...f, requirements: v }))}
                  />
                </FField>

                {/* Notes */}
                <FField label={t("post_job.labels.notes") || "Additional notes (optional)"}>
                  <RichTextEditor
                    placeholder={t("post_job.placeholders.notes") || "e.g. formal attire required, tools provided, outdoor event…"}
                    value={job.notes}
                    onChange={v => setJob(f => ({ ...f, notes: v }))}
                  />
                </FField>

              </div>
            )}

            {/* ── STEP 1: ACCOUNT DETAILS (Only if not signed in) ── */}
            {step === 1 && !hasSession && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>
                  Please enter your contact details. This will automatically create an employer account to manage your jobs.
                </p>
                <FField label="Full Name *">
                  <input type="text" placeholder="Jean Pierre Mugisha" value={anonName} onChange={e => setAnonName(e.target.value)} style={inp} />
                </FField>
                <FField label="Email Address *">
                  <input type="email" placeholder="pierre@example.com" value={anonEmail} onChange={e => setAnonEmail(e.target.value)} style={inp} />
                </FField>
                <FField label="Phone Number *">
                  <input type="text" placeholder="0781234567" value={anonPhone} onChange={e => setAnonPhone(e.target.value)} style={inp} />
                </FField>
                {acctCheck === "checking" && (
                  <p style={{ margin: 0, fontSize: 12, color: "#888", display: "flex", alignItems: "center", gap: 6 }}>
                    <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Verifying your details…
                  </p>
                )}
                {acctCheck === "worker" && (
                  <p style={{ margin: 0, fontSize: 12, color: "#ef4444", lineHeight: 1.5 }}>{WORKER_ACCOUNT_MSG}</p>
                )}
              </div>
            )}

            {/* ── STEP 1 or 2: REVIEW & PAYMENT ── */}
            {isReviewStep && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {t("post_job.review.summary_title")}
                  </p>
                  {([
                    [t("post_job.fields.category") || "Category",  catLabel],
                    [t("post_job.fields.date") || "Date",      dateLabel],
                    [t("post_job.fields.time") || "Time",      job.time || "-"],
                    [t("post_job.fields.duration") || "Duration",  `${hours} ${getUnit(job.rateType, hours)}${interval > 1 ? ` (${t("post_job.every") || "every"} ${interval} ${getUnit(job.rateType, interval)})` : ""}`],
                    [t("post_job.fields.workers") || "Workers",   `${heads} worker${heads !== 1 ? "s" : ""}`],
                    [t("post_job.labels.province") || "Province",  getLocalizedProvinceLabel(job.province) || "-"],
                    [t("post_job.labels.district") || "District",  job.district],
                    ...(job.sector  ? [[t("post_job.labels.sector") || "Sector", job.sector]] : []),
                    ...(job.cell    ? [[t("post_job.labels.cell") || "Cell", job.cell]] : []),
                    ...(job.village ? [[t("post_job.labels.village") || "Village", job.village]] : []),
                    ...(job.latitude != null ? [["GPS", `${job.latitude.toFixed(5)}, ${job.longitude!.toFixed(5)}`]] : []),
                    [t("post_job.fields.rate") || "Rate",      fmt(rate) + " " + RATE_LABEL[job.rateType]],
                    ...(escrow > 0 ? [[t("post_job.fields.escrowed") || "Total Deposition", fmt(escrow)]] : []),
                  ] as [string, string][]).map(([k, v]) => <SRow key={k} k={k} v={v} />)}
                  {job.notes && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8, marginTop: 4, borderTop: "1px solid #1a1a1a" }}>
                      <span style={{ fontSize: 12, color: "#555" }}>{t("post_job.labels.notes") || "Additional notes"}</span>
                      <div style={{ fontSize: 12, color: "#d0d0d0", lineHeight: 1.6 }}>
                        <RichTextDisplay content={job.notes} />
                      </div>
                    </div>
                  )}
                </div>

                {/* ESCROW / WALLET BLOCK */}
                <div style={{ marginTop: 8 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#fff" }}>{t("post_job.review.payment_title") || "Payment & Deposit Details"}</p>

                  {/* escrow breakdown */}
                  {escrow > 0 && (
                    <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Job cost ({heads} × {hours}h × {fmt(rate)})</span>
                        <span style={{ fontSize: 12, color: "#d0d0d0", fontWeight: 600 }}>{fmt(baseCost)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#666" }}>{feePctLabel.charAt(0).toUpperCase() + feePctLabel.slice(1)} · non-refundable</span>
                        <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>+{fmt(escrowFee)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, paddingBottom: 8, borderTop: "1px solid #1e1e1e" }}>
                        <span style={{ fontSize: 13, color: "#aaa", fontWeight: 700 }}>Total amount to pay</span>
                        <span style={{ fontSize: 14, color: "#f97316", fontWeight: 800 }}>{fmt(escrow)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #1e1e1e" }}>
                        <span style={{ fontSize: 11, color: "#666" }}>Worker take-home (all charges covered)</span>
                        <span style={{ fontSize: 12, color: "#d0d0d0", fontWeight: 600 }}>{fmt(workerPay)}</span>
                      </div>
                    </div>
                  )}

                  {/* Wallet is the money source for logged-in employers */}
                  {hasSession && (
                    <div style={{ background: "#141414", border: needsTopup ? "1px solid rgba(239,68,68,0.3)" : "1px solid #2a2a2a", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Wallet balance</span>
                          <span style={{ fontSize: 11, color: needsTopup ? "#ef4444" : "#22c55e" }}>
                            {walletBal !== null ? fmt(walletBal) : "-"}{needsTopup ? " · not enough to cover this job" : " · covers this job"}
                          </span>
                        </div>
                        {!needsTopup && <CheckCircle size={18} color="#22c55e" />}
                      </div>
                      {needsTopup && (
                        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#aaa", lineHeight: 1.5 }}>
                          Pay <strong style={{ color: "#f97316" }}>{fmt(topupAmount)}</strong> below to fund this job. It's added to your wallet and the full {fmt(escrow)} is held in escrow - it appears on your posting as a direct deposit.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Payment methods - only shown for guests, or to top up a short wallet */}
                  {showPayMethods && (
                  <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase" }}>
                      {hasSession ? `Top up ${fmt(topupAmount)} via` : "Select Payment Method"}
                    </p>

                    <PayMethodSelector value={payMethod as PayMethodValue} onChange={setPayMethod} onMethod={setSelMethod} />
                    <DonationAddon usdToRwf={pricing.usdToRwf} valueRwf={donationRwf} onChange={setDonationRwf} />
                    {donationRwf > 0 && (
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#22c55e" }}>
                        {fmt(escrow)} escrow + {fmt(donationRwf)} donation = <strong>{fmt(chargeable)}</strong> total
                      </p>
                    )}
                  </div>

                  {/* Payment method fields */}
                  {(payMethod === "MTN_MOMO" || payMethod === "AIRTEL_MONEY") && (
                    <FField label="Mobile Money Phone Number *">
                      <input type="text" placeholder="e.g. 0780000000" value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} style={inp} />
                    </FField>
                  )}

                  {(payMethod === "VISA" || payMethod === "MASTERCARD") && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "10px 14px" }}>
                      <CheckCircle size={14} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12, color: "#9ab", lineHeight: 1.5 }}>
                        You'll enter your card details on a secure page after you tap pay. We never see your full card number.
                      </span>
                    </div>
                  )}
                  </>
                  )}

                  {payNote && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10, padding: "10px 14px" }}>
                      <Loader2 size={14} color="#f97316" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#d0d0d0", lineHeight: 1.5 }}>{payNote}</span>
                    </div>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: 11, color: "#444", lineHeight: 1.7, textAlign: "center", padding: "0 8px" }}>
                  {t("post_job.review.agreement_hint")}
                </p>
              </div>
            )}

          </div>

          {/* FOOTER NAV */}
          <div style={{ padding: "16px 24px 20px", flexShrink: 0, borderTop: "1px solid #1e1e1e" }}>
            <div style={{ display: "flex", gap: 10 }}>
              {step > 0 && (
                <button onClick={() => { setErrors({}); setStep(s => s - 1); }} style={btnBack}>
                  ← {t("common.buttons.back") || "Back"}
                </button>
              )}
              {!isReviewStep ? (
                <button onClick={handleNext} style={{ ...btnPrimary, flex: 1 }}>
                  {t("common.buttons.continue") || "Continue"} →
                </button>
              ) : (
                <button
                  disabled={submitting || !isPaymentDetailsValid}
                  onClick={() => { setJobTitle(prev => prev.trim() || catLabel); setTitleModalOpen(true); }}
                  style={{ ...btnPrimary, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    opacity: (submitting || !isPaymentDetailsValid) ? 0.45 : 1,
                    cursor: (submitting || !isPaymentDetailsValid) ? "not-allowed" : "pointer" }}
                >
                  {submitting && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                  {submitting
                    ? (t("post_job.review.posting_btn") || "Processing…")
                    : (t("post_job.review.submit_btn") || "Pay & post job")}
                </button>
              )}
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>

        </div>
      </Overlay>

      {titleModalOpen && (
        <div onClick={() => !submitting && setTitleModalOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 420, background: "#141414", border: "1px solid #2a2a2a",
            borderRadius: 16, padding: 22,
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f0f0", marginBottom: 4 }}>
              {t("post_job.title_confirm.heading") || "Name this job"}
            </div>
            <p style={{ fontSize: 12.5, color: "#8a8a8a", margin: "0 0 14px", lineHeight: 1.5 }}>
              {(t("post_job.title_confirm.desc") || "Confirm the job name or edit it. It stays a {cat} job.").replace("{cat}", catLabel)}
            </p>
            <input
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              maxLength={120}
              autoFocus
              placeholder={catLabel}
              onKeyDown={e => { if (e.key === "Enter" && !submitting) { setTitleModalOpen(false); handlePost(); } }}
              style={{
                width: "100%", background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 10,
                padding: "11px 13px", fontSize: 14, color: "#f0f0f0", outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                disabled={submitting}
                onClick={() => { setTitleModalOpen(false); handlePost(); }}
                style={{ ...btnPrimary, flex: 1, opacity: submitting ? 0.5 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
              >
                {t("post_job.title_confirm.confirm") || "Confirm & pay"}
              </button>
              <button
                onClick={() => setTitleModalOpen(false)}
                disabled={submitting}
                style={{ flex: 1, background: "transparent", color: "#888", border: "1px solid #2a2a2a", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                {t("common.buttons.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── SearchSelect ──────────────────────────────────────────────────────────────
function SearchSelect({
  options, value, onChange, placeholder, icon,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
}) {
  const initialLabel = options.find(o => o.value === value)?.label ?? "";
  const [query, setQuery]   = useState(initialLabel);
  const [open, setOpen]     = useState(false);

  // Sync display text when value changes from parent (e.g. province reset clears district)
  useEffect(() => {
    const label = options.find(o => o.value === value)?.label ?? "";
    setQuery(label);
  }, [value, options]);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  function select(opt: { value: string; label: string }) {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      {icon}
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so mousedown on option can fire first
          setTimeout(() => {
            setOpen(false);
            // If nothing was selected, keep label of current value
            const label = options.find(o => o.value === value)?.label ?? "";
            setQuery(label);
          }, 150);
        }}
        style={{ ...inp, paddingLeft: icon ? 32 : 14 }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = "#f97316")}
        onBlurCapture={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
          background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
          maxHeight: 200, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        }}>
          {filtered.map(o => (
            <div
              key={o.value}
              onMouseDown={e => { e.preventDefault(); select(o); }}
              style={{
                padding: "9px 14px", cursor: "pointer", fontSize: 13,
                color: value === o.value ? "#f97316" : "#d0d0d0",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#252525")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── LocationSelect ────────────────────────────────────────────────────────────
// A plain dependent dropdown for the Rwanda sector/cell/village hierarchy.
function LocationSelect({ options, value, onChange, placeholder, disabled }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{ ...inp, appearance: "none", paddingRight: 28, color: value ? "#f0f0f0" : "#555",
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
    </div>
  );
}

// ── primitives ───────────────────────────────────────────────────────────────
function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.88)",
      backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", fontFamily: "Inter, DM Sans, system-ui, sans-serif",
    }}>
      {children}
    </div>
  );
}

function FField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      {children}
      {error && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{error}</p>}
    </div>
  );
}

function SRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0", borderBottom: "1px solid #1a1a1a", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#555", flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#f0f0f0", textAlign: "right" }}>{v}</span>
    </div>
  );
}
