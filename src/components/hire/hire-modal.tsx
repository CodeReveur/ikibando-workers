"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  X, MapPin, Shield, ChevronDown,
  Calendar, Clock, CheckCircle, Users,
  AlarmClock, Search, Navigation, Loader2, Star,
} from "lucide-react";
import { JOB_CATEGORIES, RWANDA_PROVINCES, MIN_RATE_BY_PERIOD } from "@/lib/constants";
import { getWorkers, postJob, postGuestJob, applyForJob, getWallet, checkGuestAccount, getPricingConfig, getJobCategories, employerServiceFeeOf, DEFAULT_PRICING, type PricingConfig, type WorkerProfileDto, type PaymentMode, type JobCategoryMeta } from "@/lib/api";
import { getReferralCode } from "@/lib/referral";
import { runWalletTopup, runGuestPayment, isCardMethod, type PayMethod } from "@/lib/pay-flow";
import { DonationAddon } from "@/components/donate/donation-addon";
import { forwardGeocode } from "@/lib/geocoding";
import { ratingInfo } from "@/lib/rating";
import { useToast } from "@/components/ui/toast";
import { RichTextEditor, RichTextDisplay } from "@/components/ui/rich-text-editor";
import { useLanguage } from "@/lib/language-context";
import { useSession, type Session } from "@/components/dashboard/session-ctx";
import { PayMethodSelector, payFieldsOf, type PayMethodValue, type SelectedMethod } from "@/components/ui/pay-logos";
import { Z } from "@/lib/z-layers";

// Leaflet must render client-side only
const MapPicker = dynamic(
  () => import("../jobs/map-picker").then(m => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: 220, borderRadius: 10, border: "1px solid #2a2a2a",
        background: "#141414", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 12, color: "#555",
      }}>Loading map…</div>
    ),
  }
);

// ── helpers ──────────────────────────────────────────────────────────────────
function districtsFor(province: string) {
  const p = RWANDA_PROVINCES.find(p => p.label === province);
  return p ? [...p.districts] : RWANDA_PROVINCES.flatMap(p => [...p.districts]);
}
function catLabel(slug: string) {
  return JOB_CATEGORIES.find(c => c.value === slug)?.label ?? slug;
}
function sinceYear(iso: string) {
  return new Date(iso).getFullYear();
}

// ── types ────────────────────────────────────────────────────────────────────
type RateType  = "hr" | "day" | "week" | "month" | "year";

interface Form {
  category: string; budget: string;
  headcount: string; rateType: RateType; paymentMode: PaymentMode; paymentInterval: string; durationHours: string;
  date: string; time: string;
  province: string; district: string;
  latitude: number | null; longitude: number | null;
  requirements: string;
}

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
const fmt       = (n: number) => `RWF ${n.toLocaleString()}`;
const todayStr  = () => new Date().toISOString().split("T")[0];
const RATE_LABEL: Record<RateType, string> = { hr:"/hr", day:"/day", week:"/wk", month:"/mo", year:"/yr" };

// The 8 installment payment modes and the pricing/threshold unit each maps to.
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

// Shown when a guest's contact details already belong to a worker (seeker) account.
const WORKER_ACCOUNT_MSG =
  "These details match a worker account, so you can't hire as an employer with this email. Please use a new email, or an existing employer email.";

