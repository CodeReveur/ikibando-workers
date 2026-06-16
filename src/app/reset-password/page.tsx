"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { AuthCarousel } from "@/components/auth/auth-carousel";

function StrengthBar({ password }: { password: string }) {
  const score = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#2a2a2a", "#ef4444", "#f97316", "#eab308", "#22c55e"];

  if (!password) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: i <= score ? colors[score] : "#2a2a2a",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: colors[score], fontWeight: 600 }}>
        {labels[score]}
      </span>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setDone(true);
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
            }}>
              <ArrowLeft size={14} /> Back to sign in
            </a>

            {!done ? (
              <>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                }}>
                  <Lock size={22} color="#f97316" />
                </div>

                <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
                  Set a new password
                </h1>
                <p style={{ fontSize: 13, color: "#555", margin: "0 0 28px", lineHeight: 1.6 }}>
                  Choose something strong. You won't be able to reuse your last password.
                </p>

                {/* New password */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#aaa", display: "block", marginBottom: 6 }}>
                    New password
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span style={{ position: "absolute", left: 13, pointerEvents: "none", display: "flex" }}>
                      <Lock size={14} color="#444" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{
                        width: "100%", background: "#141414", border: "1px solid #2a2a2a",
                        borderRadius: 10, padding: "11px 36px 11px 36px",
                        fontSize: 13, color: "#f0f0f0", outline: "none", boxSizing: "border-box",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: "absolute", right: 13, background: "none", border: "none", cursor: "pointer", padding: 0, color: "#444", display: "flex" }}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <StrengthBar password={password} />
                </div>

                {/* Confirm password */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#aaa", display: "block", marginBottom: 6 }}>
                    Confirm password
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span style={{ position: "absolute", left: 13, pointerEvents: "none", display: "flex" }}>
                      <Lock size={14} color="#444" />
                    </span>
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      style={{
                        width: "100%", background: "#141414",
                        border: `1px solid ${error && error.includes("match") ? "#ef4444" : "#2a2a2a"}`,
                        borderRadius: 10, padding: "11px 36px 11px 36px",
                        fontSize: 13, color: "#f0f0f0", outline: "none", boxSizing: "border-box",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = error && error.includes("match") ? "#ef4444" : "#f97316")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = error && error.includes("match") ? "#ef4444" : "#2a2a2a")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      style={{ position: "absolute", right: 13, background: "none", border: "none", cursor: "pointer", padding: 0, color: "#444", display: "flex" }}
                    >
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#f87171",
                    marginBottom: 16, fontWeight: 500,
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  style={{
                    width: "100%", background: "#f97316", color: "#fff", border: "none",
                    borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#ea6a0a")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#f97316")}
                >
                  Reset password
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
                  Password updated
                </h1>
                <p style={{ fontSize: 13, color: "#555", margin: "0 0 28px", lineHeight: 1.6 }}>
                  Your password has been reset. All other sessions have been signed out for security.
                </p>

                <a href="/signin" style={{
                  display: "block", width: "100%", background: "#f97316", color: "#fff",
                  border: "none", borderRadius: 10, padding: "13px",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  textAlign: "center", textDecoration: "none", boxSizing: "border-box",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#ea6a0a")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#f97316")}
                >
                  Sign in
                </a>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}