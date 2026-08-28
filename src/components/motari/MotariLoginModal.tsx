"use client";

import { useState } from "react";
import {
  loginWithEmail, authenticate2fa, verifyEmailCode, resendOtpCode,
  apiError, type AuthResult,
} from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { PasswordInput } from "@/components/ui/password-input";
import { Bike, X } from "lucide-react";

/**
 * Motari sign-in, as a modal on the Ask Motari app: email + password, with the
 * two gates a customer account can hit (TOTP code, unverified email) handled in
 * place. On success the session is saved and the account routes by role, so a
 * motari lands on /drive; a worker or employer still reaches their dashboard.
 */
export function MotariLoginModal({ open, onClose, onRegister }: {
  open: boolean;
  onClose: () => void;
  /** Switch to the registration modal. */
  onRegister?: () => void;
}) {
  const { t } = useLanguage();

  const [step, setStep] = useState<"LOGIN" | "TOTP" | "VERIFY">("LOGIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!open) return null;

  const finish = (result: AuthResult) => {
    localStorage.setItem("access_token", result.accessToken);
    localStorage.setItem("refresh_token", result.refreshToken);
    localStorage.setItem("user", JSON.stringify(result.user));
    window.location.href =
      result.user.role === "MOTARI" ? "/drive"
      : result.user.role === "EMPLOYER" ? "/owner"
      : "/seeker";
  };

  const submitLogin = async () => {
    if (!email || password.length < 1 || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await loginWithEmail({ email: email.trim(), password });
      if (result.requires2fa && result.tempToken) {
        setTempToken(result.tempToken);
        setStep("TOTP");
      } else if (result.requiresEmailVerification) {
        await resendOtpCode(email.trim()).catch(() => {});
        setStep("VERIFY");
        setNotice(t("motari.login.verify_note") || "Your email is not verified yet. Enter the code we just sent.");
      } else if (result.requires2faSetup) {
        // 2FA enrollment shows a QR code; that flow lives on the full sign-in page.
        window.location.href = "/signin";
      } else {
        finish(result);
      }
    } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const submitTotp = async () => {
    if (code.trim().length < 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      finish(await authenticate2fa(tempToken, code.trim()));
      return;
    } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const submitVerify = async () => {
    if (code.trim().length < 4 || busy) return;
    setBusy(true);
    setError("");
    try {
      await verifyEmailCode(email.trim(), code.trim());
      // Verified: repeat the login with the same credentials to get real tokens.
      const result = await loginWithEmail({ email: email.trim(), password });
      if (result.requires2fa && result.tempToken) {
        setTempToken(result.tempToken);
        setCode("");
        setStep("TOTP");
      } else {
        finish(result);
        return;
      }
    } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const input: React.CSSProperties = {
    width: "100%", background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 9,
    padding: "10px 12px", color: "#fff", fontSize: 12.5, fontWeight: 500,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };
  const label: React.CSSProperties = {
    fontSize: 8.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
    color: "#666", display: "block", margin: "0 0 5px",
  };
  const cta = (enabled: boolean): React.CSSProperties => ({
    width: "100%", background: enabled ? "#f97316" : "#1a1a1a",
    color: enabled ? "#000" : "#555", borderRadius: 10, padding: "12px 20px",
    fontWeight: 900, fontSize: 11.5, letterSpacing: "0.04em", border: "none",
    cursor: enabled ? "pointer" : "not-allowed", fontFamily: "inherit",
    textTransform: "uppercase",
  });
  const codeInput: React.CSSProperties = {
    ...input, fontSize: 18, letterSpacing: "0.4em", textAlign: "center", fontWeight: 800,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380, maxHeight: "90dvh", overflowY: "auto",
          background: "#000", border: "1px solid #1f1f1f", borderRadius: 16,
          padding: "20px 20px 24px", color: "#eee",
          boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <Bike size={18} color="#f97316" />
          <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, letterSpacing: "-0.01em", flex: 1 }}>
            {t("motari.login.title") || "Sign in"}
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ color: "#777", fontSize: 11.5, margin: "0 0 18px", lineHeight: 1.6 }}>
          {t("motari.login.subtitle") || "Motari go straight to the driver dashboard."}
        </p>

        {step === "LOGIN" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <span style={label}>{t("motari.register.email") || "Email"}</span>
              <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)}
                     placeholder="you@example.com" maxLength={120} />
            </div>
            <div>
              <span style={label}>{t("motari.register.password") || "Password"}</span>
              <PasswordInput style={input} value={password} onChange={setPassword}
                             onEnter={submitLogin} />
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}
            <button onClick={submitLogin} disabled={busy || !email || !password} style={cta(!busy && !!email && !!password)}>
              {busy ? (t("motari.login.signing") || "Signing in…") : (t("motari.login.cta") || "Sign in")}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <a href="/forgot-password" style={{ color: "#888", fontWeight: 700, textDecoration: "none" }}>
                {t("motari.login.forgot") || "Forgot password?"}
              </a>
              {onRegister && (
                <button onClick={onRegister} style={{ background: "none", border: "none", color: "#f97316", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 11, padding: 0 }}>
                  {t("motari.register.title") || "Register as motari"}
                </button>
              )}
            </div>
          </div>
        )}

        {step === "TOTP" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <span style={label}>{t("motari.login.totp") || "Authenticator code"}</span>
              <input style={codeInput} value={code} inputMode="numeric" autoFocus placeholder="000000"
                     onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                     onKeyDown={e => e.key === "Enter" && submitTotp()} />
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}
            <button onClick={submitTotp} disabled={busy || code.trim().length < 6} style={cta(!busy && code.trim().length >= 6)}>
              {busy ? (t("motari.login.signing") || "Signing in…") : (t("motari.login.cta") || "Sign in")}
            </button>
          </div>
        )}

        {step === "VERIFY" && (
          <div style={{ display: "grid", gap: 12 }}>
            {notice && <div style={{ color: "#4ade80", fontSize: 12 }}>{notice}</div>}
            <div>
              <span style={label}>{t("motari.register.code") || "Verification code"}</span>
              <input style={codeInput} value={code} inputMode="numeric" autoFocus placeholder="000000"
                     onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                     onKeyDown={e => e.key === "Enter" && submitVerify()} />
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}
            <button onClick={submitVerify} disabled={busy || code.trim().length < 4} style={cta(!busy && code.trim().length >= 4)}>
              {busy ? (t("motari.register.verifying") || "Verifying…") : (t("motari.login.verify_cta") || "Verify and sign in")}
            </button>
            <button onClick={() => resendOtpCode(email.trim()).then(() => setNotice(t("motari.register.code_resent") || "New code sent.")).catch(() => {})}
                    style={{ background: "none", border: "none", color: "#888", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t("motari.register.resend") || "Resend code"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
