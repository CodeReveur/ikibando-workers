"use client";

import { useState, useEffect } from "react";
import {
  X, MapPin, Calendar, Clock, Users, ChevronDown,
  Mail, Phone, CheckCircle, Briefcase, AlarmClock,
} from "lucide-react";
import { JOB_CATEGORIES, CURRENCY } from "@/lib/constants";

// ── data ─────────────────────────────────────────────────────────────────────
const AREAS = [
  "Kacyiru", "Nyamirambo", "Kimihurura", "Remera", "Gisozi",
  "Kicukiro", "Gikondo", "Kanombe", "Muhima", "Nyarugenge",
  "Kibagabaga", "Biryogo", "Kinyinya", "Rwezamenyo", "Kimironko",
];
const DURATIONS = [1, 2, 3, 4, 6, 8, 10, 12];
const todayStr = () => new Date().toISOString().split("T")[0];
const fmt = (n: number) => `${CURRENCY} ${n.toLocaleString()}`;

// ── types ────────────────────────────────────────────────────────────────────
interface JobForm {
  category: string;
  headcount: string;
  date: string;
  time: string;
  durationHours: string;
  area: string;
  ratePerHour: string;
  notes: string;
}
interface ContactForm {
  email: string;
  phone: string;
}

const STEPS = ["Job details", "Review & post"];

