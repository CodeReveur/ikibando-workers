"use client";

import { useState } from "react";
import { X, MapPin, Calendar, Clock, AlertTriangle, CheckCircle, Bell } from "lucide-react";
import type { WorkerData } from "@/lib/data";

interface Props { worker: WorkerData; onClose: () => void; }

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 999, padding: 16, fontFamily: "Inter, DM Sans, system-ui, sans-serif",
};
const card: React.CSSProperties = {
  background: "#161616", border: "1px solid #222", borderRadius: 20,
  width: "100%", maxWidth: 400, padding: "24px",
};
const inp: React.CSSProperties = {
  width: "100%", background: "#111", border: "1px solid #2a2a2a",
  borderRadius: 10, padding: "10px 12px", fontSize: 13,
  color: "#f0f0f0", outline: "none", fontFamily: "inherit",
};
const inpIcon: React.CSSProperties = { ...inp, paddingLeft: 34 };
const iconL: React.CSSProperties = { position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" };

const DURATIONS = ["1 hour", "Half day", "Full day", "2 days", "3 days", "1 week", "2 weeks", "Custom"];

export function OfferModal({ worker, onClose }: Props) {
  const [title, setTitle]       = useState("");
  const [date, setDate]         = useState("");
  const [hours, setHours]       = useState("");
  const [duration, setDuration] = useState("");
  const [location, setLoc]      = useState("");
  const [bid, setBid]           = useState("");
  const [done, setDone]         = useState(false);

  const minBid = Math.round(worker.ratePerDay * 0.7);
  const bidNum = parseFloat(bid) || 0;
  const bidOk  = bidNum >= minBid;

  const bidColor = bidNum === 0 ? "#444" : bidNum < minBid ? "#ef4444" : bidNum < worker.ratePerDay ? "#f59e0b" : "#22c55e";
  const bidMsg   = bidNum === 0 ? "" : bidNum < minBid ? `Minimum is ${fmt(minBid)}` : bidNum < worker.ratePerDay ? "Below ask - may negotiate" : "At or above ask ✓";

  const canSend = !!(title && date && hours && duration && location && bidOk);

  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = "#f97316");
  const blur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>, err?: boolean) => (e.currentTarget.style.borderColor = err ? "#ef4444" : "#2a2a2a");

  if (done) return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...card, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 56, height: 56, borderRadius: 999, margin: "0 auto 16px", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={28} color="#22c55e" />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: "#fff" }}>Offer sent!</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#555", lineHeight: 1.65 }}>
          {worker.name} will be notified with your details and a link to accept or negotiate.
        </p>
        <div style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 12, padding: "14px", textAlign: "left", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Bell size={12} color="#f97316" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em" }}>Worker notification</span>
          </div>
          {[
            ["Job",      title],
            ["Date",     new Date(date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " · " + hours],
            ["Duration", duration],
            ["Location", location],
            ["Offer",    fmt(bidNum) + " / day"],
          ].map(([k, v]) => (
            <p key={k} style={{ margin: "0 0 4px", fontSize: 12, color: k === "Offer" ? "#f97316" : "#aaa" }}>
              <strong style={{ color: "#555", fontWeight: 600 }}>{k}:</strong> {v}
            </p>
          ))}
        </div>
        <button onClick={onClose} style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 700, color: "#aaa", cursor: "pointer", fontFamily: "inherit" }}>
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>Make an offer</p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 900, color: "#fff" }}>Hire {worker.name.split(" ")[0]}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}><X size={18} /></button>
        </div>

        {/* ask price strip */}
        <div style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#555" }}>Ask price</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#f97316" }}>{fmt(worker.ratePerDay)} / day</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* job title */}
          <input placeholder="Job title" value={title} onChange={e => setTitle(e.target.value)} style={inp}
            onFocus={focus} onBlur={blur} />

          {/* date + hours */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <Calendar size={13} color="#444" style={iconL} />
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inpIcon}
                onFocus={focus} onBlur={blur} />
            </div>
            <div style={{ position: "relative" }}>
              <Clock size={13} color="#444" style={iconL} />
              <input type="time" value={hours} onChange={e => setHours(e.target.value)} style={inpIcon}
                onFocus={focus} onBlur={blur} />
            </div>
          </div>

          {/* duration */}
          <div style={{ position: "relative" }}>
            <select value={duration} onChange={e => setDuration(e.target.value)}
              style={{ ...inp, appearance: "none", WebkitAppearance: "none", cursor: "pointer", color: duration ? "#f0f0f0" : "#555" }}
              onFocus={focus} onBlur={blur}>
              <option value="" disabled>Duration</option>
              {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <svg style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>

          {/* location */}
          <div style={{ position: "relative" }}>
            <MapPin size={13} color="#444" style={iconL} />
            <input placeholder="Location" value={location} onChange={e => setLoc(e.target.value)} style={inpIcon}
              onFocus={focus} onBlur={blur} />
          </div>

          {/* offer price */}
          <div>
            <input type="number" min={minBid} placeholder={`Offer price (min. ${fmt(minBid)})`}
              value={bid} onChange={e => setBid(e.target.value)}
              style={{ ...inp, borderColor: bidNum > 0 && !bidOk ? "#ef4444" : "#2a2a2a", fontWeight: bidNum > 0 ? 700 : 400 }}
              onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
              onBlur={e => (e.currentTarget.style.borderColor = bidNum > 0 && !bidOk ? "#ef4444" : "#2a2a2a")}
            />
            {bidMsg && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                {!bidOk ? <AlertTriangle size={11} color={bidColor} /> : <CheckCircle size={11} color={bidColor} />}
                <span style={{ fontSize: 11, fontWeight: 600, color: bidColor }}>{bidMsg}</span>
              </div>
            )}
          </div>

          <button disabled={!canSend} onClick={() => setDone(true)} style={{
            marginTop: 4, background: canSend ? "#f97316" : "#1c1c1c",
            border: canSend ? "none" : "1px solid #272727",
            borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700,
            color: canSend ? "#fff" : "#444",
            cursor: canSend ? "pointer" : "not-allowed", fontFamily: "inherit",
            transition: "background 0.15s",
          }}>
            Send offer
          </button>

        </div>
      </div>
    </div>
  );
}
