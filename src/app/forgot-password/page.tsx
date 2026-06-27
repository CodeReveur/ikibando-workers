"use client";

import { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import { AuthCarousel } from "@/components/auth/auth-carousel";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await forgotPassword(email);
    } catch {
      // Ignore errors so we don't leak account existence
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <>
      <style>{`
        .auth-left { display: none; }
        @media (min-width: 860px) { .auth-left { display: block; } }
        input::placeholder { color: #444; }
        .back-link:hover { color: #f97316 !important; }
      `}</style>

      <div style={{
        display: "flex", height: "100vh", overflow: "hidden",
        background: "#111", fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}>
        {/* LEFT - Carousel */}
        <div className="auth-left" style={{ flex: "0 0 48%", borderRight: "1px solid #1e1e1e" }}>
          <AuthCarousel />
        </div>

        {/* RIGHT - Form */}
        <div style={{
          flex: 1, overflowY: "auto",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "40px 24px",
        }}>
          <div style={{ width: "100%", maxWidth: 380 }}>

            <a href="/signin" className="back-link" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600, color: "#555",
              textDecoration: "none", marginBottom: 32,
              transition: "color 0.15s",
            }}>
              <ArrowLeft size={14} /> Back to sign in
            </a>

            {!submitted ? (
              <>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                }}>
                  <Mail size={22} color="#f97316" />
                </div>

                <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
                  Forgot your password?
                </h1>
                <p style={{ fontSize: 13, color: "#555", margin: "0 0 28px", lineHeight: 1.6 }}>
                  Enter the email linked to your MpahMapu account and we'll send you a reset link.
                </p>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#aaa", display: "block", marginBottom: 6 }}>
                    Email
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span style={{ position: "absolute", left: 13, pointerEvents: "none", display: "flex" }}>
                      <Mail size={14} color="#444" />
                    </span>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      style={{
                        width: "100%", background: "#141414", border: "1px solid #2a2a2a",
                        borderRadius: 10, padding: "11px 16px 11px 36px",
                        fontSize: 13, color: "#f0f0f0", outline: "none", boxSizing: "border-box",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    width: "100%", background: "#f97316", color: "#fff", border: "none",
                    borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
                    opacity: loading ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#ea6a0a"; }}
                  onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#f97316"; }}
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </>
            ) : (
              <>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
                  Check your inbox
                </h1>
                <p style={{ fontSize: 13, color: "#555", margin: "0 0 28px", lineHeight: 1.6 }}>
                  We sent a reset link to <span style={{ color: "#d0d0d0", fontWeight: 600 }}>{email}</span>. It expires in 15 minutes.
                </p>

                <div style={{
                  background: "#141414", border: "1px solid #2a2a2a",
                  borderRadius: 10, padding: "14px 16px",
                  fontSize: 12, color: "#555", lineHeight: 1.6,
                }}>
                  Didn't get it? Check your spam folder, or{" "}
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    style={{ background: "none", border: "none", padding: 0, color: "#f97316", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  >
                    try a different email
                  </button>.
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}