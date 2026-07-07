"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { X, Calendar, Clock, CheckCircle, Bell, MapPin, Navigation, Loader2 } from "lucide-react";
import { RWANDA_PROVINCES } from "@/lib/constants";
import { postJob, postGuestJob, applyForJob, updateApplicationStatus, getWallet, topupWallet, type WorkerProfileDto } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";
import { useSession } from "@/components/dashboard/session-ctx";

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
      }}>
        Loading map…
      </div>
    ),
  }
);

// ── helpers ──────────────────────────────────────────────────────────────────
function allDistricts() {
  return RWANDA_PROVINCES.flatMap(p => [...p.districts]);
}
function districtsFor(province: string) {
  const p = RWANDA_PROVINCES.find(p => p.label === province);
  return p ? [...p.districts] : allDistricts();
}

interface Props { worker: WorkerProfileDto; onClose: () => void; }

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

type RateType = "hr" | "day" | "week" | "month" | "year";
const getDurations = (rt: RateType) => {
  if (rt === "hr") return [1, 2, 3, 4, 6, 8, 10, 12];
  if (rt === "day") return Array.from({length: 30}, (_, i) => i + 1);
  if (rt === "week") return Array.from({length: 12}, (_, i) => i + 1);
  if (rt === "month") return Array.from({length: 12}, (_, i) => i + 1);
  if (rt === "year") return Array.from({length: 5}, (_, i) => i + 1);
  return [1];
};
const RATE_LABEL: Record<RateType, string> = { hr:"/hr", day:"/day", week:"/wk", month:"/mo", year:"/yr" };

