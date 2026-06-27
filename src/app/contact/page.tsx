"use client";

import { useState } from "react";
import Footer from "@/components/layout/footer";
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, Loader2 } from "lucide-react";
import { submitContact } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

const info = [
  {
    Icon: Mail,
    label: "Email us",
    value: "MpahMapuh@gmail.com",
    href: "mailto:MpahMapuh@gmail.com",
  },
  {
    Icon: Phone,
    label: "Call or WhatsApp",
    value: "+250 781 121 117",
    href: "tel:+250781121117",
  },
  {
    Icon: MapPin,
    label: "Location",
    value: "Kigali, Rwanda",
    href: "#",
  },
  {
    Icon: Clock,
    label: "Response time",
    value: "Within 24 hours",
    href: null,
  },
];

export default function ContactPage() {
  const { error: toastError, success: toastSuccess } = useToast();
  const [form, setForm]       = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent]       = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toastError("Please fill in all required fields.", { title: "Incomplete Form" });
      return;
    }
    setSubmitting(true);
    try {
      await submitContact(form);
      toastSuccess("Your message has been sent. We'll get back to you within 24 hours.", { title: "Message Sent" });
      setSent(true);
    } catch {
      toastError("Failed to send message. Please try again or email us directly.", { title: "Send Failed" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{
      background: "#111", minHeight: "100vh", color: "#f5f5f5",
      fontFamily: "Inter, DM Sans, system-ui, sans-serif",
    }}>
      <style>{`input::placeholder, textarea::placeholder { color: #444; } textarea { resize: vertical; }`}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 64px" }}>

        {/* HEADER */}
        <div style={{ marginBottom: 44 }}>
          <span style={{
            display: "inline-block", background: "rgba(249,115,22,0.1)", color: "#f97316",
            borderRadius: 999, padding: "4px 14px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18,
          }}>
            Get in touch
          </span>
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, color: "#fff",
            lineHeight: 1.1, letterSpacing: "-1px", margin: "0 0 14px",
          }}>
            We&apos;d love to<br />
            <span style={{ color: "#f97316" }}>hear from you.</span>
          </h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.75, maxWidth: 420, margin: 0 }}>
            Whether you have a question, a partnership idea, or just want to say hi - we&apos;re here.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 24,
        }}>
          <style>{`@media (min-width: 640px) { .contact-grid { grid-template-columns: 1fr 1fr !important; } }`}</style>

          {/* FORM */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{
              display: "grid", gap: 24,
              gridTemplateColumns: "1fr",
            }}>
              <style>{`@media (min-width: 640px) { .contact-layout { grid-template-columns: 1fr 360px !important; } }`}</style>
              <div className="contact-layout" style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr" }}>

                {/* Form card */}
                <div style={{
                  background: "#1c1c1c", border: "1px solid #272727",
                  borderRadius: 18, padding: "28px 24px",
                }}>
                  {sent ? (
                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 999, margin: "0 auto 18px",
                        background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <MessageSquare size={24} color="#f97316" />
                      </div>
                      <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#fff" }}>Message sent!</h2>
                      <p style={{ margin: "0 0 22px", fontSize: 13, color: "#555" }}>
                        We&apos;ll get back to you within 24 hours.
                      </p>
                      <button onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                        style={{
                          background: "none", border: "1px solid #2a2a2a", borderRadius: 999,
                          padding: "9px 20px", fontSize: 13, color: "#aaa", cursor: "pointer", fontWeight: 600,
                        }}>
                        Send another
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#fff" }}>Send a message</h2>

                      {/* Name + Email */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <style>{`@media (max-width: 480px) { .name-email { grid-template-columns: 1fr !important; } }`}</style>
                        <div className="name-email" style={{ display: "contents" }}>
                          <Field label="Your name">
                            <input required type="text" placeholder="Jean Pierre" value={form.name}
                              onChange={set("name")} style={inputStyle}
                              onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                              onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                            />
                          </Field>
                          <Field label="Email">
                            <input required type="email" placeholder="you@example.com" value={form.email}
                              onChange={set("email")} style={inputStyle}
                              onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                              onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                            />
                          </Field>
                        </div>
                      </div>

                      {/* Subject */}
                      <Field label="Subject">
                        <div style={{ position: "relative" }}>
                          <select required value={form.subject} onChange={set("subject")}
                            style={{ ...inputStyle, color: form.subject ? "#f0f0f0" : "#444", appearance: "none" }}
                            onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                            onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                          >
                            <option value="">Select a topic…</option>
                            <option>General question</option>
                            <option>Partnership</option>
                            <option>Worker support</option>
                            <option>Employer support</option>
                            <option>Report an issue</option>
                            <option>Other</option>
                          </select>
                          <svg style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </Field>

                      {/* Message */}
                      <Field label="Message">
                        <textarea required placeholder="Tell us what's on your mind…" value={form.message}
                          onChange={set("message")} rows={5}
                          style={{ ...inputStyle, padding: "11px 14px", lineHeight: 1.7 }}
                          onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                          onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                        />
                      </Field>

                      <button type="submit" disabled={submitting} style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        background: submitting ? "#c2601a" : "#f97316", color: "#fff", border: "none",
                        borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700,
                        cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.8 : 1,
                      }}
                        onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = "#ea6a0a"; }}
                        onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = "#f97316"; }}
                      >
                        {submitting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                        {submitting ? "Sending…" : "Send message"}
                      </button>
                      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </form>
                  )}
                </div>

                {/* Contact info */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {info.map(({ Icon, label, value, href }) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      background: "#1c1c1c", border: "1px solid #272727",
                      borderRadius: 14, padding: "16px 18px",
                    }}>
                      <div style={{
                        flexShrink: 0, width: 38, height: 38, borderRadius: 10,
                        background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={17} color="#f97316" strokeWidth={1.75} />
                      </div>
                      <div>
                        <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                        {href && href !== "#" ? (
                          <a href={href} style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", textDecoration: "none" }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#f0f0f0")}
                          >{value}</a>
                        ) : (
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f0f0f0" }}>{value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
      <Footer />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#aaa" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#141414", border: "1px solid #2a2a2a",
  borderRadius: 10, padding: "11px 14px", fontSize: 13, color: "#f0f0f0",
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
