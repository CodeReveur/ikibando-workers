"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  X, Calendar, Clock, Users, ChevronDown,
  CheckCircle, AlarmClock, Loader2, Navigation, Search, MapPin,
} from "lucide-react";
import { JOB_CATEGORIES, RWANDA_PROVINCES, CURRENCY } from "@/lib/constants";
import { postJob, getWallet, apiError } from "@/lib/api";
import { saveRedirect } from "@/lib/auth-redirect";
import { useToast } from "@/components/ui/toast";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

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

// ── types ────────────────────────────────────────────────────────────────────
interface JobForm {
  category: string;
  headcount: string;
  date: string;
  time: string;
  durationHours: string;
  province: string;
  district: string;
  latitude:  number | null;
  longitude: number | null;
  ratePerHour: string;
  rateType: RateType;
  notes: string;
}

const STEPS = ["Job details", "Review & post"];

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
export function PostJobModal({ onClose }: { onClose: () => void }) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [step, setStep]           = useState(0);
  const [done, setDone]           = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [walletBal, setWalletBal] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [job, setJob] = useState<JobForm>({
    category: "", headcount: "1", date: "", time: "",
    durationHours: "4", province: "", district: "",
    latitude: null, longitude: null,
    ratePerHour: "", rateType: "hr", notes: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof JobForm, string>>>({});

  const DRAFT_KEY = "MpahMapu_draft_postjob";

  // Restore draft on open
  useEffect(() => {
    try {
      const t = localStorage.getItem("access_token");
      setToken(t);
      if (t) getWallet(t).then(w => setWalletBal(w.balance)).catch(() => {});
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const { job: saved, step: savedStep } = JSON.parse(raw);
      if (saved) setJob(j => ({ ...j, ...saved }));
      if (typeof savedStep === "number") setStep(savedStep);
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
    if (!job.category)     errs.category  = "Required";
    if (!job.date)         errs.date      = "Required";
    if (!job.time)         errs.time      = "Required";
    if (!job.district)     errs.district  = "Required";
    if (!job.ratePerHour || parseInt(job.ratePerHour) < 1) errs.ratePerHour = "Enter a valid rate";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (step === 0 && validateStep0()) { setErrors({}); setStep(1); }
    else if (step === 0) toastError("Please fill in all required fields.", { title: "Incomplete Form" });
  }

  async function handlePost() {
    if (!token) { toastError("You must be signed in to post a job.", { title: "Not Signed In" }); return; }
    setSubmitting(true);
    try {
      const startTime = job.date && job.time
        ? `${job.date}T${job.time}:00Z`
        : new Date().toISOString();
      await postJob({
        category:     job.category,
        province:     job.province || undefined,
        district:     job.district,
        latitude:     job.latitude  ?? undefined,
        longitude:    job.longitude ?? undefined,
        ratePerHour:  parseInt(job.ratePerHour),
        headcount:    parseInt(job.headcount) || 1,
        urgency:      "SAME_DAY",
        startTime,
        durationHours: parseInt(job.durationHours) || 1,
        rateType:     job.rateType === "hr" ? "PER_HOUR" : job.rateType === "day" ? "PER_DAY" : job.rateType === "week" ? "PER_WEEK" : job.rateType === "month" ? "PER_MONTH" : "PER_YEAR",
        locationNotes: job.notes || undefined,
      }, token);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setDone(true);
    } catch (e: any) {
      toastError(apiError(e, "Failed to post job. Please try again."), { title: "Post Failed" });
    } finally {
      setSubmitting(false);
    }
  }

  const rate        = parseInt(job.ratePerHour) || 0;
  const hours       = parseInt(job.durationHours) || 0;
  const heads       = parseInt(job.headcount) || 1;
  const escrow      = rate * hours * heads;      // employer pays gross; platform fee deducted from worker side
  const platformFee = Math.round(escrow * 0.25);
  const workerPay   = escrow - platformFee;      // net workers receive (75%)
  const catLabel = JOB_CATEGORIES.find(c => c.value === job.category)?.label ?? job.category;
  const dateLabel = job.date
    ? new Date(job.date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "-";
  const locationLabel = [job.province, job.district].filter(Boolean).join(" › ");

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
              Job posted!
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#aaa", lineHeight: 1.6 }}>
              Your job is live. Verified workers in <strong style={{ color: "#f0f0f0" }}>{locationLabel || job.district}</strong> will start applying shortly.
            </p>
            <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px", marginBottom: 24, textAlign: "left" }}>
              {([
                ["Category",  catLabel],
                ["Date",      dateLabel],
                ["Time",      job.time || "-"],
                ["Duration",  `${job.durationHours} ${getUnit(job.rateType, hours)}`],
                ["Workers",   `${heads}`],
                ["Location",  locationLabel || job.district],
                ["Rate",      fmt(rate) + " " + RATE_LABEL[job.rateType]],
                ...(escrow > 0 ? [["Escrowed", fmt(escrow)]] : []),
              ] as [string, string][]).map(([k, v]) => <SRow key={k} k={k} v={v} />)}
            </div>
            <button onClick={onClose} style={{ ...btnPrimary, width: "100%" }}>Done</button>
          </div>
        </div>
      </Overlay>
    </>
  );

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
                  Step {step + 1} of {STEPS.length}
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

          {/* SCROLLABLE CONTENT */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 24px 4px" }}>

            {/* ── STEP 0: JOB DETAILS ── */}
            {step === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Category — searchable */}
                <FField label="Job category *" error={errors.category}>
                  <SearchSelect
                    options={JOB_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
                    value={job.category}
                    onChange={v => setJob(f => ({ ...f, category: v }))}
                    placeholder="Search category…"
                    icon={<Search size={13} color="#444" style={iconL} />}
                  />
                </FField>

                {/* Date + Time */}
                <div className="pj-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label="Start date *" error={errors.date}>
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
                  <FField label="Start time *" error={errors.time}>
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
                  <FField label="Rate period">
                    <div style={{ position: "relative" }}>
                      <select value={job.rateType} onChange={e => setJob(f => ({ ...f, rateType: e.target.value as RateType }))}
                        style={{ ...inp, appearance: "none", paddingRight: 28, color: "#f0f0f0" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      >
                        <option value="hr">Per hour</option>
                        <option value="day">Per day</option>
                        <option value="week">Per week</option>
                        <option value="month">Per month</option>
                        <option value="year">Per year</option>
                      </select>
                      <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  </FField>
                  <FField label="Duration">
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
                  <FField label="No. of workers">
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
                  <FField label="Province">
                    <SearchSelect
                      options={RWANDA_PROVINCES.map(p => ({ value: p.label, label: p.label }))}
                      value={job.province}
                      onChange={v => setJob(f => ({ ...f, province: v, district: "" }))}
                      placeholder="Province…"
                      icon={<MapPin size={13} color="#444" style={iconL} />}
                    />
                  </FField>
                  <FField label="District *" error={errors.district}>
                    <SearchSelect
                      options={districtsFor(job.province).map(d => ({ value: d, label: d }))}
                      value={job.district}
                      onChange={v => setJob(f => ({ ...f, district: v }))}
                      placeholder="District…"
                      icon={<MapPin size={13} color="#444" style={iconL} />}
                    />
                  </FField>
                </div>

                {/* Map + GPS */}
                <FField label="Precise location (click map or use GPS)">
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
                        {gpsStatus === "loading" ? "Detecting…" : gpsStatus === "ok" ? "GPS detected" : "Detect my GPS"}
                      </button>

                      {gpsStatus === "error" && (
                        <span style={{ fontSize: 11, color: "#ef4444" }}>Could not access GPS</span>
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
                <FField label={`Rate per worker ${RATE_LABEL[job.rateType]} (RWF) *`} error={errors.ratePerHour}>
                  <input type="number" min="0" placeholder="e.g. 3000"
                    value={job.ratePerHour} onChange={e => setJob(f => ({ ...f, ratePerHour: e.target.value }))}
                    style={inp}
                    onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                    onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                  {rate > 0 && hours > 0 && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#555" }}>
                      Escrow: <strong style={{ color: "#f97316" }}>{fmt(escrow)}</strong>
                      {" "}({heads} × {hours}h × {fmt(rate)})
                    </p>
                  )}
                </FField>

                {/* Notes */}
                <FField label="Additional notes (optional)">
                  <RichTextEditor
                    placeholder="e.g. formal attire required, tools provided, outdoor event…"
                    value={job.notes}
                    onChange={v => setJob(f => ({ ...f, notes: v }))}
                  />
                </FField>

              </div>
            )}

            {/* ── STEP 1: REVIEW & POST ── */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {!token && (
                  <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>
                      You must be{" "}
                      <a href="/signin" style={{ color: "#f97316", fontWeight: 700 }} onClick={() => saveRedirect()}>signed in</a>
                      {" "}as an employer to post a job.
                    </p>
                  </div>
                )}

                <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Job summary
                  </p>
                  {([
                    ["Category",  catLabel],
                    ["Date",      dateLabel],
                    ["Time",      job.time || "-"],
                    ["Duration",  `${job.durationHours} ${getUnit(job.rateType, hours)}`],
                    ["Workers",   `${heads} worker${heads !== 1 ? "s" : ""}`],
                    ["Province",  job.province || "-"],
                    ["District",  job.district],
                    ...(job.latitude != null ? [["GPS", `${job.latitude.toFixed(5)}, ${job.longitude!.toFixed(5)}`]] : []),
                    ["Rate",      fmt(rate) + " " + RATE_LABEL[job.rateType] + " per worker"],
                    ...(escrow > 0 ? [["Escrowed", fmt(escrow)]] : []),
                    ...(job.notes ? [["Notes", job.notes]] : []),
                  ] as [string, string][]).map(([k, v]) => <SRow key={k} k={k} v={v} />)}
                </div>

                {/* ESCROW / WALLET BLOCK */}
                <div style={{ marginTop: 8 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#fff" }}>Payment</p>

                  {/* escrow breakdown */}
                  {escrow > 0 && (
                    <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Gross ({heads} × {hours}h × {fmt(rate)})</span>
                        <span style={{ fontSize: 12, color: "#d0d0d0", fontWeight: 600 }}>{fmt(escrow)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Platform fee (25% from worker)</span>
                        <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>−{fmt(platformFee)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #1e1e1e" }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Workers receive</span>
                        <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{fmt(workerPay)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: "#aaa", fontWeight: 700 }}>Your escrow charge</span>
                        <span style={{ fontSize: 14, color: "#f97316", fontWeight: 800 }}>{fmt(escrow)}</span>
                      </div>
                    </div>
                  )}

                  {/* wallet balance */}
                  <div style={{
                    background: walletBal !== null && walletBal < escrow ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.04)",
                    border: `1px solid ${walletBal !== null && walletBal < escrow ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.15)"}`,
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: walletBal !== null && walletBal < escrow ? 8 : 0 }}>
                      {/* wallet icon */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={walletBal !== null && walletBal < escrow ? "#ef4444" : "#22c55e"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      <span style={{ fontSize: 12, color: "#aaa" }}>Wallet balance</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginLeft: "auto" }}>
                        {walletBal !== null ? fmt(walletBal) : "—"}
                      </span>
                    </div>
                    {walletBal !== null && walletBal < escrow && (
                      <p style={{ margin: 0, fontSize: 12, color: "#ef4444", lineHeight: 1.5 }}>
                        You need <strong>{fmt(escrow - walletBal)}</strong> more.{" "}
                        <a href="/owner/payments" style={{ color: "#f97316", fontWeight: 700, textDecoration: "underline" }}>Top up wallet →</a>
                      </p>
                    )}
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: 11, color: "#444", lineHeight: 1.7, textAlign: "center", padding: "0 8px" }}>
                  By posting you agree to our terms. Your contact details are only shared with workers who apply.
                </p>
              </div>
            )}

          </div>

          {/* FOOTER NAV */}
          <div style={{ padding: "16px 24px 20px", flexShrink: 0, borderTop: "1px solid #1e1e1e" }}>
            <div style={{ display: "flex", gap: 10 }}>
              {step > 0 && (
                <button onClick={() => { setErrors({}); setStep(s => s - 1); }} style={btnBack}>
                  ← Back
                </button>
              )}
              {step === 0 ? (
                <button onClick={handleNext} style={{ ...btnPrimary, flex: 1 }}>
                  Continue →
                </button>
              ) : (
                <button
                  disabled={submitting || (walletBal !== null && walletBal < escrow)}
                  onClick={handlePost}
                  style={{ ...btnPrimary, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    opacity: (submitting || (walletBal !== null && walletBal < escrow)) ? 0.45 : 1,
                    cursor: (submitting || (walletBal !== null && walletBal < escrow)) ? "not-allowed" : "pointer" }}
                >
                  {submitting && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                  {submitting ? "Posting…" : walletBal !== null && walletBal < escrow ? `Insufficient balance` : "Post & freeze funds"}
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
