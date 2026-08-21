"use client";

import { useState } from "react";
import {
  registerWithEmail, verifyEmailCode, resendOtpCode, saveMotariProfile,
  apiError, type AuthResult,
} from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { Bike, ArrowLeft } from "lucide-react";

/**
 * One-page motari signup: legal name, plate, brand or model, phone, email,
 * password. Creates the worker account, verifies the email code, registers the
 * moto profile, and lands the new motari on the driver surface.
 */
export default function MotariRegisterPage() {
  const { t } = useLanguage();

  const [step, setStep] = useState<"FORM" | "VERIFY">("FORM");
  const [legalName, setLegalName] = useState("");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [auth, setAuth] = useState<AuthResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const formValid =
    legalName.trim().split(/\s+/).length >= 2 &&
    plate.trim().length >= 4 &&
    phone.replace(/\D/g, "").length >= 9 &&
    /.+@.+\..+/.test(email) &&
    password.length >= 8;

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
        role: "WORKER",
      });
      setAuth(result);
      localStorage.setItem("access_token", result.accessToken);
      localStorage.setItem("refresh_token", result.refreshToken);
      localStorage.setItem("user", JSON.stringify(result.user));
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
      // The account is live: register the moto so the login redirect knows
      // this worker is a motari, then land on the driver surface.
      await saveMotariProfile(
        { plateNumber: plate, brandModel: brand || undefined, legalName: legalName.trim() },
        auth.accessToken,
      );
      try { localStorage.removeItem("register_as_motari"); } catch {}
      window.location.href = "/seeker/motari";
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
    padding: "11px 12px", color: "#fff", fontSize: 12.5, fontWeight: 500,
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
    <div style={{ position: "fixed", inset: 0, background: "#000", overflowY: "auto", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: "26px 20px 40px", color: "#eee" }}>

        <a href="/motari" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#888", fontSize: 11, fontWeight: 700, textDecoration: "none", marginBottom: 22 }}>
          <ArrowLeft size={13} /> {t("motari.register.back") || "Back to Ask Motari"}
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <Bike size={20} color="#f97316" />
          <h1 style={{ fontSize: 19, fontWeight: 900, margin: 0, letterSpacing: "-0.01em" }}>
            {t("motari.register.title") || "Register as motari"}
          </h1>
        </div>
        <p style={{ color: "#777", fontSize: 12, margin: "0 0 22px", lineHeight: 1.6 }}>
          {t("motari.register.subtitle") || "One form. Your plate is what passengers check before they ride."}
        </p>

        {step === "FORM" ? (
          <div style={{ display: "grid", gap: 13 }}>
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
            <div>
              <span style={label}>{t("motari.register.phone") || "Phone number"}</span>
              <input style={input} value={phone} onChange={e => setPhone(e.target.value)}
                     placeholder="07xx xxx xxx" inputMode="tel" maxLength={20} />
            </div>
            <div>
              <span style={label}>{t("motari.register.email") || "Email"}</span>
              <input style={input} value={email} onChange={e => setEmail(e.target.value)}
                     placeholder="you@example.com" type="email" maxLength={120} />
            </div>
            <div>
              <span style={label}>{t("motari.register.password") || "Password"}</span>
              <input style={input} value={password} onChange={e => setPassword(e.target.value)}
                     placeholder={t("motari.register.password_hint") || "At least 8 characters"} type="password" maxLength={100} />
            </div>

            {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}

            <button onClick={submitForm} disabled={!formValid || busy} style={cta(formValid && !busy)}>
              {busy ? (t("motari.register.creating") || "Creating account…") : (t("motari.register.cta") || "Create motari account")}
            </button>

            <p style={{ color: "#555", fontSize: 11, textAlign: "center", margin: 0 }}>
              {t("motari.register.have_account") || "Already registered?"}{" "}
              <a href="/signin" style={{ color: "#f97316", fontWeight: 700, textDecoration: "none" }}>
                {t("motari.register.signin") || "Sign in"}
              </a>
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 13 }}>
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