// ── styles ───────────────────────────────────────────────────────────────────
const CSS = `
  .hire-ta { resize: vertical; }
  .wrow { transition: border-color 0.12s, background 0.12s; cursor: pointer; }
  .wrow:hover { border-color: #f97316 !important; }
  .wrow.disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
  @media (max-width: 500px) { .h2col { grid-template-columns: 1fr !important; } }
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
export function HireModal({ onClose }: { onClose: () => void }) {
  const { error: toastError } = useToast();
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState<Form>({
    category:"", budget:"", headcount:"1", rateType:"day", paymentMode:"DAILY", paymentInterval:"1",
    durationHours:"4", date:"", time:"",
    province:"", district:"", latitude:null, longitude:null,
    requirements:"",
  });
  const [selected, setSel]  = useState<WorkerProfileDto[]>([]);
  const [walletBal, setWalletBal] = useState<number | null>(null);
  const [done, setDone]    = useState(false);
  const [submitting, setSub]   = useState(false);
  const [gpsStatus, setGps] = useState<"idle"|"loading"|"ok"|"error">("idle");
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
  const [jobTitle, setJobTitle] = useState("");
  const [titleModalOpen, setTitleModalOpen] = useState(false);
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  useEffect(() => { getPricingConfig().then(setPricing).catch(() => {}); }, []);
  // Categories from the admin-managed DB, so newly added ones are hirable at once.
  const [dbCats, setDbCats] = useState<JobCategoryMeta[]>([]);
  useEffect(() => { getJobCategories().then(setDbCats).catch(() => {}); }, []);
  // Built-in categories COMBINED with any admin-added DB ones, deduped by slug - nothing lost.
  const knownCatSlugs = new Set<string>(JOB_CATEGORIES.map(c => c.value));
  const categoryOptions = [
    ...JOB_CATEGORIES.map(c => ({ value: c.value, label: c.label })),
    ...dbCats.filter(c => !knownCatSlugs.has(c.slug)).map(c => ({ value: c.slug, label: c.displayName })),
  ];
  const [paymentPhone, setPaymentPhone] = useState("");
  const [payNote, setPayNote] = useState("");
  // When on, a worker's per-period payment request pays out immediately (no manual approval).
  const [directRelease, setDirectRelease] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return !!JSON.parse(localStorage.getItem("user") || "null")?.defaultAutoRelease; } catch { return false; }
  });  // defaults OFF; respects the employer account default

  const DRAFT_KEY = "MpahMapu_draft_hire";

  // Wallet is the implicit money source for logged-in employers; MoMo/Airtel/Card
  // are only used to top up a short wallet (or as direct payment for guests).
  useEffect(() => {
    setPayMethod("MTN_MOMO");
  }, [hasSession]);

  // Move the map to the selected district/province by forward-geocoding it.
  useEffect(() => {
    if (!form.district) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const hit = await forwardGeocode([form.district, form.province || "", "Rwanda"].filter(Boolean).join(", "));
      if (!cancelled && hit) setForm(f => ({ ...f, latitude: hit.latitude, longitude: hit.longitude }));
    }, 500);
    return () => { cancelled = true; clearTimeout(handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.province, form.district]);

  // Restore draft on open
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const { form: saved } = JSON.parse(raw);
        if (saved) setForm(f => ({ ...f, ...saved }));
      }
      const tokenVal = localStorage.getItem("access_token");
      if (tokenVal) {
        setToken(tokenVal);
        getWallet(tokenVal).then(w => setWalletBal(w.balance)).catch(() => {});
      }
    } catch {}
  }, []);

  // Save draft on change
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form })); } catch {}
  }, [form]);

  // Real worker data
  const [workers, setWorkers]         = useState<WorkerProfileDto[]>([]);
  const [loadingWorkers, setLoading]  = useState(false);
  const [workerError, setWorkerError] = useState(false);

  // Fetch workers when reaching Step 1
  useEffect(() => {
    if (step !== 1) return;
    setLoading(true);
    setWorkerError(false);
    setSel([]);
    getWorkers({ category: form.category || undefined, size: 50 })
      .then(page => setWorkers(page.content))
      .catch(() => { setWorkers([]); setWorkerError(true); })
      .finally(() => setLoading(false));
  }, [step]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

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
    if (!navigator.geolocation) { setGps("error"); return; }
    setGps("loading");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({
          ...f,
          latitude:  +pos.coords.latitude.toFixed(7),
          longitude: +pos.coords.longitude.toFixed(7),
        }));
        setGps("ok");
      },
      () => setGps("error"),
      { timeout: 10000 }
    );
  }

  async function handleConfirmHire() {
    setSub(true);
    try {
      const startTime = form.date && form.time
        ? `${form.date}T${form.time}:00Z`
        : new Date().toISOString();

      const rateType = form.rateType === "hr" ? "PER_HOUR"
        : form.rateType === "day" ? "PER_DAY"
        : form.rateType === "week" ? "PER_WEEK"
        : form.rateType === "month" ? "PER_MONTH" : "PER_YEAR";
      const paymentMode = form.paymentMode;

      const jobPayload = {
        category: form.category, title: jobTitle.trim() || undefined,
        requirements: form.requirements || undefined, district: form.district,
        province: form.province || undefined,
        latitude: form.latitude ?? undefined, longitude: form.longitude ?? undefined,
        ratePerHour: parseInt(form.budget) || 0,
        headcount: selected.length || 1,
        urgency: "IMMEDIATE" as const,
        startTime, durationHours: durationNum,
        rateType,
        paymentMode: paymentMode as import("@/lib/api").PaymentMode,
        paymentPeriods: periodsNum,
        paymentInterval: interval,
        directRelease,
        direct: true, // Hire Now: private offer to the picked worker(s), not a broadcast.
        donationRwf: donationRwf > 0 ? donationRwf : undefined,
      };

      // payMethod is one of the 4 gateway methods (default MTN_MOMO); WALLET is never selected.
      const method = (payMethod === "WALLET" ? "MTN_MOMO" : payMethod) as PayMethod;
      const card = isCardMethod(method);
      const awaitingNote = card
        ? "Opening the secure card page… complete your payment there."
        : "Sent a prompt to your phone - approve it to continue.";

      if (!hasSession) {
        // Guest: take the real payment first (phase 1), then create the job + assign workers.
        const guestPayload = {
          job: jobPayload,
          guestName: anonName,
          guestEmail: anonEmail,
          guestPhone: anonPhone,
          paymentMethod: method,
          paymentPhone: paymentPhone || anonPhone || undefined,
          workerIds: selected.map(w => w.id as unknown as string),
          appliedVia: "HIRE_NOW",
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

      const activeToken = localStorage.getItem("access_token") || token;
      if (!activeToken) throw new Error("Failed to authenticate session");

      // The wallet is the money source. When it can't cover the escrow, top up only the
      // shortfall via MoMo/Airtel/Card and wait for it to settle - that money lands in the
      // wallet, then postJob freezes the full escrow from the wallet (never a direct-to-job
      // payment). A low-balance hire therefore reads as a direct deposit.
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
      const job = await postJob(jobPayload, activeToken);

      // Send each picked worker a pending offer - they accept or decline. The server notifies them;
      // if a worker declines, it opens the job to other nearby workers in the same category.
      await Promise.all(selected.map(w =>
        applyForJob(job.id as unknown as string, { bestFit: "Hire Now selection", appliedVia: "HIRE_NOW", workerId: w.id as unknown as string }, activeToken!)
      ));

      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setDone(true);
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? e?.message ?? "Payment failed. Please try again.", { title: t("hire_modal.summary.post_fail_title") });
    } finally {
      setSub(false);
    }
  }

  const headcountNum = Math.max(1, parseInt(form.headcount, 10) || 1);
  const isMulti      = headcountNum > 1;

  // Sort: workers in the selected district first, then by join date (oldest = most experienced)
  const matches = [...workers].sort((a, b) => {
    const aM = (a.district ?? "") === form.district ? 1 : 0;
    const bM = (b.district ?? "") === form.district ? 1 : 0;
    if (bM !== aM) return bM - aM;
    return new Date(a.memberSince as any).getTime() - new Date(b.memberSince as any).getTime();
  });

  const toggleWorker = (w: WorkerProfileDto) => {
    const alreadySel = selected.some(s => s.id === w.id);
    if (alreadySel) { setSel(selected.filter(s => s.id !== w.id)); return; }
    if (!isMulti) { setSel([w]); return; }
    if (selected.length >= headcountNum) return;
    setSel([...selected, w]);
  };

  const budget      = parseInt(form.budget, 10) || 0;
  // Duration = how long the work takes (total units); Threshold = pay every N units.
  // Payments are parts OF the duration → periods = ceil(duration / threshold). No multiplication.
  const durationNum = parseInt(form.durationHours, 10) || 1;
  const interval    = Math.max(1, parseInt(form.paymentInterval, 10) || 1);
  const periodsNum  = Math.max(1, Math.ceil(durationNum / interval));
  const jobAmount   = budget * headcountNum * durationNum;
  const fee         = employerServiceFeeOf(jobAmount, pricing);
  const total       = jobAmount + fee;
  const feePctLabel = jobAmount > 0 ? `${Math.round((fee / jobAmount) * 100)}%` : "";
  const minRate     = MIN_RATE_BY_PERIOD[form.rateType];
  const rateOk      = budget >= minRate;

  const selectionValid = isMulti ? selected.length === headcountNum : selected.length === 1;

  const locationLabel = [form.province, form.district].filter(Boolean).join(" › ");
  const cat           = dbCats.find(c => c.slug === form.category)?.displayName ?? catLabel(form.category);
  const dateLabel     = form.date
    ? new Date(form.date + "T00:00").toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" })
    : "-";

  const isReviewStep = hasSession ? (step === 2) : (step === 3);

  // Logged-in employer pays from wallet; only top up (or, for guests, pay directly)
  // via MoMo/Airtel/Card when the wallet can't cover the escrow.
  const chargeable    = total + donationRwf;
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

  const canNext = hasSession
    ? [
        !!(form.category && rateOk && form.date && form.time && form.district),
        selectionValid,
        isPaymentDetailsValid
      ]
    : [
        !!(form.category && rateOk && form.date && form.time && form.district),
        selectionValid,
        !!(anonName && anonEmail && anonPhone) && acctCheck === "ok",
        isPaymentDetailsValid
      ];

  const { t } = useLanguage();
  const STEPS = hasSession
    ? [t("hire_modal.steps.details") || "Job details", t("hire_modal.steps.matches") || "Best Matches", t("hire_modal.steps.summary") || "Summary & Pay"]
    : [t("hire_modal.steps.details") || "Job details", t("hire_modal.steps.matches") || "Best Matches", "Account details", t("hire_modal.steps.summary") || "Summary & Pay"];

  const selectedNames = selected.map(w => w.name).join(", ");

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (done) return (
    <>
      <style>{CSS}</style>
      <Overlay onClose={onClose}>
        <div onClick={e => e.stopPropagation()} style={modalCard}>
          <div style={{ padding: "48px 28px 36px", textAlign: "center", overflowY: "auto" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 999, margin: "0 auto 20px",
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
              {t("hire_modal.summary.success_title")}
            </h2>
            <p style={{ margin: "0 0 4px", fontSize: 14, color: "#aaa" }}>
              <strong style={{ color: "#f0f0f0" }}>{selectedNames}</strong>{" "}
              {t("hire_modal.summary.success_desc", { names: "", plural: selected.length > 1 ? "have" : "has" })}
            </p>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#555", lineHeight: 1.7 }}>
              {t("hire_modal.summary.success_sub")}
            </p>
            <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", marginBottom: 24, textAlign: "left" }}>
              {([
                ["Category",  cat],
                ["Workers",   String(headcountNum)],
                [headcountNum > 1 ? "Assigned to" : "Worker", selectedNames],
                ["Date",      dateLabel],
                ["Time",      form.time || "-"],
                ["Province",  form.province || "-"],
                ["District",  form.district],
                ...(form.latitude != null ? [["GPS", `${form.latitude.toFixed(5)}, ${form.longitude!.toFixed(5)}`]] : []),
                ...(form.requirements ? [["Requirements", <RichTextDisplay content={form.requirements} />]] : []),
              ] as [string, React.ReactNode][]).map(([k, v]) => <SRow key={String(k)} k={String(k)} v={v} />)}
            </div>
            <button onClick={onClose} style={{ ...btnPrimary, width: "100%" }}>{t("common.buttons.done")}</button>
          </div>
        </div>
      </Overlay>
    </>
  );

  // ── MODAL ─────────────────────────────────────────────────────────────────
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
                  {t("hire_modal.steps.indicator", { step: step + 1, total: STEPS.length })}
                </p>
                <h2 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>
                  {STEPS[step]}
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
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 999,
                  background: i <= step ? "#f97316" : "#272727",
                  transition: "background 0.3s",
                }} />
              ))}
            </div>
          </div>

          {/* CONTENT */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 24px 4px" }}>

            {/* ── STEP 0: JOB DETAILS ── */}
            {step === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                <FField label={t("hire_modal.details.category_label")}>
                  <SearchSelect
                    options={categoryOptions}
                    value={form.category}
                    onChange={v => setForm(f => ({ ...f, category: v }))}
                    placeholder={t("hire_modal.details.category_placeholder")}
                    icon={<Search size={13} color="#444" style={iconL} />}
                  />
                </FField>

                <div className="h2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label={t("post_job.labels.payment_mode") || "Payment mode"}>
                    <div style={{ position: "relative" }}>
                      <select value={form.paymentMode}
                        onChange={e => {
                          const mode = PAYMENT_MODES.find(m => m.value === e.target.value) ?? PAYMENT_MODES[0];
                          setForm(f => ({ ...f, paymentMode: mode.value, rateType: mode.rt }));
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
                  <FField label={t("post_job.labels.duration") || t("hire_modal.details.duration_label")}>
                    <div style={{ position: "relative" }}>
                      <AlarmClock size={13} color="#444" style={iconL} />
                      <select value={form.durationHours} onChange={e => setForm(f => ({ ...f, durationHours: e.target.value }))}
                        style={{ ...inp, appearance: "none", paddingLeft: 32, paddingRight: 28, color: "#f0f0f0" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      >
                        {getDurations(form.rateType).map(h => (
                          <option key={h} value={String(h)}>{h} {getUnit(form.rateType, h)}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  </FField>
                </div>

                <FField label={t("post_job.labels.pay_every") || "Pay every"}>
                  <div style={{ position: "relative", maxWidth: 220 }}>
                    <input type="number" min="1" max="365" value={form.paymentInterval}
                      onChange={e => setForm(f => ({ ...f, paymentInterval: e.target.value }))}
                      style={{ ...inp, paddingRight: 60 }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                      onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#777", pointerEvents: "none" }}>
                      {getUnit(form.rateType, interval)}
                    </span>
                  </div>
                </FField>

                {periodsNum > 0 && (
                  <p style={{ margin: "-2px 0 4px", fontSize: 12, color: "#8a8a8a", lineHeight: 1.6 }}>
                    {t("post_job.schedule_summary", {
                      interval: String(interval), unit: getUnit(form.rateType, interval),
                      count: String(periodsNum), total: String(durationNum), totalUnit: getUnit(form.rateType, durationNum),
                    }) || `Worker is paid every ${interval} ${getUnit(form.rateType, interval)}, ${periodsNum} time(s) - ${durationNum} ${getUnit(form.rateType, durationNum)} total.`}
                  </p>
                )}

                {/* Workers + amount - chosen after the schedule so the rate matches the mode. */}
                <div className="h2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label={t("hire_modal.details.workers_label")}>
                    <div style={{ position: "relative" }}>
                      <Users size={13} color="#444" style={iconL} />
                      <input type="number" min="1" max="50"
                        value={form.headcount}
                        onChange={e => setForm(f => ({ ...f, headcount: e.target.value }))}
                        style={{ ...inp, paddingLeft: 32 }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                    </div>
                  </FField>
                  <FField label={t("hire_modal.details.rate_label")}>
                    <input type="number" min="0" placeholder={`e.g. ${minRate.toLocaleString()}`}
                      value={form.budget}
                      onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                      style={inp}
                      onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                      onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    />
                    {budget > 0 && !rateOk && (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ef4444" }}>
                        Minimum is {fmt(minRate)} {RATE_LABEL[form.rateType]}
                      </p>
                    )}
                  </FField>
                </div>

                <label style={{
                  background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10,
                  padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
                }}>
                  <input type="checkbox" checked={directRelease}
                    onChange={e => setDirectRelease(e.target.checked)}
                    style={{ marginTop: 2, accentColor: "#f97316", width: 16, height: 16, cursor: "pointer" }} />
                  <span style={{ fontSize: 12.5, color: "#ccc", lineHeight: 1.5 }}>
                    <strong style={{ color: "#f0f0f0" }}>{t("post_job.direct_release.title") || "Auto-release each period"}</strong><br />
                    {t("post_job.direct_release.desc", { unit: getUnit(form.rateType, 1) })
                      || `The worker can request payment after each ${getUnit(form.rateType, 1)} is completed. With this on, approved amounts release instantly; with it off, you approve each request (auto-approves in 2h).`}
                  </span>
                </label>

                {headcountNum > 1 && budget > 0 && (
                  <div style={{
                    background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.15)",
                    borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontSize: 12, color: "#888" }}>
                      {t("hire_modal.details.payout_breakdown", {
                        rate: fmt(budget),
                        period: RATE_LABEL[form.rateType],
                        workers: headcountNum,
                        plural: headcountNum !== 1 ? "s" : "",
                        duration: durationNum,
                        unit: getUnit(form.rateType, durationNum)
                      })}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#f97316" }}>{fmt(jobAmount)}</span>
                  </div>
                )}

                <div className="h2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label={t("hire_modal.details.start_date")}>
                    <div style={{ position: "relative" }}>
                      <Calendar size={13} color="#444" style={iconL} />
                      <input type="date" min={todayStr()}
                        value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        style={{ ...inp, paddingLeft: 32, colorScheme: "dark" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                    </div>
                  </FField>
                  <FField label={t("hire_modal.details.start_time")}>
                    <div style={{ position: "relative" }}>
                      <Clock size={13} color="#444" style={iconL} />
                      <input type="time"
                        value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                        style={{ ...inp, paddingLeft: 32, colorScheme: "dark" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                    </div>
                  </FField>
                </div>

                <div className="h2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label={t("hire_modal.details.province")}>
                    <SearchSelect
                      options={RWANDA_PROVINCES.map(p => ({ value: p.label, label: p.label }))}
                      value={form.province}
                      onChange={v => setForm(f => ({ ...f, province: v, district: "" }))}
                      placeholder={t("hire_modal.details.province_placeholder")}
                      icon={<MapPin size={13} color="#444" style={iconL} />}
                    />
                  </FField>
                  <FField label={t("hire_modal.details.district")}>
                    <SearchSelect
                      options={districtsFor(form.province).map(d => ({ value: d, label: d }))}
                      value={form.district}
                      onChange={v => setForm(f => ({ ...f, district: v }))}
                      placeholder={t("hire_modal.details.district_placeholder")}
                      icon={<MapPin size={13} color="#444" style={iconL} />}
                    />
                  </FField>
                </div>

                <FField label={t("hire_modal.details.location_label")}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <MapPicker
                      lat={form.latitude} lng={form.longitude}
                      onChange={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button type="button" onClick={detectGps} disabled={gpsStatus === "loading"} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: "#141414", border: "1px solid #2a2a2a",
                        borderRadius: 8, padding: "7px 12px", fontSize: 12,
                        color: gpsStatus === "ok" ? "#22c55e" : "#aaa",
                        cursor: gpsStatus === "loading" ? "default" : "pointer",
                        fontFamily: "inherit",
                      }}>
                        {gpsStatus === "loading" ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Navigation size={12} />}
                        {gpsStatus === "loading" ? t("hire_modal.details.gps_btn_detecting") : gpsStatus === "ok" ? t("hire_modal.details.gps_btn_detected") : t("hire_modal.details.gps_btn_detect")}
                      </button>
                      {gpsStatus === "error" && <span style={{ fontSize: 11, color: "#ef4444" }}>{t("hire_modal.details.gps_error")}</span>}
                      {form.latitude != null && form.longitude != null && (
                        <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>
                          {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                        </span>
                      )}
                    </div>
                  </div>
                </FField>

                <FField label={t("hire_modal.details.requirements_label")}>
                  <RichTextEditor
                    placeholder={t("hire_modal.details.requirements_placeholder")}
                    value={form.requirements}
                    onChange={v => setForm(f => ({ ...f, requirements: v }))}
                  />
                </FField>
              </div>
            )}

            {/* ── STEP 1: BEST MATCHES (real workers) ── */}
            {step === 1 && (
              <div>
                {/* Selection progress for multi-hire */}
                {isMulti && !loadingWorkers && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 12, padding: "8px 12px",
                    background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10,
                  }}>
                    <span style={{ fontSize: 12, color: "#555" }}>
                      {t("hire_modal.matches.selected_status", { selected: selected.length, total: headcountNum })}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: selectionValid ? "#22c55e" : "#f97316" }}>
                      {selectionValid ? t("hire_modal.matches.ready") : t("hire_modal.matches.select_more")}
                    </span>
                  </div>
                )}

                {loadingWorkers ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", gap: 12 }}>
                    <Loader2 size={24} color="#f97316" style={{ animation: "spin 1s linear infinite" }} />
                    <p style={{ margin: 0, fontSize: 13, color: "#555" }}>{t("hire_modal.matches.loading", { cat: cat })}</p>
                  </div>
                ) : workerError ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: 28, margin: "0 0 10px" }}>⚠️</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#555", margin: 0 }}>{t("hire_modal.matches.error_title")}</p>
                    <p style={{ fontSize: 12, color: "#333", marginTop: 6 }}>{t("hire_modal.matches.error_desc")}</p>
                  </div>
                ) : matches.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: 28, margin: "0 0 10px" }}>😔</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#555", margin: 0 }}>{t("hire_modal.matches.empty_title", { cat: cat })}</p>
                    <p style={{ fontSize: 12, color: "#333", marginTop: 6 }}>{t("hire_modal.matches.empty_desc")}</p>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: "0 0 14px", fontSize: 12, color: "#555" }}>
                      {t("hire_modal.matches.available_summary", { count: matches.length, plural: matches.length !== 1 ? "s" : "", cat: cat })}
                      {form.district ? t("hire_modal.matches.sorted_proximity", { district: form.district }) : ""}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {matches.map((w, i) => {
                        const isSel     = selected.some(s => s.id === w.id);
                        const nearby    = (w.district ?? "") === form.district;
                        const disabled  = isMulti && !isSel && selected.length >= headcountNum;
                        return (
                          <WorkerRow
                            key={w.id} w={w} isSel={isSel} nearby={nearby}
                            isFirst={i === 0} isMulti={isMulti} disabled={disabled}
                            onClick={() => { if (!disabled) toggleWorker(w); }}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── STEP 2: ACCOUNT DETAILS (Only if not signed in) ── */}
            {step === 2 && !hasSession && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>
                  Please enter your contact details. This will automatically create an employer account to manage your hires.
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

            {/* ── STEP 2 or 3: SUMMARY & PAY ── */}
            {isReviewStep && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <SCard title={t("hire_modal.summary.title")}>
                  {([
                    ["Category",  cat],
                    ["Workers",   String(headcountNum)],
                    ["Rate",      `${fmt(budget)}${RATE_LABEL[form.rateType]} × ${headcountNum} worker${headcountNum !== 1 ? "s" : ""} × ${durationNum} ${getUnit(form.rateType, durationNum)}`],
                    ["Duration",  `${durationNum} ${getUnit(form.rateType, durationNum)}`],
                    ["Date",      dateLabel],
                    ["Time",      form.time || "-"],
                    ["Province",  form.province || "-"],
                    ["District",  form.district],
                    ...(form.latitude != null ? [["GPS", `${form.latitude.toFixed(5)}, ${form.longitude!.toFixed(5)}`]] : []),
                    ...(form.requirements ? [["Requirements", <RichTextDisplay content={form.requirements} />]] : []),
                  ] as [string, React.ReactNode][]).map(([k, v]) => <SRow key={String(k)} k={String(k)} v={v} />)}
                </SCard>

                {selected.length > 0 && (
                  <SCard title={selected.length > 1 ? t("hire_modal.summary.assigned_title") : t("hire_modal.summary.assigned_title_single")}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selected.map(w => (
                        <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
                          <Avatar name={w.name} photoUrl={w.photoUrl} />
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#f0f0f0" }}>{w.name}</p>
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                              <span>{w.categoryName ?? catLabel(w.experienceType ?? "")}
                                {(w.locationShort ?? w.district) ? ` · ${w.locationShort ?? w.district}` : ""}</span>
                              {(() => {
                                const r = ratingInfo(w.rating, w.ratingCount);
                                return (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#f97316", fontWeight: 700 }}>
                                    <Star size={10} color="#f97316" fill="#f97316" />
                                    {r.value}
                                  </span>
                                );
                              })()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SCard>
                )}

                {/* ESCROW / WALLET BLOCK */}
                <div style={{ marginTop: 24 }}>
                  <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#fff" }}>{t("hire_modal.summary.payment_title") || "Payment Details"}</p>

                  {/* escrow breakdown */}
                  {total > 0 && (
                    <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#666" }}>
                          Gross worker payout ({headcountNum} × {durationNum}h × {fmt(budget)})
                        </span>
                        <span style={{ fontSize: 12, color: "#d0d0d0", fontWeight: 600 }}>{fmt(jobAmount)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #1e1e1e" }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Platform fee{feePctLabel ? ` (${feePctLabel})` : ""} · non-refundable</span>
                        <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>+{fmt(fee)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: "#aaa", fontWeight: 700 }}>Total amount to pay</span>
                        <span style={{ fontSize: 14, color: "#f97316", fontWeight: 800 }}>{fmt(total)}</span>
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
                            {walletBal !== null ? fmt(walletBal) : "-"}{needsTopup ? " · not enough to cover this hire" : " · covers this hire"}
                          </span>
                        </div>
                        {!needsTopup && <CheckCircle size={18} color="#22c55e" />}
                      </div>
                      {needsTopup && (
                        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#aaa", lineHeight: 1.5 }}>
                          Pay <strong style={{ color: "#f97316" }}>{fmt(topupAmount)}</strong> below to fund this hire. It's added to your wallet and the full {fmt(total)} is held in escrow - it appears on your posting as a direct deposit.
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

                <p style={{ margin: "24px 0 0", fontSize: 11, color: "#444", lineHeight: 1.7, textAlign: "center" }}>
                  {t("hire_modal.summary.terms_warning")}
                </p>
              </div>
            )}

          </div>

          {/* FOOTER NAV */}
          <div style={{ padding: "16px 24px 20px", flexShrink: 0, borderTop: "1px solid #1e1e1e", display: "flex", gap: 10 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={btnBack}>← {t("common.buttons.back")}</button>
            )}
            {!isReviewStep ? (
              <button
                onClick={() => { if (canNext[step]) setStep(s => s + 1); }}
                disabled={!canNext[step]}
                style={{ ...btnPrimary, flex: 1, opacity: canNext[step] ? 1 : 0.45, cursor: canNext[step] ? "pointer" : "not-allowed" }}
              >
                {step === 1 && !selectionValid && matches.length > 0
                  ? t("hire_modal.matches.select_btn_need", { count: headcountNum - selected.length, plural: headcountNum - selected.length !== 1 ? "s" : "" })
                  : `${t("common.buttons.continue")} →`}
              </button>
            ) : (
              <button
                onClick={() => { setJobTitle(prev => prev.trim() || cat); setTitleModalOpen(true); }}
                disabled={submitting || !isPaymentDetailsValid}
                style={{ ...btnPrimary, flex: 1, opacity: (isPaymentDetailsValid && !submitting) ? 1 : 0.45, cursor: (isPaymentDetailsValid && !submitting) ? "pointer" : "not-allowed" }}
              >
                {submitting
                  ? t("hire_modal.summary.processing_btn") || "Processing…"
                  : t("hire_modal.summary.confirm_btn") || "Pay & hire now"}
              </button>
            )}
          </div>

          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </Overlay>

      {titleModalOpen && (
        <div onClick={() => !submitting && setTitleModalOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: Z.modalNested, background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          fontFamily: "Inter, DM Sans, system-ui, sans-serif",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 420, background: "#141414", border: "1px solid #2a2a2a", borderRadius: 16, padding: 22,
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f0f0", marginBottom: 4 }}>
              {t("post_job.title_confirm.heading") || "Name this job"}
            </div>
            <p style={{ fontSize: 12.5, color: "#8a8a8a", margin: "0 0 14px", lineHeight: 1.5 }}>
              {(t("post_job.title_confirm.desc") || "Confirm the job name or edit it. It stays a {cat} job.").replace("{cat}", cat)}
            </p>
            <input
              value={jobTitle} onChange={e => setJobTitle(e.target.value)} maxLength={120} autoFocus placeholder={cat}
              onKeyDown={e => { if (e.key === "Enter" && !submitting) { setTitleModalOpen(false); handleConfirmHire(); } }}
              style={{ width: "100%", background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 10, padding: "11px 13px", fontSize: 14, color: "#f0f0f0", outline: "none" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button disabled={submitting} onClick={() => { setTitleModalOpen(false); handleConfirmHire(); }}
                style={{ ...btnPrimary, flex: 1, opacity: submitting ? 0.5 : 1, cursor: submitting ? "not-allowed" : "pointer" }}>
                {t("post_job.title_confirm.confirm") || "Confirm & pay"}
              </button>
              <button onClick={() => setTitleModalOpen(false)} disabled={submitting}
                style={{ flex: 1, background: "transparent", color: "#888", border: "1px solid #2a2a2a", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {t("common.buttons.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── WorkerRow ─────────────────────────────────────────────────────────────────
function WorkerRow({ w, isSel, nearby, isFirst, isMulti, disabled, onClick }: {
  w: WorkerProfileDto; isSel: boolean; nearby: boolean;
  isFirst: boolean; isMulti: boolean; disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useLanguage();
  const year = sinceYear(w.memberSince as any);
  const days = w.availability?.slice(0, 3) ?? [];

  return (
    <div className={`wrow${disabled ? " disabled" : ""}`} onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      background: isSel ? "rgba(249,115,22,0.05)" : "#141414",
      border: `1px solid ${isSel ? "#f97316" : "#2a2a2a"}`,
      borderRadius: 12, padding: "12px 14px",
    }}>
      <Avatar name={w.name} photoUrl={w.photoUrl} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#f0f0f0" }}>{w.name}</p>
          {isFirst && (
            <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "2px 7px", background: "rgba(249,115,22,0.12)", color: "#f97316" }}>
              {t("hire_modal.matches.best_match")}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {(() => {
            const r = ratingInfo(w.rating, w.ratingCount);
            return (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Star size={10} color="#f97316" fill="#f97316" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f97316" }}>{r.value}</span>
              </span>
            );
          })()}
          {w.experienceType && (
            <>
              <span style={{ fontSize: 11, color: "#333" }}>·</span>
              <span style={{ fontSize: 11, color: "#666" }}>{w.categoryName ?? catLabel(w.experienceType)}</span>
            </>
          )}
          {(w.locationShort ?? w.district) && (
            <>
              <span style={{ fontSize: 11, color: "#333" }}>·</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <MapPin size={10} color={nearby ? "#22c55e" : "#444"} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: nearby ? "#22c55e" : "#555" }}>
                  {w.locationShort ?? w.district}{nearby ? ` · ${t("hire_modal.matches.nearby")}` : ""}
                </span>
              </span>
            </>
          )}
          <span style={{ fontSize: 11, color: "#333" }}>·</span>
          <span style={{ fontSize: 11, color: "#444" }}>{t("hire_modal.matches.since_year", { year })}</span>
        </div>
        {days.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {days.map(d => (
              <span key={d} style={{
                fontSize: 10, padding: "2px 6px", borderRadius: 6,
                background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#666",
              }}>{d}</span>
            ))}
            {w.availability.length > 3 && (
              <span style={{ fontSize: 10, color: "#444" }}>{t("hire_modal.matches.more_avail", { count: w.availability.length - 3 })}</span>
            )}
          </div>
        )}
      </div>
      {/* Selector */}
      {isMulti ? (
        <div style={{
          flexShrink: 0, width: 18, height: 18, borderRadius: 4,
          border: `2px solid ${isSel ? "#f97316" : "#2a2a2a"}`,
          background: isSel ? "#f97316" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isSel && <span style={{ fontSize: 11, color: "#fff", fontWeight: 900, lineHeight: 1 }}>✓</span>}
        </div>
      ) : (
        <div style={{
          flexShrink: 0, width: 20, height: 20, borderRadius: 999,
          border: `2px solid ${isSel ? "#f97316" : "#2a2a2a"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isSel && <div style={{ width: 10, height: 10, borderRadius: 999, background: "#f97316" }} />}
        </div>
      )}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  return (
    <div style={{
      flexShrink: 0, width: 40, height: 40, borderRadius: 999, overflow: "hidden",
      background: "rgba(249,115,22,0.1)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 15, fontWeight: 800, color: "#f97316",
    }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        name[0]?.toUpperCase()
      )}
    </div>
  );
}