// ── styles ───────────────────────────────────────────────────────────────────
const CSS = `
  .pj-sel { appearance: none; -webkit-appearance: none; }
  .pj-inp::placeholder, .pj-ta::placeholder { color: #444; }
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
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  // Detect session - swap this out once real auth lands
  const [hasSession] = useState<boolean>(() => {
    try { return !!localStorage.getItem("session"); } catch { return false; }
  });

  const [job, setJob] = useState<JobForm>({
    category: "", headcount: "1", date: "", time: "",
    durationHours: "4", area: "", ratePerHour: "", notes: "",
  });
  const [contact, setContact] = useState<ContactForm>({ email: "", phone: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof JobForm | keyof ContactForm, string>>>({});

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

  const setJ = (k: keyof JobForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setJob(f => ({ ...f, [k]: e.target.value }));

  const setC = (k: keyof ContactForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setContact(f => ({ ...f, [k]: e.target.value }));

  function focusOrange(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = "#f97316";
  }
  function blurGray(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = "#2a2a2a";
  }

  function validateStep0() {
    const errs: typeof errors = {};
    if (!job.category)     errs.category     = "Required";
    if (!job.date)         errs.date         = "Required";
    if (!job.time)         errs.time         = "Required";
    if (!job.area)         errs.area         = "Required";
    if (!job.ratePerHour || parseInt(job.ratePerHour) < 1) errs.ratePerHour = "Enter a valid rate";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep1() {
    if (hasSession) return true;
    const errs: typeof errors = {};
    if (!contact.email || !contact.email.includes("@")) errs.email = "Enter a valid email";
    const digits = contact.phone.replace(/\D/g, "");
    if (digits.length < 9) errs.phone = "Enter a valid phone number";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (step === 0 && validateStep0()) { setErrors({}); setStep(1); }
  }

  function handlePost() {
    if (!validateStep1()) return;
    // TODO: submit to /api/jobs
    setDone(true);
  }

  const rate = parseInt(job.ratePerHour) || 0;
  const hours = parseInt(job.durationHours) || 0;
  const heads = parseInt(job.headcount) || 1;
  const totalPay = rate * hours * heads;

  const dateLabel = job.date
    ? new Date(job.date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "-";

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
            <p style={{ margin: "0 0 6px", fontSize: 14, color: "#aaa", lineHeight: 1.6 }}>
              Your job request is now live. Verified workers in <strong style={{ color: "#f0f0f0" }}>{job.area}</strong> will start applying shortly.
            </p>
            {!hasSession && (
              <p style={{ margin: "0 0 24px", fontSize: 12, color: "#555" }}>
                We'll notify you at <strong style={{ color: "#aaa" }}>{contact.email}</strong>
              </p>
            )}
            <div style={{
              background: "#141414", border: "1px solid #1e1e1e",
              borderRadius: 12, padding: "14px 16px", marginBottom: 24, textAlign: "left",
            }}>
              {([
                ["Category",  JOB_CATEGORIES.find(c => c.value === job.category)?.label ?? job.category],
                ["Date",      dateLabel],
                ["Time",      job.time || "-"],
                ["Duration",  `${job.durationHours} hour${hours !== 1 ? "s" : ""}`],
                ["Workers",   `${heads}`],
                ["Area",      job.area],
                ["Rate",      fmt(rate) + " / hr"],
                ...(totalPay > 0 ? [["Est. total", fmt(totalPay)]] : []),
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

                <FField label="Job category *" error={errors.category}>
                  <PJSel value={job.category} onChange={setJ("category")} placeholder="Select a category">
                    {JOB_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </PJSel>
                </FField>

                <div className="pj-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label="Start date *" error={errors.date}>
                    <div style={{ position: "relative" }}>
                      <Calendar size={13} color="#444" style={iconL} />
                      <input className="pj-inp" type="date" min={todayStr()}
                        value={job.date} onChange={setJ("date")}
                        style={{ ...inp, paddingLeft: 32, colorScheme: "dark" }}
                        onFocus={focusOrange} onBlur={blurGray}
                      />
                    </div>
                  </FField>
                  <FField label="Start time *" error={errors.time}>
                    <div style={{ position: "relative" }}>
                      <Clock size={13} color="#444" style={iconL} />
                      <input className="pj-inp" type="time"
                        value={job.time} onChange={setJ("time")}
                        style={{ ...inp, paddingLeft: 32, colorScheme: "dark" }}
                        onFocus={focusOrange} onBlur={blurGray}
                      />
                    </div>
                  </FField>
                </div>

                <div className="pj-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FField label="Duration">
                    <div style={{ position: "relative" }}>
                      <AlarmClock size={13} color="#444" style={iconL} />
                      <select className="pj-sel" value={job.durationHours} onChange={setJ("durationHours")}
                        style={{ ...inp, paddingLeft: 32, paddingRight: 28, color: "#f0f0f0" }}
                        onFocus={focusOrange} onBlur={blurGray}
                      >
                        {DURATIONS.map(h => (
                          <option key={h} value={String(h)}>{h} hour{h !== 1 ? "s" : ""}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  </FField>
                  <FField label="No. of workers">
                    <div style={{ position: "relative" }}>
                      <Users size={13} color="#444" style={iconL} />
                      <input className="pj-inp" type="number" min="1" max="50"
                        value={job.headcount} onChange={setJ("headcount")}
                        style={{ ...inp, paddingLeft: 32 }}
                        onFocus={focusOrange} onBlur={blurGray}
                      />
                    </div>
                  </FField>
                </div>

                <FField label="Area / location *" error={errors.area}>
                  <div style={{ position: "relative" }}>
                    <MapPin size={13} color="#444" style={iconL} />
                    <select className="pj-sel" value={job.area} onChange={setJ("area")}
                      style={{ ...inp, paddingLeft: 32, paddingRight: 28, color: job.area ? "#f0f0f0" : "#444" }}
                      onFocus={focusOrange} onBlur={blurGray}
                    >
                      <option value="">Select area in Kigali</option>
                      {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  </div>
                </FField>

                <FField label="Rate per worker / hr (RWF) *" error={errors.ratePerHour}>
                  <input className="pj-inp" type="number" min="0" placeholder="e.g. 3000"
                    value={job.ratePerHour} onChange={setJ("ratePerHour")}
                    style={inp}
                    onFocus={focusOrange} onBlur={blurGray}
                  />
                  {rate > 0 && hours > 0 && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#555" }}>
                      Est. total: <strong style={{ color: "#f97316" }}>{fmt(totalPay)}</strong>
                      {" "}({heads} worker{heads !== 1 ? "s" : ""} × {hours}h × {fmt(rate)})
                    </p>
                  )}
                </FField>

                <FField label="Additional notes (optional)">
                  <textarea className="pj-ta pj-inp" rows={3}
                    placeholder="e.g. formal attire required, tools provided, outdoor event…"
                    value={job.notes} onChange={setJ("notes")}
                    style={{ ...inp, padding: "10px 14px", lineHeight: 1.65 }}
                    onFocus={focusOrange} onBlur={blurGray}
                  />
                </FField>

              </div>
            )}

            {/* ── STEP 1: REVIEW & POST ── */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Contact fields - only when no session */}
                {!hasSession && (
                  <div style={{
                    background: "#141414", border: "1px solid #272727",
                    borderRadius: 14, padding: "16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 999,
                        background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Briefcase size={13} color="#f97316" />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#f0f0f0" }}>Your contact info</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>So workers can reach you, and we can send updates</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <FField label="Email *" error={errors.email}>
                        <div style={{ position: "relative" }}>
                          <Mail size={13} color="#444" style={iconL} />
                          <input className="pj-inp" type="email" placeholder="you@example.com"
                            value={contact.email} onChange={setC("email")}
                            style={{ ...inp, paddingLeft: 32 }}
                            onFocus={focusOrange} onBlur={blurGray}
                          />
                        </div>
                      </FField>
                      <FField label="Phone number *" error={errors.phone}>
                        <div style={{ position: "relative" }}>
                          <Phone size={13} color="#444" style={iconL} />
                          <input className="pj-inp" type="tel" placeholder="+250 7XX XXX XXX"
                            value={contact.phone} onChange={setC("phone")}
                            style={{ ...inp, paddingLeft: 32 }}
                            onFocus={focusOrange} onBlur={blurGray}
                          />
                        </div>
                      </FField>
                    </div>
                  </div>
                )}

                {/* Job summary */}
                <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Job summary
                  </p>
                  {([
                    ["Category",  JOB_CATEGORIES.find(c => c.value === job.category)?.label ?? job.category],
                    ["Date",      dateLabel],
                    ["Time",      job.time || "-"],
                    ["Duration",  `${job.durationHours} hour${hours !== 1 ? "s" : ""}`],
                    ["Workers",   `${heads} worker${heads !== 1 ? "s" : ""}`],
                    ["Area",      job.area],
                    ["Rate",      fmt(rate) + " / hr per worker"],
                    ...(totalPay > 0 ? [["Est. total", fmt(totalPay)]] : []),
                    ...(job.notes ? [["Notes", job.notes]] : []),
                  ] as [string, string][]).map(([k, v]) => <SRow key={k} k={k} v={v} />)}
                </div>

                {/* Privacy note */}
                <p style={{ margin: 0, fontSize: 11, color: "#444", lineHeight: 1.7, textAlign: "center", padding: "0 8px" }}>
                  By posting you agree to our terms. Your contact details are only shared with workers who apply.
                </p>

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
              <button onClick={() => { setErrors({}); setStep(s => s - 1); }} style={btnBack}>
                ← Back
              </button>
            )}

            {step === 0 ? (
              <button onClick={handleNext} style={{ ...btnPrimary, flex: 1 }}>
                Continue →
              </button>
            ) : (
              <button onClick={handlePost} style={{ ...btnPrimary, flex: 1 }}>
                Post job
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

function PJSel({ value, onChange, placeholder, children }: {
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  placeholder?: string;
  children: React.ReactNode;
}) {
  const inp2: React.CSSProperties = {
    width: "100%", background: "#141414", border: "1px solid #2a2a2a",
    borderRadius: 10, padding: "10px 14px", fontSize: 13,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    paddingRight: 32, color: value ? "#f0f0f0" : "#444",
  };
  return (
    <div style={{ position: "relative" }}>
      <select className="pj-sel" value={value} onChange={onChange}
        style={inp2}
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

function SRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0", borderBottom: "1px solid #1a1a1a", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#555", flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#f0f0f0", textAlign: "right" }}>{v}</span>
    </div>
  );
}
