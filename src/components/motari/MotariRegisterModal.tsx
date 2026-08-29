"use client";

import { useState, useEffect } from "react";
import {
  registerWithEmail, verifyEmailCode, resendOtpCode, saveMotariProfile,
  apiError, type AuthResult,
} from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { InvitedBy, useReferralCode } from "@/components/ui/invited-by";
import { PasswordInput } from "@/components/ui/password-input";
import { formatRwPhone, isValidRwPhone } from "@/lib/phone";
import { Bike, X } from "lucide-react";

/**
 * The motari signup, as a modal. Motari never use the worker/employer signup:
 * their field set is different (legal name, plate, brand or model, phone,
 * email, password). Creates the worker account, verifies the emailed code,
 * registers the moto profile, and lands the new motari on the driver surface.
 *
 * Openable from anywhere: the Ask Motari menu, the footer, and the signup page
 * all reach it (links use /motari?register=1, which auto-opens it on the map).
 */
export function MotariRegisterModal({ open, onClose, onSignIn }: {
  open: boolean;
  onClose: () => void;
  /** Switch to the sign-in modal; falls back to the /signin page when absent. */
  onSignIn?: () => void;
}) {
  const { t } = useLanguage();

  const [step, setStep] = useState<"FORM" | "VERIFY">("FORM");

  /**
   * Adding a moto to an account that already exists.
   *
   * Reached from the driver screen by the accounts that were left without one.
   * The moto questions are the same questions, so they are asked here rather
   * than copied onto a working screen: two forms for one fact is how the two
   * came to disagree about when it gets saved.
   */
  const [finishing, setFinishing] = useState(false);
  useEffect(() => {
    try {
      const wants = new URLSearchParams(window.location.search).get("finish") === "1";
      setFinishing(wants && !!localStorage.getItem("access_token"));
    } catch {
      // No window or no storage: an ordinary registration, then.
    }
  }, []);
  const [legalName, setLegalName] = useState("");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const referralCode = useReferralCode();
  const [code, setCode] = useState("");
  const [auth, setAuth] = useState<AuthResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!open) return null;

  const formValid =
    legalName.trim().split(/\s+/).length >= 2 &&
    plate.trim().length >= 4 &&
    isValidRwPhone(phone) &&
    /.+@.+\..+/.test(email) &&
    password.length >= 8;

  /** Just the moto, onto the account already signed in on this device. */
  const submitMotoOnly = async () => {
    if (busy || plate.trim().length < 4) return;
    setBusy(true);
    setError("");
    try {
      await saveMotariProfile(
        { plateNumber: plate, brandModel: brand || undefined, legalName: legalName.trim() || undefined },
        localStorage.getItem("access_token") || "",
      );
      window.location.href = "/drive";
      return;
    } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const submitForm = async () => {
    if (!formValid || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await registerWithEmail({
        name: legalName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role: "MOTARI",
        referralCode: referralCode || undefined,
      });
      setAuth(result);
      localStorage.setItem("access_token", result.accessToken);
      localStorage.setItem("refresh_token", result.refreshToken);
      localStorage.setItem("user", JSON.stringify(result.user));

      /*
       * The moto is saved here, with the account, not after the code.
       *
       * It was typed on this page and then held until the email was confirmed,
       * so anybody who closed the tab at the code screen left an account with
       * the role of a motari and no moto attached to it. Those accounts could
       * not be verified, could not take work, and did not appear on the panel
       * that would have chased them: they had simply been thrown away while
       * looking like a successful sign-up.
       *
       * The plate is on the screen and the account exists; there is nothing an
       * email code adds to writing it down.
       */
      await saveMotariProfile(
        { plateNumber: plate, brandModel: brand || undefined, legalName: legalName.trim() },
        result.accessToken,
      );

      // An account that does not have to confirm anything is already live, so
      // there is no code screen to send them to.
      if (result.user?.emailVerified) {
        window.location.href = "/drive";
        return;
      }

      setStep("VERIFY");
      setNotice(t("motari.register.code_sent") || "We emailed you a 6 digit code.");
    } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const submitVerify = async () => {
    if (code.trim().length < 4 || busy || !auth) return;
    setBusy(true);
    setError("");
    try {
      await verifyEmailCode(email.trim(), code.trim());
      // The moto was saved with the account. This step only confirms the email,
      // and then lands them on the driver surface.
      window.location.href = "/drive";
      return;
    } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const resend = async () => {
    try {
      await resendOtpCode(email.trim());
      setNotice(t("motari.register.code_resent") || "New code sent.");
    } catch (e) { setError(apiError(e)); }
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
          width: "100%", maxWidth: 420, maxHeight: "90dvh", overflowY: "auto",
          background: "#000", border: "1px solid #1f1f1f", borderRadius: 16,
          padding: "20px 20px 24px", color: "#eee",
          boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <Bike size={18} color="#f97316" />
          <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, letterSpacing: "-0.01em", flex: 1 }}>
            {t("motari.register.title") || "Register as motari"}
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ color: "#777", fontSize: 11.5, margin: "0 0 18px", lineHeight: 1.6 }}>
          {finishing
            ? (t("motari.register.finish_hint")
               || "Add your moto to finish setting up. Your plate is what passengers check before they ride.")
            : (t("motari.register.subtitle")
               || "One form. Your plate is what passengers check before they ride.")}
        </p>

        {step === "FORM" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <span style={label}>{t("motari.register.legal_name") || "Legal name"}</span>
              <input style={input} value={legalName} onChange={e => setLegalName(e.target.value)}
                     placeholder={t("motari.register.legal_name_hint") || "As written on your ID"} maxLength={120} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={label}>{t("motari.register.plate") || "Plate number"}</span>
                <input style={input} value={plate} onChange={e => setPlate(e.target.value)}
                       placeholder="RC 123 A" maxLength={20} />
              </div>
              <div>
                <span style={label}>{t("motari.register.brand") || "Brand or model"}</span>
                <input style={input} value={brand} onChange={e => setBrand(e.target.value)}
                       placeholder="TVS, Bajaj Boxer" maxLength={60} />
              </div>
            </div>
            {!finishing && (
            <div>
              <span style={label}>{t("motari.register.phone") || "Phone number"}</span>
              <input style={input} value={phone} onChange={e => setPhone(formatRwPhone(e.target.value))}
                     placeholder="07xxxxxxxx" inputMode="numeric" maxLength={10} />
            </div>
            )}
            {!finishing && (
            <div>
              <span style={label}>{t("motari.register.email") || "Email"}</span>
              <input style={input} value={email} onChange={e => setEmail(e.target.value)}
                     placeholder="you@example.com" type="email" maxLength={120} />
            </div>
            )}
            {!finishing && <InvitedBy code={referralCode} />}

            {!finishing && (
            <div>
              <span style={label}>{t("motari.register.password") || "Password"}</span>
              <PasswordInput style={input} value={password} onChange={setPassword}
                             autoComplete="new-password"
                             placeholder={t("motari.register.password_hint") || "At least 8 characters"} />
            </div>
            )}

            {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}

            {finishing ? (
              <button onClick={submitMotoOnly}
                      disabled={busy || plate.trim().length < 4}
                      style={cta(!busy && plate.trim().length >= 4)}>
                {busy
                  ? (t("motari.register.saving") || "Saving…")
                  : (t("motari.dash.save_moto") || "Save moto")}
              </button>
            ) : (
              <button onClick={submitForm} disabled={!formValid || busy} style={cta(formValid && !busy)}>
                {busy ? (t("motari.register.creating") || "Creating account…") : (t("motari.register.cta") || "Create motari account")}
              </button>
            )}

            {!finishing && (
            <p style={{ color: "#555", fontSize: 11, textAlign: "center", margin: 0 }}>
              {t("motari.register.have_account") || "Already registered?"}{" "}
              {onSignIn ? (
                <button onClick={onSignIn} style={{ background: "none", border: "none", color: "#f97316", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 11, padding: 0 }}>
                  {t("motari.register.signin") || "Sign in"}
                </button>
              ) : (
                <a href="/signin" style={{ color: "#f97316", fontWeight: 700, textDecoration: "none" }}>
                  {t("motari.register.signin") || "Sign in"}
                </a>
              )}
            </p>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {notice && <div style={{ color: "#4ade80", fontSize: 12 }}>{notice}</div>}
            <div>
              <span style={label}>{t("motari.register.code") || "Verification code"}</span>
              <input
                style={{ ...input, fontSize: 18, letterSpacing: "0.4em", textAlign: "center", fontWeight: 800 }}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000" inputMode="numeric" autoFocus
              />
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}
            <button onClick={submitVerify} disabled={code.trim().length < 4 || busy} style={cta(code.trim().length >= 4 && !busy)}>
              {busy ? (t("motari.register.verifying") || "Verifying…") : (t("motari.register.verify_cta") || "Verify and start driving")}
            </button>
            <button onClick={resend} style={{ background: "none", border: "none", color: "#888", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t("motari.register.resend") || "Resend code"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