// ── SearchSelect ──────────────────────────────────────────────────────────────
function SearchSelect({ options, value, onChange, placeholder, icon }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
}) {
  const [query, setQuery] = useState(options.find(o => o.value === value)?.label ?? "");
  const [open,  setOpen]  = useState(false);

  useEffect(() => {
    setQuery(options.find(o => o.value === value)?.label ?? "");
  }, [value, options]);

  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{ position: "relative" }}>
      {icon}
      <input
        type="text" value={query} placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => {
            setOpen(false);
            setQuery(options.find(o => o.value === value)?.label ?? "");
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
          maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        }}>
          {filtered.map(o => (
            <div key={o.value}
              onMouseDown={e => { e.preventDefault(); onChange(o.value); setQuery(o.label); setOpen(false); }}
              style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, color: value === o.value ? "#f97316" : "#d0d0d0" }}
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

// ── primitives ───────────────────────────────────────────────────────────────
function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: Z.modal,
      background: "rgba(0,0,0,0.88)",
      backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", fontFamily: "Inter, DM Sans, system-ui, sans-serif",
    }}>
      {children}
    </div>
  );
}

function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</p>
      {children}
    </div>
  );
}

function SRow({ k, v }: { k: string; v: React.ReactNode }) {
  const { t } = useLanguage();
  const label = k === "Category" ? t("hire_modal.summary.category_label") || "Category"
              : k === "Workers" ? t("hire_modal.summary.workers_label") || "Workers"
              : k === "Rate" ? t("hire_modal.summary.rate_label") || "Rate"
              : k === "Duration" ? t("hire_modal.summary.duration_label") || "Duration"
              : k === "Date" ? t("hire_modal.summary.date_label") || "Date"
              : k === "Time" ? t("hire_modal.summary.time_label") || "Time"
              : k === "Province" ? t("hire_modal.summary.province_label") || "Province"
              : k === "District" ? t("hire_modal.summary.district_label") || "District"
              : k === "GPS" ? t("hire_modal.summary.gps_label") || "GPS"
              : k === "Requirements" ? t("hire_modal.summary.requirements_label") || "Requirements"
              : k;

  if (k === "Requirements") {
    return (
      <div style={{ display: "flex", flexDirection: "column", padding: "8px 0", borderBottom: "1px solid #1a1a1a", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
        <div style={{ fontSize: 12, color: "#f0f0f0", textAlign: "left", background: "rgba(0,0,0,0.2)", padding: "10px 14px", borderRadius: 10, border: "1px solid #2a2a2a" }}>
          {v}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0", borderBottom: "1px solid #1a1a1a", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#555", flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#f0f0f0", textAlign: "right", wordBreak: "break-word" }}>{v}</span>
    </div>
  );
}
