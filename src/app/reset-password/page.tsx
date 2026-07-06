"use client";

import { useState, Suspense } from "react";
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { AuthCarousel } from "@/components/auth/auth-carousel";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";

function StrengthBar({ password }: { password: string }) {
  const { t } = useLanguage();
  const score = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const labels = [
    "", 
    t("reset_password_page.strength.weak"), 
    t("reset_password_page.strength.fair"), 
    t("reset_password_page.strength.good"), 
    t("reset_password_page.strength.strong")
  ];
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

function ResetPasswordForm() {
  const { t } = useLanguage();
  const { error: toastError, success: toastSuccess } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const handleSubmit = async () => {
    setMismatch(false);
    if (!token) {
      toastError(t("reset_password_page.toasts.missing_token"), { title: t("reset_password_page.toasts.reset_failed") });
      return;
    }
    if (password.length < 8) {
      toastError(t("reset_password_page.toasts.password_short"), { title: t("reset_password_page.toasts.reset_failed") });
      return;
    }
    if (password !== confirm) {
      setMismatch(true);
      toastError(t("reset_password_page.toasts.passwords_mismatch"), { title: t("reset_password_page.toasts.reset_failed") });
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      toastSuccess(t("reset_password_page.toasts.reset_success"), { title: t("reset_password_page.toasts.password_updated") });
      setDone(true);
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? "Password reset failed. Token may be expired.", { title: t("reset_password_page.toasts.reset_failed") });
    } finally {
      setLoading(false);
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
            }}>
              <ArrowLeft size={14} /> {t("reset_password_page.back_to_sign_in")}
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
                  {t("reset_password_page.title")}
                </h1>
                <p style={{ fontSize: 13, color: "#555", margin: "0 0 28px", lineHeight: 1.6 }}>
                  {t("reset_password_page.subtitle")}
                </p>

                {/* New password */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#aaa", display: "block", marginBottom: 6 }}>
                    {t("reset_password_page.new_password_label")}
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
                    {t("reset_password_page.confirm_password_label")}
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
                        border: `1px solid ${mismatch ? "#ef4444" : "#2a2a2a"}`,
                        borderRadius: 10, padding: "11px 36px 11px 36px",
                        fontSize: 13, color: "#f0f0f0", outline: "none", boxSizing: "border-box",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = mismatch ? "#ef4444" : "#f97316")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = mismatch ? "#ef4444" : "#2a2a2a")}
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

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    width: "100%", background: "#f97316", color: "#fff", border: "none",
                    borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#ea6a0a"; }}
                  onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#f97316"; }}
                >
                  {loading ? t("reset_password_page.resetting") : t("reset_password_page.submit_btn")}
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
                  {t("reset_password_page.success_title")}
                </h1>
                <p style={{ fontSize: 13, color: "#555", margin: "0 0 28px", lineHeight: 1.6 }}>
                  {t("reset_password_page.success_subtitle")}
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
                  {t("reset_password_page.signin_btn")}
                </a>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", height: "100vh", background: "#111" }} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}