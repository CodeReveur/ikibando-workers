"use client";

import { useState, useEffect } from "react";
import { X, Mail, Phone, User, CheckCircle } from "lucide-react";
import type { JobData } from "@/lib/data";

interface Props { job: JobData; onClose: () => void; }

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
const row: React.CSSProperties = { position: "relative" };
const inp: React.CSSProperties = {
  width: "100%", background: "#111", border: "1px solid #2a2a2a",
  borderRadius: 10, padding: "10px 12px 10px 34px", fontSize: 13,
  color: "#f0f0f0", outline: "none", fontFamily: "inherit",
};
const iconL: React.CSSProperties = { position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" };

export function ApplyModal({ job, onClose }: Props) {
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [done, setDone]   = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ikibando_session");
      if (raw) {
        const s = JSON.parse(raw);
        setName(s.name ?? ""); setEmail(s.email ?? ""); setPhone(s.phone ?? "");
        setHasSession(true);
      }
    } catch { /* ignore */ }
  }, []);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneOk = phone.replace(/\D/g, "").length >= 9;
  const canSend = !!(name && emailOk && phoneOk);

  if (done) return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...card, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 56, height: 56, borderRadius: 999, margin: "0 auto 16px", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={28} color="#22c55e" />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: "#fff" }}>Application sent!</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#555", lineHeight: 1.65 }}>
          {job.employerName} will contact you at <strong style={{ color: "#f0f0f0" }}>{email}</strong> or <strong style={{ color: "#f0f0f0" }}>{phone}</strong>.
        </p>
        <button onClick={onClose} style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 700, color: "#aaa", cursor: "pointer", fontFamily: "inherit" }}>
          Close
        </button>
      </div>
    </div>
  );

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>

        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>Apply for job</p>
            <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.title}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#555" }}>{fmt(job.amount)} / {job.period} · {job.location}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", flexShrink: 0 }}><X size={18} /></button>
        </div>

        {/* session indicator */}
        {hasSession && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14,
            background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)",
            borderRadius: 8, padding: "6px 10px",
          }}>
            <CheckCircle size={12} color="#22c55e" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#22c55e" }}>Pre-filled from your session</span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          <div style={row}>
            <User size={13} color="#444" style={iconL} />
            <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} style={inp}
              onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
              onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
            />
          </div>

          <div style={row}>
            <Mail size={13} color="#444" style={iconL} />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              style={{ ...inp, borderColor: email && !emailOk ? "#ef4444" : "#2a2a2a" }}
              onFocus={e => (e.currentTarget.style.borderColor = email && !emailOk ? "#ef4444" : "#f97316")}
              onBlur={e => (e.currentTarget.style.borderColor = email && !emailOk ? "#ef4444" : "#2a2a2a")}
            />
          </div>

          <div style={row}>
            <Phone size={13} color="#444" style={iconL} />
            <input type="tel" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)}
              style={{ ...inp, borderColor: phone && !phoneOk ? "#ef4444" : "#2a2a2a" }}
              onFocus={e => (e.currentTarget.style.borderColor = phone && !phoneOk ? "#ef4444" : "#f97316")}
              onBlur={e => (e.currentTarget.style.borderColor = phone && !phoneOk ? "#ef4444" : "#2a2a2a")}
            />
          </div>

          <button disabled={!canSend} onClick={() => setDone(true)} style={{
            marginTop: 4, background: canSend ? "#f97316" : "#1c1c1c",
            border: canSend ? "none" : "1px solid #272727",
            borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700,
            color: canSend ? "#fff" : "#444",
            cursor: canSend ? "pointer" : "not-allowed", fontFamily: "inherit",
          }}>
            Submit application
          </button>

        </div>
      </div>
    </div>
  );
}
