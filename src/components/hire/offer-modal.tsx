"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { X, Calendar, Clock, CheckCircle, Bell, MapPin, Navigation, Loader2 } from "lucide-react";
import { RWANDA_PROVINCES } from "@/lib/constants";
import type { WorkerProfileDto } from "@/lib/api";

import { useLanguage } from "@/lib/language-context";

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

  // Restore draft on open
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
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

  const canSend = !!(title && date && time && duration && district && bidOk);

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
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {t("offer.header.title")}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 900, color: "#fff" }}>
                {t("offer.header.subtitle", { name: worker.name.split(" ")[0] })}
              </p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}><X size={18} /></button>
          </div>

        </div>

        {/* scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 4px" }}>
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
        </div>

        {/* footer */}
        <div style={{ padding: "12px 20px 20px", flexShrink: 0, borderTop: "1px solid #1e1e1e" }}>
          <button disabled={!canSend} onClick={() => { try { localStorage.removeItem(DRAFT_KEY); } catch {} setDone(true); }} style={{
            width: "100%", background: canSend ? "#f97316" : "#141414",
            border: canSend ? "none" : "1px solid #272727",
            borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700,
            color: canSend ? "#fff" : "#444",
            cursor: canSend ? "pointer" : "not-allowed", fontFamily: "inherit",
            transition: "background 0.15s",
          }}>
            {t("offer.buttons.send") || "Send offer"}
          </button>
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