// ── styles ───────────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
  backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 999, padding: 16, fontFamily: "Inter, DM Sans, system-ui, sans-serif",
};
const card: React.CSSProperties = {
  background: "#1a1a1a", border: "1px solid #272727", borderRadius: 20,
  width: "100%", maxWidth: 440,
  display: "flex", flexDirection: "column", maxHeight: "92vh", overflow: "hidden",
};
const inp: React.CSSProperties = {
  width: "100%", background: "#141414", border: "1px solid #2a2a2a",
  borderRadius: 10, padding: "10px 12px", fontSize: 13,
  color: "#f0f0f0", outline: "none", fontFamily: "inherit",
  boxSizing: "border-box",
};
const iconL: React.CSSProperties = { position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" };

export function OfferModal({ worker, onClose }: Props) {
  const { t } = useLanguage();
  const { error: toastError } = useToast();

  const [step, setStep]         = useState(0);
  const [submitting, setSub]   = useState(false);
  const [walletBal, setWalletBal] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const session = useSession();
  const hasSession = !!(session && session.role === "EMPLOYER");

  // Anonymous user fields
  const [anonName, setAnonName] = useState("");
  const [anonEmail, setAnonEmail] = useState("");
  const [anonPhone, setAnonPhone] = useState("");

  // Payment method fields
  const [payMethod, setPayMethod] = useState<"WALLET" | "MTN_MOMO" | "AIRTEL_MONEY" | "VISA" | "MASTERCARD">("MTN_MOMO");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const [title,    setTitle]    = useState("");
  const [date,     setDate]     = useState("");
  const [time,     setTime]     = useState("");
  const [rateType, setRateType] = useState<RateType>("hr");
  const [duration, setDuration] = useState("4");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [latitude,  setLat]    = useState<number | null>(null);
  const [longitude, setLng]    = useState<number | null>(null);
  const [bid,      setBid]      = useState("");
  const [done,     setDone]     = useState(false);
  const [gpsStatus, setGps]    = useState<"idle"|"loading"|"ok"|"error">("idle");

  const getUnit = (rt: RateType, n: number) => {
    if (rt === "hr") return t(n !== 1 ? "post_job.units.hours" : "post_job.units.hour") || `hour${n !== 1 ? "s" : ""}`;
    if (rt === "day") return t(n !== 1 ? "post_job.units.days" : "post_job.units.day") || `day${n !== 1 ? "s" : ""}`;
    if (rt === "week") return t(n !== 1 ? "post_job.units.weeks" : "post_job.units.week") || `week${n !== 1 ? "s" : ""}`;
    if (rt === "month") return t(n !== 1 ? "post_job.units.months" : "post_job.units.month") || `month${n !== 1 ? "s" : ""}`;
    if (rt === "year") return t(n !== 1 ? "post_job.units.years" : "post_job.units.year") || `year${n !== 1 ? "s" : ""}`;
    return "";
  };

  const getLocalizedProvinceLabel = (prov: string) => {
    if (!prov) return "";
    const key = prov.toLowerCase().replace(/\s+/g, "_");
    return t(`common.provinces.${key}`) || prov;
  };

  const DRAFT_KEY = `MpahMapu_draft_offer_${worker.id}`;

  useEffect(() => {
    if (hasSession) {
      setPayMethod("WALLET");
    } else {
      setPayMethod("MTN_MOMO");
    }
  }, [hasSession]);

  // Restore draft on open
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.title)    setTitle(d.title);
        if (d.date)     setDate(d.date);
        if (d.time)     setTime(d.time);
        if (d.rateType) setRateType(d.rateType);
        if (d.duration) setDuration(d.duration);
        if (d.province) setProvince(d.province);
        if (d.district) setDistrict(d.district);
        if (d.latitude  != null) setLat(d.latitude);
        if (d.longitude != null) setLng(d.longitude);
        if (d.bid)      setBid(d.bid);
      }
      const tokenVal = localStorage.getItem("access_token");
      if (tokenVal) {
        setToken(tokenVal);
        getWallet(tokenVal).then(w => setWalletBal(w.balance)).catch(() => {});
      }
    } catch {}
  }, []);

  // Save draft on any change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        title, date, time, rateType, duration, province, district, latitude, longitude, bid,
      }));
    } catch {}
  }, [title, date, time, rateType, duration, province, district, latitude, longitude, bid]);

  const bidNum = parseFloat(bid) || 0;
  const bidOk  = bidNum > 0;

  const rate        = parseFloat(bid) || 0;
  const hours       = parseFloat(duration) || 0;
  const baseCost    = rate * hours;
  const escrowFee   = Math.round(baseCost * 0.05);
  const total       = baseCost + escrowFee;
  const platformFee = Math.round(baseCost * 0.25);
  const workerPay   = baseCost - platformFee;

  const stepsList = hasSession
    ? [t("offer.steps.details") || "Offer details", t("offer.steps.review") || "Review & Pay"]
    : [t("offer.steps.details") || "Offer details", "Account details", t("offer.steps.review") || "Review & Pay"];

  const isReviewStep = hasSession ? (step === 1) : (step === 2);
  const isPaymentDetailsValid = payMethod === "WALLET"
    ? (walletBal !== null && walletBal >= total)
    : (payMethod === "MTN_MOMO" || payMethod === "AIRTEL_MONEY"
       ? !!(paymentPhone || anonPhone || session?.phone)
       : !!(cardNumber && cardExpiry && cardCvv));

  const canNext = hasSession
    ? [
        !!(title && date && time && duration && district && bidOk),
        isPaymentDetailsValid
      ]
    : [
        !!(title && date && time && duration && district && bidOk),
        !!(anonName && anonEmail && anonPhone),
        isPaymentDetailsValid
      ];

  function detectGps() {
    if (!navigator.geolocation) { setGps("error"); return; }
    setGps("loading");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(+pos.coords.latitude.toFixed(7));
        setLng(+pos.coords.longitude.toFixed(7));
        setGps("ok");
      },
      () => setGps("error"),
      { timeout: 10000 }
    );
  }

  async function handleConfirmOffer() {
    setSub(true);
    try {
      const startTime = date && time
        ? `${date}T${time}:00Z`
        : new Date().toISOString();

      const rt = rateType === "hr" ? "PER_HOUR"
        : rateType === "day" ? "PER_DAY"
        : rateType === "week" ? "PER_WEEK"
        : rateType === "month" ? "PER_MONTH" : "PER_YEAR";

      const jobPayload = {
        category: worker.experienceType || "OTHER",
        district: district,
        province: province || undefined,
        latitude: latitude ?? undefined, longitude: longitude ?? undefined,
        ratePerHour: Math.round(rate),
        headcount: 1,
        urgency: "IMMEDIATE" as const,
        startTime, durationHours: Math.round(hours),
        rateType: rt,
      };

      if (!hasSession) {
        // Guest direct offer — post the private job and assign this worker server-side.
        await postGuestJob({
          job: jobPayload,
          guestName: anonName,
          guestEmail: anonEmail,
          guestPhone: anonPhone,
          paymentMethod: payMethod === "WALLET" ? "MTN_MOMO" : payMethod,
          paymentPhone: paymentPhone || anonPhone || undefined,
          workerIds: [worker.id as unknown as string],
          appliedVia: "HIRE_NOW",
        });
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        setDone(true);
        return;
      }

      const activeToken = localStorage.getItem("access_token") || token;
      if (!activeToken) throw new Error("Failed to authenticate session");

      // Top up from momo/card when paying without wallet balance.
      if (payMethod !== "WALLET") {
        await topupWallet({
          amount: total,
          phoneNumber: paymentPhone || session?.phone || "0780000000",
          paymentMethod: payMethod,
          notes: "direct payment"
        }, activeToken);
      }

      // Create a direct private job for this worker
      const job = await postJob(jobPayload, activeToken);

      // Apply worker to this job and accept
      const app = await applyForJob(job.id as unknown as string, { bestFit: "Direct Offer selection", appliedVia: "HIRE_NOW", workerId: worker.id as unknown as string }, activeToken);
      await updateApplicationStatus(app.id as unknown as string, { status: "ACCEPTED" }, activeToken);

      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setDone(true);
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? e?.message ?? "Payment failed. Please try again.", { title: "Offer Failed" });
    } finally {
      setSub(false);
    }
  }

  if (done) return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...card, padding: 24, overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, margin: "0 auto 16px", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle size={28} color="#22c55e" />
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: "#fff" }}>
            {t("offer.success.title")}
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#555", lineHeight: 1.65 }}>
            {t("offer.success.desc", { name: worker.name })}
          </p>
          <div style={{ background: "#141414", border: "1px solid #272727", borderRadius: 12, padding: "14px", textAlign: "left", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Bell size={12} color="#f97316" />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t("offer.success.notification")}
              </span>
            </div>
            {([
              [t("offer.fields.job") || "Job",      title],
              [t("offer.fields.date") || "Date",     new Date(date + "T00:00").toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" }) + " · " + time],
              [t("offer.fields.duration") || "Duration", `${duration} ${getUnit(rateType, parseInt(duration) || 1)}`],
              [t("offer.fields.province") || "Province", getLocalizedProvinceLabel(province) || "-"],
              [t("offer.fields.district") || "District", district],
              ...(latitude != null ? [["GPS", `${latitude.toFixed(5)}, ${longitude!.toFixed(5)}`]] : []),
              [t("offer.fields.offer") || "Offer",    fmt(bidNum) + " " + RATE_LABEL[rateType]],
            ] as [string, string][]).map(([k, v]) => (
              <p key={k} style={{ margin: "0 0 4px", fontSize: 12, color: k === (t("offer.fields.offer") || "Offer") ? "#f97316" : "#aaa" }}>
                <strong style={{ color: "#555", fontWeight: 600 }}>{k}:</strong> {v}
              </p>
            ))}
          </div>
          <button onClick={onClose} style={{ background: "#141414", border: "1px solid #272727", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 700, color: "#aaa", cursor: "pointer", fontFamily: "inherit" }}>
            {t("offer.fields.done") || "Done"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>

        {/* header */}
        <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Step {step + 1} of {stepsList.length}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 900, color: "#fff" }}>
                {stepsList[step]}
              </p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}><X size={18} /></button>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {stepsList.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 999,
                background: i <= step ? "#f97316" : "#272727",
                transition: "background 0.3s",
              }} />
            ))}
          </div>
        </div>

        {/* scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 4px" }}>

          {/* ── STEP 0: JOB DETAILS ── */}
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* job title */}
              <FField label={t("offer.labels.title") || "Job title *"}>
                <input placeholder={t("offer.placeholders.title") || "e.g. Waiter for wedding event"}
                  value={title} onChange={e => setTitle(e.target.value)} style={inp}
                  onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
              </FField>

              {/* date + time */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FField label={t("offer.labels.start_date") || "Start date *"}>
                  <div style={{ position: "relative" }}>
                    <Calendar size={13} color="#444" style={iconL} />
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                      style={{ ...inp, paddingLeft: 34, colorScheme: "dark" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                      onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    />
                  </div>
                </FField>
                <FField label={t("offer.labels.start_time") || "Start time *"}>
                  <div style={{ position: "relative" }}>
                    <Clock size={13} color="#444" style={iconL} />
                    <input type="time" value={time} onChange={e => setTime(e.target.value)}
                      style={{ ...inp, paddingLeft: 34, colorScheme: "dark" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                      onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    />
                  </div>
                </FField>
              </div>

              {/* rate period + duration */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FField label={t("offer.labels.rate_period") || "Rate period"}>
                  <div style={{ position: "relative" }}>
                    <select value={rateType} onChange={e => setRateType(e.target.value as RateType)}
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
                    <svg style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </FField>
                <FField label={t("offer.labels.duration") || "Duration *"}>
                  <div style={{ position: "relative" }}>
                    <select value={duration} onChange={e => setDuration(e.target.value)}
                      style={{ ...inp, appearance: "none", WebkitAppearance: "none", cursor: "pointer", color: duration ? "#f0f0f0" : "#555", paddingRight: 28 }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                      onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    >
                      {getDurations(rateType).map(h => <option key={h} value={String(h)}>{h} {getUnit(rateType, h)}</option>)}
                    </select>
                    <svg style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </FField>
              </div>

              {/* Province + District — searchable */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FField label={t("offer.labels.province") || "Province"}>
                  <SearchSelect
                    options={RWANDA_PROVINCES.map(p => ({ value: p.label, label: getLocalizedProvinceLabel(p.label) }))}
                    value={province}
                    onChange={v => { setProvince(v); setDistrict(""); }}
                    placeholder={t("offer.placeholders.province") || "Province…"}
                    icon={<MapPin size={13} color="#444" style={iconL} />}
                  />
                </FField>
                <FField label={t("offer.labels.district") || "District *"}>
                  <SearchSelect
                    options={districtsFor(province).map(d => ({ value: d, label: d }))}
                    value={district}
                    onChange={setDistrict}
                    placeholder={t("offer.placeholders.district") || "District…"}
                    icon={<MapPin size={13} color="#444" style={iconL} />}
                  />
                </FField>
              </div>

              {/* Map + GPS */}
              <FField label={t("offer.labels.precise_location") || "Precise location (click map or use GPS)"}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <MapPicker
                    lat={latitude} lng={longitude}
                    onChange={(lat, lng) => { setLat(lat); setLng(lng); }}
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
                      {gpsStatus === "loading"
                        ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                        : <Navigation size={12} />}
                      {gpsStatus === "loading"
                        ? (t("offer.gps.detecting") || "Detecting…")
                        : gpsStatus === "ok"
                          ? (t("offer.gps.detected") || "GPS detected")
                          : (t("offer.gps.detect") || "Detect my GPS")}
                    </button>
                    {gpsStatus === "error" && <span style={{ fontSize: 11, color: "#ef4444" }}>{t("offer.gps.error") || "Could not access GPS"}</span>}
                    {latitude != null && longitude != null && (
                      <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>
                        {latitude.toFixed(5)}, {longitude.toFixed(5)}
                      </span>
                    )}
                  </div>
                </div>
              </FField>

              {/* offer price */}
              <FField label={t("offer.labels.offer_price", { period: RATE_LABEL[rateType] }) || `Your offer price ${RATE_LABEL[rateType]} (RWF) *`}>
                <input type="number" min={1} placeholder={t("offer.placeholders.rate") || "e.g. 8000"}
                  value={bid} onChange={e => setBid(e.target.value)}
                  style={{ ...inp, fontWeight: bidNum > 0 ? 700 : 400 }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
              </FField>

            </div>
          )}

          {/* ── STEP 1: ACCOUNT DETAILS (Only if not signed in) ── */}
          {step === 1 && !hasSession && (
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
            </div>
          )}

          {/* ── STEP 1 or 2: REVIEW & PAYMENT ── */}
          {isReviewStep && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Job Details
                </p>
                {([
                  ["Job",        title],
                  ["Worker",     worker.name],
                  ["Date",       new Date(date + "T00:00").toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" }) + " · " + time],
                  ["Duration",   `${duration} ${getUnit(rateType, parseInt(duration) || 1)}`],
                  ["Province",   getLocalizedProvinceLabel(province) || "-"],
                  ["District",   district],
                  ...(latitude != null ? [["GPS", `${latitude.toFixed(5)}, ${longitude!.toFixed(5)}`]] : []),
                  ["Offer Rate", fmt(rate) + " " + RATE_LABEL[rateType]],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <span style={{ fontSize: 12, color: "#555" }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#f0f0f0" }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* ESCROW / WALLET BLOCK */}
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#fff" }}>Payment Details</p>

                {/* escrow breakdown */}
                {total > 0 && (
                  <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#666" }}>Worker payout ({duration}h × {fmt(rate)})</span>
                      <span style={{ fontSize: 12, color: "#d0d0d0", fontWeight: 600 }}>{fmt(baseCost)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #1e1e1e" }}>
                      <span style={{ fontSize: 12, color: "#666" }}>Platform handling charge (5% fee)</span>
                      <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>+{fmt(escrowFee)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "#aaa", fontWeight: 700 }}>Total amount to pay</span>
                      <span style={{ fontSize: 14, color: "#f97316", fontWeight: 800 }}>{fmt(total)}</span>
                    </div>
                  </div>
                )}

                {/* Payment methods selector */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase" }}>Select Payment Method</p>
                  
                  {hasSession && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#141414", border: payMethod === "WALLET" ? "1px solid #f97316" : "1px solid #2a2a2a", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}>
                      <input type="radio" name="payMethod" value="WALLET" checked={payMethod === "WALLET"} onChange={() => setPayMethod("WALLET")} style={{ accentColor: "#f97316" }} />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Pay from Wallet Balance</span>
                        <span style={{ fontSize: 11, color: walletBal !== null && walletBal < total ? "#ef4444" : "#22c55e" }}>
                          Available balance: {walletBal !== null ? fmt(walletBal) : "—"}
                        </span>
                      </div>
                    </label>
                  )}

                  <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#141414", border: payMethod === "MTN_MOMO" ? "1px solid #f97316" : "1px solid #2a2a2a", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}>
                    <input type="radio" name="payMethod" value="MTN_MOMO" checked={payMethod === "MTN_MOMO"} onChange={() => setPayMethod("MTN_MOMO")} style={{ accentColor: "#f97316" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>MTN Mobile Money</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#141414", border: payMethod === "AIRTEL_MONEY" ? "1px solid #f97316" : "1px solid #2a2a2a", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}>
                    <input type="radio" name="payMethod" value="AIRTEL_MONEY" checked={payMethod === "AIRTEL_MONEY"} onChange={() => setPayMethod("AIRTEL_MONEY")} style={{ accentColor: "#f97316" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Airtel Money</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#141414", border: (payMethod === "VISA" || payMethod === "MASTERCARD") ? "1px solid #f97316" : "1px solid #2a2a2a", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}>
                    <input type="radio" name="payMethod" value="VISA" checked={payMethod === "VISA" || payMethod === "MASTERCARD"} onChange={() => setPayMethod("VISA")} style={{ accentColor: "#f97316" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Visa / Mastercard</span>
                  </label>
                </div>

                {/* Payment method fields */}
                {(payMethod === "MTN_MOMO" || payMethod === "AIRTEL_MONEY") && (
                  <FField label="Mobile Money Phone Number *">
                    <input type="text" placeholder="e.g. 0780000000" value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} style={inp} />
                  </FField>
                )}

                {(payMethod === "VISA" || payMethod === "MASTERCARD") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                      <button type="button" onClick={() => setPayMethod("VISA")} style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: payMethod === "VISA" ? "1px solid #f97316" : "1px solid #222", background: payMethod === "VISA" ? "rgba(249,115,22,0.06)" : "#0a0a0a", color: "#fff" }}>Visa</button>
                      <button type="button" onClick={() => setPayMethod("MASTERCARD")} style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: payMethod === "MASTERCARD" ? "1px solid #f97316" : "1px solid #222", background: payMethod === "MASTERCARD" ? "rgba(249,115,22,0.06)" : "#0a0a0a", color: "#fff" }}>Mastercard</button>
                    </div>
                    <FField label="Card Number">
                      <input type="text" placeholder="4111 2222 3333 4444" value={cardNumber} onChange={e => setCardNumber(e.target.value)} style={inp} />
                    </FField>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <FField label="Expiry Date">
                        <input type="text" placeholder="MM/YY" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} style={inp} />
                      </FField>
                      <FField label="CVV">
                        <input type="password" placeholder="123" value={cardCvv} onChange={e => setCardCvv(e.target.value)} style={inp} />
                      </FField>
                    </div>
                  </div>
                )}

                {payMethod === "WALLET" && walletBal !== null && walletBal < total && (
                  <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", marginTop: 10 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#ef4444", lineHeight: 1.5 }}>
                      Insufficient wallet balance (missing {fmt(total - walletBal)}).{" "}
                      <span style={{ color: "#f97316", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} onClick={() => setPayMethod("MTN_MOMO")}>
                        Use direct deposit payment instead
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* footer */}
        <div style={{ padding: "16px 20px 20px", flexShrink: 0, borderTop: "1px solid #1e1e1e", display: "flex", gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ background: "#141414", border: "1px solid #272727", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, color: "#aaa", cursor: "pointer", fontFamily: "inherit" }}>
              ← Back
            </button>
          )}
          {!isReviewStep ? (
            <button
              onClick={() => { if (canNext[step]) setStep(s => s + 1); }}
              disabled={!canNext[step]}
              style={{
                flex: 1, background: canNext[step] ? "#f97316" : "#141414",
                border: canNext[step] ? "none" : "1px solid #272727",
                borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700,
                color: canNext[step] ? "#fff" : "#444",
                cursor: canNext[step] ? "pointer" : "not-allowed", fontFamily: "inherit",
                transition: "background 0.15s",
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleConfirmOffer}
              disabled={submitting || !isPaymentDetailsValid}
              style={{
                flex: 1, background: isPaymentDetailsValid ? "#f97316" : "#141414",
                border: isPaymentDetailsValid ? "none" : "1px solid #272727",
                borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700,
                color: isPaymentDetailsValid ? "#fff" : "#444",
                cursor: isPaymentDetailsValid ? "pointer" : "not-allowed", fontFamily: "inherit",
                transition: "background 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}
            >
              {submitting && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
              {submitting
                ? "Processing…"
                : !isPaymentDetailsValid && payMethod === "WALLET"
                  ? "Insufficient balance"
                  : "Pay & Send Offer"}
            </button>
          )}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
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
        style={{ ...inp, paddingLeft: icon ? 32 : 12 }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = "#f97316")}
        onBlurCapture={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
          background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
          maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
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
function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
