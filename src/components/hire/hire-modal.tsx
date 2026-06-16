"use client";

import { useState, useEffect } from "react";
import {
  X, Star, MapPin, Shield, ChevronDown,
  Calendar, Clock, Phone, CheckCircle, Users,
} from "lucide-react";

// ── data ───────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "Waiters","Cleaners","Security","Drivers","Electricians",
  "Plumbers","Gardeners","Photographers","Movers","Domestic Help","Construction",
];
const LOCATIONS = [
  "Kacyiru","Nyamirambo","Kimihurura","Remera",
  "Gisozi","Kicukiro","Gikondo","Kanombe",
];
const WORKERS = [
  { id:1,  name:"Jean Pierre M.", category:"Waiters",       location:"Kacyiru",    rating:4.9, jobs:42 },
  { id:2,  name:"Diane U.",       category:"Cleaners",      location:"Remera",     rating:4.8, jobs:67 },
  { id:3,  name:"Eric N.",        category:"Drivers",       location:"Gisozi",     rating:5.0, jobs:28 },
  { id:4,  name:"Alice K.",       category:"Security",      location:"Kimihurura", rating:4.7, jobs:51 },
  { id:5,  name:"Patrick H.",     category:"Electricians",  location:"Kicukiro",   rating:4.9, jobs:33 },
  { id:6,  name:"Grace I.",       category:"Cleaners",      location:"Nyamirambo", rating:4.8, jobs:89 },
  { id:7,  name:"Samuel B.",      category:"Plumbers",      location:"Gikondo",    rating:4.6, jobs:19 },
  { id:8,  name:"Marie C.",       category:"Domestic Help", location:"Kacyiru",    rating:4.9, jobs:55 },
  { id:9,  name:"Olivier T.",     category:"Construction",  location:"Kanombe",    rating:4.5, jobs:37 },
  { id:10, name:"Claudine M.",    category:"Photographers", location:"Kimihurura", rating:5.0, jobs:14 },
  { id:11, name:"Bosco R.",       category:"Movers",        location:"Remera",     rating:4.7, jobs:23 },
  { id:12, name:"Yvonne N.",      category:"Gardeners",     location:"Gisozi",     rating:4.8, jobs:41 },
  { id:13, name:"Claude M.",      category:"Waiters",       location:"Kimihurura", rating:4.7, jobs:31 },
  { id:14, name:"Solange K.",     category:"Cleaners",      location:"Kacyiru",    rating:4.9, jobs:52 },
  { id:15, name:"David N.",       category:"Drivers",       location:"Remera",     rating:4.8, jobs:44 },
];

type Worker = typeof WORKERS[number];
type PayMethod = "mtn" | "airtel";
interface Form {
  category: string; budget: string; experience: string;
  headcount: string;
  date: string; time: string; location: string; notes: string;
}

const STEPS = ["Job details", "Best matches", "Summary & Pay"];
const fmt = (n: number) => `RWF ${n.toLocaleString()}`;
const todayStr = () => new Date().toISOString().split("T")[0];

// ── styles ──────────────────────────────────────────────────────────────────
const CSS = `
  .hire-sel { appearance: none; -webkit-appearance: none; }
  .hire-inp::placeholder, .hire-ta::placeholder { color: #444; }
  .hire-ta { resize: vertical; }
  .wrow { transition: border-color 0.12s, background 0.12s; cursor: pointer; }
  .wrow:hover { border-color: #f97316 !important; }
  @media (max-width: 500px) { .h2col { grid-template-columns: 1fr !important; } }
`;

