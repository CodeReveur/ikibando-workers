"use client";

import { useState, useEffect, useRef } from "react";
import {
  registerWithEmail, verifyEmailCode, resendOtpCode, saveMotariProfile, checkPlateNumber,
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
  /*
   * Whether the plate is a real, authorised moto that nobody else has.
   *
   * Checked two seconds after somebody stops typing, not when they leave the
   * field. Waiting for them to leave means the answer arrives at the moment
   * their attention has already moved on, and somebody who types their plate
   * last and reaches straight for the button never sees it at all. Two seconds
   * of stillness is long enough that a plate is not checked letter by letter,
   * and short enough that the answer is waiting by the time they look up.
   */
  const [plateState, setPlateState] =
    useState<"idle" | "checking" | "valid" | "invalid" | "unknown" | "taken">("idle");
  const [plateNote, setPlateNote] = useState("");
  const plateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkPlate = (value: string) => {
    if (plateTimer.current) clearTimeout(plateTimer.current);
    const typed = value.trim();
    if (typed.replace(/[^A-Za-z0-9]/g, "").length < 5) {
      setPlateState("idle");
      setPlateNote("");
      return;
    }
    setPlateState("checking");
    setPlateNote("");
    plateTimer.current = setTimeout(async () => {
      try {
        const r = await checkPlateNumber(typed);
        // Taken is its own answer. A plate can be perfectly real and still
        // unusable here, and calling that invalid would send somebody off to
        // argue with RURA about a plate RURA is happy with.
        setPlateState(
          r.verdict === "VALID" ? (r.taken ? "taken" : "valid")
          : r.verdict === "INVALID" ? "invalid"
          : "unknown");
        setPlateNote(r.message || "");
        // Shown back in the form the regulator uses, so what was checked and
        // what is on the moto are visibly the same thing. Only once it is
        // settled: rewriting the box while somebody is still typing moves the
        // caret out from under them.
        if (r.display && r.verdict !== "UNKNOWN") setPlate(r.display);
      } catch {
        setPlateState("unknown");
        setPlateNote("");
      }
    }, 2000);
  };

  const [finishing, setFinishing] = useState(false);
  useEffect(() => {
    try {
      const wants = new URLSearchParams(window.location.search).get("finish") === "1";
      setFinishing(wants && !!localStorage.getItem("access_token"));
    } catch {
      // No window or no storage: an ordinary registration, then.
    }
  }, []);
  /*
   * What is wrong with each field, and whether anybody has left it yet.
   *
   * Checked when a field is left rather than while it is being typed in: a
   * half-written email is not a mistake, it is somebody mid-word, and marking
   * it red while they type is the form arguing with them. Once they have left
   * it, though, it keeps checking as they fix it, so the red goes the moment
   * the problem does rather than making them leave the field again to find out.
   */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rules: Record<string, (v: string) => string> = {
    legalName: v => !v.trim() ? (t("motari.register.err_name") || "Your name as written on your ID.")
      : v.trim().split(/\s+/).length < 2
        ? (t("motari.register.err_name_two") || "Both your names, as on your ID.")
        : "",
    phone: v => !v.trim() ? (t("motari.register.err_phone") || "A number passengers can call.")
      : !isValidRwPhone(v) ? (t("motari.register.err_phone_bad") || "That is not a Rwandan number.") : "",
    email: v => !v.trim() ? (t("motari.register.err_email") || "An email address.")
      : !/.+@.+\..+/.test(v) ? (t("motari.register.err_email_bad") || "That does not look like an email address.") : "",
    password: v => v.length < 8
      ? (t("motari.register.err_password") || "At least 8 characters.") : "",
  };

  const check = (name: string, value: string) => {
    const rule = rules[name];
    if (!rule) return;
    setErrors(prev => ({ ...prev, [name]: rule(value) }));
  };

  /** Left a field: from here on it is checked on every keystroke. */
  const leave = (name: string, value: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    check(name, value);
  };

  /** Typed in a field: only re-checked once they have already left it once. */
  const typed = (name: string, value: string) => {
    if (touched[name]) check(name, value);
  };

  /** Red border and a line underneath, but only after they have left it. */
  const fieldError = (name: string) => (touched[name] ? errors[name] || "" : "");

  const fieldStyle = (name: string) => ({
    ...input,
    ...(fieldError(name) ? { borderColor: "#7f1d1d" } : {}),
  });

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

  // Nothing goes through unconfirmed. A plate RURA denies and one it could not
  // be asked about are both refused, and the field says which: the first is the
  // motari's to fix, the second is ours and will pass on a retry.
  const plateBlocks = plateState !== "valid";

  /*
   * Every rule, asked of the current values rather than of what was last
   * checked. A form that submits on stale validation is a form that submits
   * whatever was true a moment ago.
   */
  const formValid =
    !rules.legalName(legalName) &&
    !rules.phone(phone) &&
    !rules.email(email) &&
    !rules.password(password) &&
    plate.trim().length >= 4 &&
    !plateBlocks;

  /** Just the moto, onto the account already signed in on this device. */
  const submitMotoOnly = async () => {
    if (busy || plate.trim().length < 4 || plateBlocks) return;
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
  /** The reason a field is red, said under it. Nothing when there is none. */
  const FieldNote = ({ name }: { name: string }) => {
    const e = fieldError(name);
    return e ? <div style={{ color: "#f87171", fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{e}</div> : null;
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
              <input style={fieldStyle("legalName")} value={legalName}
                     onChange={e => { setLegalName(e.target.value); typed("legalName", e.target.value); }}
                     onBlur={e => leave("legalName", e.target.value)}
                     placeholder={t("motari.register.legal_name_hint") || "As written on your ID"} maxLength={120} />
              <FieldNote name="legalName" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={label}>{t("motari.register.plate") || "Plate number"}</span>
                <input style={{ ...input, borderColor: plateState === "invalid" || plateState === "taken" ? "#7f1d1d" : undefined }}
                       value={plate}
                       onChange={e => { setPlate(e.target.value); checkPlate(e.target.value); }}
                       onBlur={e => checkPlate(e.target.value)}
                       placeholder="RA 123B" maxLength={20} />
                {plateState !== "idle" && (
                  <div style={{
                    fontSize: 11, marginTop: 4, lineHeight: 1.5,
                    color: plateState === "valid" ? "#4ade80"
                         : plateState === "invalid" || plateState === "taken" ? "#f87171"
                         : "#9a9a9a",
                  }}>
                    {plateState === "checking" && (t("motari.register.plate_checking") || "Checking with RURA…")}
                    {plateState === "valid" && (t("motari.register.plate_ok") || "Registered with RURA.")}
                    {plateState === "invalid" && (plateNote
                      || t("motari.register.plate_bad")
                      || "RURA has no record of this plate. Check it and try again.")}
                    {plateState === "unknown" && (t("motari.register.plate_unknown")
                      || "We could not reach RURA to confirm this plate. Please try again in a moment.")}
                    {plateState === "taken" && (plateNote
                      || t("motari.register.plate_taken")
                      || "A valid plate, but another motari has already registered it.")}
                  </div>
                )}
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
              <input style={fieldStyle("phone")}
                     value={phone}
                     onChange={e => { const v = formatRwPhone(e.target.value); setPhone(v); typed("phone", v); }}
                     onBlur={e => leave("phone", e.target.value)}
                     placeholder="07xxxxxxxx" inputMode="numeric" maxLength={10} />
              <FieldNote name="phone" />
            </div>
            )}
            {!finishing && (
            <div>
              <span style={label}>{t("motari.register.email") || "Email"}</span>
              <input style={fieldStyle("email")} value={email}
                     onChange={e => { setEmail(e.target.value); typed("email", e.target.value); }}
                     onBlur={e => leave("email", e.target.value)}
                     placeholder="you@example.com" type="email" maxLength={120} />
              <FieldNote name="email" />
            </div>
            )}
            {!finishing && <InvitedBy code={referralCode} />}

            {!finishing && (
            <div>
              <span style={label}>{t("motari.register.password") || "Password"}</span>
              <PasswordInput style={fieldStyle("password")} value={password}
                             onChange={v => { setPassword(v); typed("password", v); }}
                             onBlur={e => leave("password", e.target.value)}
                             autoComplete="new-password"
                             placeholder={t("motari.register.password_hint") || "At least 8 characters"} />
              <FieldNote name="password" />
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
