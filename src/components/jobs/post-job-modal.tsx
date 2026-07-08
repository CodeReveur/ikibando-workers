"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  X, Calendar, Clock, Users, ChevronDown,
  CheckCircle, AlarmClock, Loader2, Navigation, Search, MapPin,
} from "lucide-react";
import { JOB_CATEGORIES, RWANDA_PROVINCES, CURRENCY, MIN_RATE_BY_PERIOD } from "@/lib/constants";
import { Sectors, Cells, Villages } from "rwanda";
import { postJob, postGuestJob, getWallet, apiError, checkGuestAccount } from "@/lib/api";
import { runWalletTopup, runGuestPayment, isCardMethod, type PayMethod } from "@/lib/pay-flow";
import { saveRedirect } from "@/lib/auth-redirect";
import { useToast } from "@/components/ui/toast";
import { RichTextEditor, RichTextDisplay } from "@/components/ui/rich-text-editor";
import { useSession, type Session } from "@/components/dashboard/session-ctx";
import { PayMethodSelector, type PayMethodValue } from "@/components/ui/pay-logos";

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

// Map our province labels to the `rwanda` dataset's short names so we can look up the
// sector/cell/village hierarchy (same constant dataset the registration wizard uses).
const PKG_PROVINCE: Record<string, string> = {
  "City of Kigali": "Kigali",
  "Northern Province": "North",
  "Southern Province": "South",
  "Eastern Province": "East",
  "Western Province": "West",
};

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
  latitude:  number | null;
  longitude: number | null;
  ratePerHour: string;
  rateType: RateType;
  notes: string;
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
  // context is null there. Fall back to the persisted "user" in localStorage — the same
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
  const [paymentPhone, setPaymentPhone] = useState("");
  const [payNote, setPayNote] = useState("");

  const [job, setJob] = useState<JobForm>({
    category: "", headcount: "1", date: "", time: "",
    durationHours: "4", province: "", district: "",
    sector: "", cell: "", village: "",
    latitude: null, longitude: null,
    ratePerHour: "", rateType: "hr", notes: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof JobForm, string>>>({});

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
    const defaultLabel = JOB_CATEGORIES.find(c => c.value === value)?.label ?? value;
    return t(`common.categories.${value}`) || defaultLabel;
  };

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

      const jobPayload = {
        category:      job.category,
        province:      job.province || undefined,
        district:      job.district,
        sector:        job.sector  || undefined,
        cell:          job.cell    || undefined,
        village:       job.village || undefined,
        latitude:      job.latitude  ?? undefined,
        longitude:     job.longitude ?? undefined,
        ratePerHour:   parseInt(job.ratePerHour),
        headcount:     parseInt(job.headcount) || 1,
        urgency:       "SAME_DAY" as const,
        startTime,
        durationHours: parseInt(job.durationHours) || 1,
        rateType,
        locationNotes: job.notes || undefined,
      };

      // payMethod is one of the 4 gateway methods (default MTN_MOMO); WALLET is never selected.
      const method = (payMethod === "WALLET" ? "MTN_MOMO" : payMethod) as PayMethod;
      const card = isCardMethod(method);
      const awaitingNote = card
        ? "Opening the secure card page… complete your payment there."
        : "Sent a prompt to your phone — approve it to continue.";

      if (!hasSession) {
        // Guest: take the real payment first (phase 1), then create the job (phase 2).
        const guestPayload = {
          job: jobPayload,
          guestName:  anonName,
          guestEmail: anonEmail,
          guestPhone: anonPhone,
          paymentMethod: method,
          paymentPhone: paymentPhone || anonPhone || undefined,
        };
        setPayNote(awaitingNote);
        const outcome = await runGuestPayment(guestPayload);
        if (outcome !== "success") {
          setPayNote("");
          toastError(outcome === "pending"
            ? "Payment not confirmed yet. If you were charged, it will reflect shortly — please try again."
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
      // shortfall via MoMo/Airtel/Card and wait for it to settle — that money lands in the
      // wallet, then postJob freezes the full escrow from the wallet (never a direct-to-job
      // payment). A low-balance posting therefore reads as a direct deposit.
      if (walletBal === null || walletBal < escrow) {
        const topupAmount = walletBal === null ? escrow : Math.max(0, escrow - walletBal);
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
              ? "Payment not confirmed yet. If you were charged, it will reflect shortly — please try again."
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
  const hours       = parseInt(job.durationHours) || 0;
  const heads       = parseInt(job.headcount) || 1;
  const baseCost    = rate * hours * heads;
  const escrowFee   = Math.round(baseCost * 0.05);
  const escrow      = baseCost + escrowFee;      // employer pays gross + 5% fee
  const platformFee = Math.round(baseCost * 0.25);
  const workerPay   = baseCost - platformFee;      // net workers receive (75%)
  const catLabel = getLocalizedCategoryLabel(job.category);
  const dateLabel = job.date
    ? new Date(job.date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "-";
  const locationLabel = [getLocalizedProvinceLabel(job.province), job.district].filter(Boolean).join(" › ");

  // Cascading Rwanda location options (constant geographic names, same in every language).
  const pkgProvince   = PKG_PROVINCE[job.province] ?? job.province;
  const sectorOpts    = (job.province && job.district) ? (Sectors({ province: pkgProvince, district: job.district }) ?? []) : [];
  const cellOpts      = (job.sector) ? (Cells({ province: pkgProvince, district: job.district, sector: job.sector }) ?? []) : [];
  const villageOpts   = (job.cell) ? (Villages({ province: pkgProvince, district: job.district, sector: job.sector, cell: job.cell }) ?? []) : [];

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
                [t("post_job.fields.duration") || "Duration",  `${job.durationHours} ${getUnit(job.rateType, hours)}`],
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
  const needsTopup    = walletBal === null || walletBal < escrow;
  const topupAmount   = walletBal === null ? escrow : Math.max(0, escrow - walletBal);
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

                {/* Category — searchable */}
                <FField label={t("post_job.labels.category") || "Job category *"} error={errors.category}>
                  <SearchSelect
                    options={JOB_CATEGORIES.map(c => ({ value: c.value, label: getLocalizedCategoryLabel(c.value) }))}
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
                  <FField label={t("post_job.labels.rate_period") || "Rate period"}>
                    <div style={{ position: "relative" }}>
                      <select value={job.rateType} onChange={e => setJob(f => ({ ...f, rateType: e.target.value as RateType }))}
                        style={{ ...inp, appearance: "none", paddingRight: 28, color: "#f0f0f0" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      >
                        <option value="hr">{t("post_job.options.per_hour") || "Per hour"}</option>
                        <option value="day">{t("post_job.options.per_day") || "Per day"}</option>
                        <option value="week">{t("post_job.options.per_week") || "Per week"}</option>
                        <option value="month">{t("post_job.options.per_month") || "Per month"}</option>
                        <option value="year">{t("post_job.options.per_year") || "Per year"}</option>
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
                        {getDurations(job.rateType).map(h => <option key={h} value={String(h)}>{h} {getUnit(job.rateType, h)}</option>)}
                      </select>
                      <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  </FField>
                </div>
                
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

                {/* Province + District — searchable */}
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

                {/* Sector → Cell → Village — cascading, from the same Rwanda dataset as sign-up.
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

                {/* Rate */}
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
                    [t("post_job.fields.duration") || "Duration",  `${job.durationHours} ${getUnit(job.rateType, hours)}`],
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
                        <span style={{ fontSize: 12, color: "#666" }}>Gross worker payout ({heads} × {hours}h × {fmt(rate)})</span>
                        <span style={{ fontSize: 12, color: "#d0d0d0", fontWeight: 600 }}>{fmt(baseCost)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Platform handling charge (5% fee)</span>
                        <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>+{fmt(escrowFee)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, paddingBottom: 8, borderTop: "1px solid #1e1e1e" }}>
                        <span style={{ fontSize: 13, color: "#aaa", fontWeight: 700 }}>Total amount to pay</span>
                        <span style={{ fontSize: 14, color: "#f97316", fontWeight: 800 }}>{fmt(escrow)}</span>
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
                            {walletBal !== null ? fmt(walletBal) : "—"}{needsTopup ? " · not enough to cover this job" : " · covers this job"}
                          </span>
                        </div>
                        {!needsTopup && <CheckCircle size={18} color="#22c55e" />}
                      </div>
                      {needsTopup && (
                        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#aaa", lineHeight: 1.5 }}>
                          Pay <strong style={{ color: "#f97316" }}>{fmt(topupAmount)}</strong> below to fund this job. It's added to your wallet and the full {fmt(escrow)} is held in escrow — it appears on your posting as a direct deposit.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Payment methods — only shown for guests, or to top up a short wallet */}
                  {showPayMethods && (
                  <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase" }}>
                      {hasSession ? `Top up ${fmt(topupAmount)} via` : "Select Payment Method"}
                    </p>

                    <PayMethodSelector value={payMethod as PayMethodValue} onChange={setPayMethod} />
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
                  onClick={handlePost}
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