const inp: React.CSSProperties = {
  width: "100%", background: "#141414", border: "1px solid #2a2a2a",
  borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#f0f0f0",
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

// ── component ────────────────────────────────────────────────────────────────
export function HireModal({ onClose }: { onClose: () => void }) {
  const [step, setStep]       = useState(0);
  const [form, setForm]       = useState<Form>({
    category:"", budget:"", experience:"any", headcount:"1",
    date:"", time:"", location:"", notes:"",
  });
  const [selected, setSel]    = useState<Worker | null>(null);
  const [payMethod, setPay]   = useState<PayMethod>("mtn");
  const [momoNum, setMomo]    = useState("");
  const [done, setDone]       = useState(false);

  // body scroll lock
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

  const setF = (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  // Worker matching: filter → sort (location priority, then rating)
  const matches = WORKERS.filter(w => {
    if (form.category && w.category !== form.category) return false;
    if (form.experience === "some"        && w.jobs < 1)  return false;
    if (form.experience === "experienced" && w.jobs < 10) return false;
    if (form.experience === "expert"      && w.jobs < 50) return false;
    return true;
  }).sort((a, b) => {
    const aL = a.location === form.location ? 1 : 0;
    const bL = b.location === form.location ? 1 : 0;
    return bL - aL || b.rating - a.rating;
  });

  const budget  = parseInt(form.budget, 10) || 0;
  const fee     = Math.round(budget * 0.05);
  const total   = budget + fee;

  const canNext = [
    !!(form.category && form.budget && form.date && form.time && form.location),
    !!selected,
    momoNum.replace(/\D/g, "").length >= 9,
  ];

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (done) return (
    <>
      <style>{CSS}</style>
      <Overlay onClose={onClose}>
        <div onClick={e => e.stopPropagation()} style={modalCard}>
          <div style={{ padding: "48px 28px 36px", textAlign: "center" }}>
            <div style={{
              width: 80, height: 62, borderRadius: 999, margin: "0 auto 20px",
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
              Booking confirmed!
            </h2>
            <p style={{ margin: "0 0 4px", fontSize: 14, color: "#aaa" }}>
              <strong style={{ color: "#f0f0f0" }}>{selected?.name}</strong> has been notified and will confirm shortly.
            </p>
            <p style={{ margin: "0 0 28px", fontSize: 13, color: "#555", lineHeight: 1.7 }}>
              {fmt(total)} is held securely by Ikibando and released only after you mark the job complete.
              Not satisfied? Raise a dispute within 24 hours for a full refund.
            </p>
            {/* Booking summary */}
            <div style={{
              background: "#141414", border: "1px solid #1e1e1e",
              borderRadius: 12, padding: "14px 16px", marginBottom: 24, textAlign: "left",
            }}>
              {([
                ["Category",  form.category],
                ["Workers",   `${parseInt(form.headcount) || 1}`],
                ["Worker",    selected?.name ?? ""],
                ["Date",      form.date ? new Date(form.date + "T00:00").toDateString() : "-"],
                ["Time",      form.time || "-"],
                ["Location",  form.location],
                ["Paid",      fmt(total) + " (held)"],
              ] as [string, string][]).map(([k, v]) => (
                <SRow key={k} k={k} v={v} />
              ))}
            </div>
            <button onClick={onClose} style={{ ...btnPrimary, width: "100%" }}>Done</button>
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
            {/* Progress bar */}
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
                <FField label="Job category *">
                  <Sel value={form.category} onChange={setF("category")} placeholder="Select a category">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </Sel>
                </FField>

                <div className="h2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label="Your budget (RWF) *">
                    <input className="hire-inp" type="number" min="0" placeholder="e.g. 8000"
                      value={form.budget} onChange={setF("budget")} style={inp}
                      onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                      onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    />
                  </FField>
                  <FField label="No. of workers">
                    <div style={{ position: "relative" }}>
                      <Users size={13} color="#444" style={iconL} />
                      <input className="hire-inp" type="number" min="1" max="50"
                        value={form.headcount} onChange={setF("headcount")} style={{ ...inp, paddingLeft: 32 }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                    </div>
                  </FField>
                </div>

                <FField label="Experience needed">
                  <Sel value={form.experience} onChange={setF("experience")}>
                    <option value="any">Any level</option>
                    <option value="some">Some (1–10 jobs)</option>
                    <option value="experienced">Experienced (10–50)</option>
                    <option value="expert">Expert (50+ jobs)</option>
                  </Sel>
                </FField>

                <div className="h2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label="Start date *">
                    <div style={{ position: "relative" }}>
                      <Calendar size={13} color="#444" style={iconL} />
                      <input className="hire-inp" type="date" min={todayStr()}
                        value={form.date} onChange={setF("date")}
                        style={{ ...inp, paddingLeft: 32, colorScheme: "dark" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                    </div>
                  </FField>
                  <FField label="Start time *">
                    <div style={{ position: "relative" }}>
                      <Clock size={13} color="#444" style={iconL} />
                      <input className="hire-inp" type="time"
                        value={form.time} onChange={setF("time")}
                        style={{ ...inp, paddingLeft: 32, colorScheme: "dark" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                    </div>
                  </FField>
                </div>

                <FField label="Location *">
                  <Sel value={form.location} onChange={setF("location")} placeholder="Select location">
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </Sel>
                </FField>

                <FField label="Additional notes (optional)">
                  <textarea className="hire-ta hire-inp" rows={3}
                    placeholder="e.g. formal attire, bring own tools, 3-hour shift…"
                    value={form.notes} onChange={setF("notes")}
                    style={{ ...inp, padding: "10px 14px", lineHeight: 1.65 }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                </FField>
              </div>
            )}

            {/* ── STEP 1: BEST MATCHES ── */}
            {step === 1 && (
              <div>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#555" }}>
                  {matches.length} worker{matches.length !== 1 ? "s" : ""} match your request
                  {form.category ? ` for ${form.category}` : ""} · sorted by proximity then rating
                </p>

                {matches.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: 28, margin: "0 0 10px" }}>😔</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#555", margin: 0 }}>No workers match your criteria</p>
                    <p style={{ fontSize: 12, color: "#333", marginTop: 6 }}>Go back and try a different category or experience level.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {matches.map((w, i) => {
                      const nearby = w.location === form.location;
                      const isSel  = selected?.id === w.id;
                      return (
                        <div key={w.id} className="wrow" onClick={() => setSel(w)} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          background: isSel ? "rgba(249,115,22,0.05)" : "#141414",
                          border: `1px solid ${isSel ? "#f97316" : "#2a2a2a"}`,
                          borderRadius: 12, padding: "12px 14px",
                        }}>
                          {/* avatar */}
                          <div style={{
                            flexShrink: 0, width: 40, height: 40, borderRadius: 999,
                            background: "rgba(249,115,22,0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 15, fontWeight: 800, color: "#f97316",
                          }}>
                            {w.name[0]}
                          </div>
                          {/* info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#f0f0f0" }}>{w.name}</p>
                              {i === 0 && (
                                <span style={{
                                  fontSize: 9, fontWeight: 800, borderRadius: 999,
                                  padding: "2px 7px", background: "rgba(249,115,22,0.12)", color: "#f97316",
                                }}>
                                  BEST MATCH
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <Star size={10} color="#f97316" fill="#f97316" />
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#f97316" }}>{w.rating}</span>
                              </span>
                              <span style={{ fontSize: 11, color: "#333" }}>·</span>
                              <span style={{ fontSize: 11, color: "#444" }}>{w.jobs} jobs</span>
                              <span style={{ fontSize: 11, color: "#333" }}>·</span>
                              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <MapPin size={10} color={nearby ? "#22c55e" : "#444"} />
                                <span style={{ fontSize: 11, color: nearby ? "#22c55e" : "#444" }}>
                                  {w.location}{nearby ? " · Nearby" : ""}
                                </span>
                              </span>
                            </div>
                          </div>
                          {/* radio */}
                          <div style={{
                            flexShrink: 0, width: 20, height: 20, borderRadius: 999,
                            border: `2px solid ${isSel ? "#f97316" : "#2a2a2a"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "border-color 0.15s",
                          }}>
                            {isSel && <div style={{ width: 10, height: 10, borderRadius: 999, background: "#f97316" }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: SUMMARY & PAY ── */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Job summary */}
                <SCard title="Job summary">
                  {([
                    ["Category",    form.category],
                    ["Workers",     `${parseInt(form.headcount) || 1}`],
                    ["Date",        form.date ? new Date(form.date + "T00:00").toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" }) : "-"],
                    ["Time",        form.time || "-"],
                    ["Location",    form.location],
                    ...(form.notes ? [["Notes", form.notes]] : []),
                  ] as [string, string][]).map(([k, v]) => <SRow key={k} k={k} v={v} />)}
                </SCard>

                {/* Worker */}
                {selected && (
                  <SCard title="Your worker">
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 999, flexShrink: 0,
                        background: "rgba(249,115,22,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 800, color: "#f97316",
                      }}>
                        {selected.name[0]}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#f0f0f0" }}>{selected.name}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                          <Star size={10} color="#f97316" fill="#f97316" />
                          <span style={{ fontSize: 11, color: "#f97316", fontWeight: 700 }}>{selected.rating}</span>
                          <span style={{ fontSize: 11, color: "#444" }}>· {selected.jobs} jobs done</span>
                        </div>
                      </div>
                    </div>
                  </SCard>
                )}

                {/* Payment breakdown */}
                <SCard title="Payment breakdown">
                  <SRow k="Job amount"        v={fmt(budget)} />
                  <SRow k="Platform fee (5%)" v={fmt(fee)} />
                  <div style={{ borderTop: "1px solid #1e1e1e", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f0" }}>Total</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: "#f97316" }}>{fmt(total)}</span>
                  </div>
                </SCard>

                {/* Payment method */}
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Payment method
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {(["mtn", "airtel"] as PayMethod[]).map(m => (
                      <button key={m} type="button" onClick={() => setPay(m)} style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        background: payMethod === m ? "rgba(249,115,22,0.07)" : "#141414",
                        border: `1px solid ${payMethod === m ? "#f97316" : "#2a2a2a"}`,
                        borderRadius: 10, padding: "11px", cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}>
                        <span style={{ fontSize: 15 }}>{m === "mtn" ? "🟡" : "🔴"}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: payMethod === m ? "#f97316" : "#666" }}>
                          {m === "mtn" ? "MTN MoMo" : "Airtel Money"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <FField label="MoMo phone number *">
                    <div style={{ position: "relative" }}>
                      <Phone size={13} color="#444" style={iconL} />
                      <input className="hire-inp" type="tel" placeholder="+250 7XX XXX XXX"
                        value={momoNum} onChange={e => setMomo(e.target.value)}
                        style={{ ...inp, paddingLeft: 32 }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                        onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      />
                    </div>
                  </FField>
                </div>

                {/* Escrow / refund notice */}
                <div style={{
                  background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.14)",
                  borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12,
                }}>
                  <Shield size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 700, color: "#22c55e" }}>
                      Your payment is held until the work is done
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "#555", lineHeight: 1.7 }}>
                      {fmt(total)} is locked in escrow and only released to{" "}
                      <strong style={{ color: "#aaa" }}>{selected?.name}</strong> after you confirm
                      the job is complete. If the work is not done as agreed, raise a dispute within{" "}
                      <strong style={{ color: "#aaa" }}>24 hours</strong> for a{" "}
                      <strong style={{ color: "#aaa" }}>full refund</strong> - no questions asked.
                    </p>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* FOOTER NAV */}
          <div style={{
            padding: "16px 24px 20px", flexShrink: 0,
            borderTop: "1px solid #1e1e1e",
            display: "flex", gap: 10,
          }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={btnBack}>
                ← Back
              </button>
            )}

            {step < 2 ? (
              <button
                onClick={() => { if (canNext[step]) setStep(s => s + 1); }}
                disabled={!canNext[step]}
                style={{ ...btnPrimary, flex: 1, opacity: canNext[step] ? 1 : 0.45, cursor: canNext[step] ? "pointer" : "not-allowed" }}
              >
                {step === 1 && !selected ? "Select a worker to continue" : "Continue →"}
              </button>
            ) : (
              <button
                onClick={() => { if (canNext[2]) setDone(true); }}
                disabled={!canNext[2]}
                style={{ ...btnPrimary, flex: 1, opacity: canNext[2] ? 1 : 0.45, cursor: canNext[2] ? "pointer" : "not-allowed" }}
              >
                {canNext[2] ? `Confirm & Pay ${fmt(total)}` : "Enter MoMo number to pay"}
              </button>
            )}
          </div>

        </div>
      </Overlay>
    </>
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

function Sel({ value, onChange, placeholder, children }: {
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select className="hire-sel" value={value} onChange={onChange}
        style={{ ...inp, color: value ? "#f0f0f0" : "#444", paddingRight: 32 }}
        onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
        onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
    </div>
  );
}

function SCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {title}
      </p>
      {children}
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

// ── button styles ─────────────────────────────────────────────────────────────
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
