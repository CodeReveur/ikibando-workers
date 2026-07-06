"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft } from "lucide-react";
import { AuthCarousel } from "@/components/auth/auth-carousel";
import { saveRedirect } from "@/lib/auth-redirect";
import { useGoogleLogin } from "@react-oauth/google";
import { loginWithGoogle, loginWithFacebook, registerWithEmail } from "@/lib/api";
import { getAndClearRedirect } from "@/lib/auth-redirect";
import { RegistrationWizard } from "@/components/auth/registration-wizard";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";

declare global {
  interface Window {
    FB?: {
      init: (opts: object) => void;
      login: (
        cb: (res: { authResponse?: { accessToken: string } }) => void,
        opts: object
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export default function SignUpPage() {
  const { t } = useLanguage();
  const { error: toastError } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState<"google" | "facebook" | "email" | null>(null);
  const [fieldErrors, setFieldErrors] = useState({ name: "", email: "", phone: "", password: "" });
  const [showWizard, setShowWizard] = useState(false);
  const [authResult, setAuthResult] = useState<any>(null);
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const fbReady = useRef(false);

  // Capture a referral code from the invite link (?ref=CODE).
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReferralCode(ref.trim().toUpperCase());
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (fieldErrors[k]) setFieldErrors((f) => ({ ...f, [k]: "" }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (!raw.startsWith("+")) raw = "+" + raw.replace(/\+/g, "");

    let formatted = raw;
    const spaceIdx = raw.indexOf(" ");

    if (spaceIdx > 0 && spaceIdx <= 5) {
      let cc = raw.slice(0, spaceIdx).replace(/[^\d+]/g, "");
      let rest = raw.slice(spaceIdx).replace(/\D/g, "");
      let grouped = rest.match(/.{1,3}/g)?.join(" ") || "";
      formatted = grouped ? `${cc} ${grouped}` : cc + " ";
    } else {
      let cleaned = raw.replace(/[^\d+]/g, "");
      let cc = cleaned.slice(0, 4);
      let rest = cleaned.slice(4).match(/.{1,3}/g)?.join(" ") || "";
      formatted = rest ? `${cc} ${rest}` : cc;
    }

    setForm((f) => ({ ...f, phone: formatted }));
    if (fieldErrors.phone) setFieldErrors((f) => ({ ...f, phone: "" }));
  };

  const handleBlur = (field: keyof typeof form) => {
    let err = "";
    if (field === "name" && !form.name.trim()) err = t("signup.errors.name_req");
    if (field === "email") {
      if (!form.email) err = t("signup.errors.email_req");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err = t("signup.errors.email_invalid");
    }
    if (field === "phone") {
      if (!form.phone) err = t("signup.errors.phone_req");
      else if (!/^\+\d{1,4}\s?\d{6,14}$/.test(form.phone.replace(/[\s-]/g, ""))) err = t("signup.errors.phone_invalid");
    }
    if (field === "password") {
      if (!form.password) err = t("signup.errors.password_req");
      else if (form.password.length < 8) err = t("signup.errors.password_min");
    }
    setFieldErrors((f) => ({ ...f, [field]: err }));
  };

  /* ── Facebook SDK bootstrap ──────────────────────────────────────────── */
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    if (!appId) return;

    window.fbAsyncInit = () => {
      window.FB?.init({ appId, version: "v19.0", xfbml: false, cookie: false });
      fbReady.current = true;
    };

    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    }

    // Auto-detect country code for phone number
    fetch("https://ipapi.co/country_calling_code/")
      .then((res) => res.text())
      .then((code) => {
        if (code && code.startsWith("+")) {
          setForm((f) => ({ ...f, phone: code + " " }));
        }
      })
      .catch(() => {
        setForm((f) => ({ ...f, phone: "+250 " }));
      });
  }, []);

  /* ── Google handler ─────────────────────────────────────────────────── */
  const handleGoogle = useGoogleLogin({
    onSuccess: async ({ access_token }) => {
      setLoading("google");
      try {
        const result = await loginWithGoogle(access_token);
        if (!result.user.onboardingCompleted) {
          setAuthResult(result);
          setShowRoleSelect(true);
          setShowWizard(true);
        } else {
          saveAndRedirect(result);
        }
      } catch {
        toastError(t("signup.toasts.google_fail_desc"), { title: t("signup.toasts.signup_failed_title") });
      } finally {
        setLoading(null);
      }
    },
    onError: () => toastError(t("signup.toasts.google_cancelled_desc"), { title: t("signup.toasts.signup_failed_title") }),
  });

  /* ── Facebook handler ───────────────────────────────────────────────── */
  const handleFacebook = () => {
    if (window.location.protocol !== "https:") {
      toastError(t("signup.toasts.fb_https_desc"), { title: t("signup.toasts.signup_failed_title") });
      return;
    }
    if (!window.FB) {
      toastError(t("signup.toasts.fb_not_avail_desc"), { title: t("signup.toasts.signup_failed_title") });
      return;
    }
    window.FB.login(
      (res) => {
        if (!res.authResponse?.accessToken) return;
        setLoading("facebook");
        loginWithFacebook(res.authResponse.accessToken)
          .then((result) => {
            if (!result.user.onboardingCompleted) {
              setAuthResult(result);
              setShowRoleSelect(true);
              setShowWizard(true);
            } else {
              saveAndRedirect(result);
            }
          })
          .catch(() => {
            toastError(t("signup.toasts.fb_fail_desc"), { title: t("signup.toasts.signup_failed_title") });
          })
          .finally(() => {
            setLoading(null);
          });
      },
      { scope: "public_profile,email" }
    );
  };

  /* ── Email / password handler ───────────────────────────────────────── */
  const handleSubmit = async () => {
    // Validate all
    let hasError = false;
    const newErrors = { name: "", email: "", phone: "", password: "" };

    if (!form.name.trim()) { newErrors.name = t("signup.errors.name_req"); hasError = true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { newErrors.email = t("signup.errors.email_invalid"); hasError = true; }
    if (!/^\+\d{1,4}\s?\d{6,14}$/.test(form.phone.replace(/[\s-]/g, ""))) { newErrors.phone = t("signup.errors.phone_invalid"); hasError = true; }
    if (form.password.length < 8) { newErrors.password = t("signup.errors.password_min"); hasError = true; }

    setFieldErrors(newErrors);
    if (hasError) {
      toastError(t("signup.toasts.validation_error_desc"), { title: t("signup.toasts.signup_failed_title") });
      return;
    }

    setLoading("email");
    try {
      const result = await registerWithEmail({ ...form, role: "WORKER", referralCode: referralCode || undefined });
      if (!result.user.onboardingCompleted) {
        setAuthResult(result);
        setShowRoleSelect(true);
        setShowWizard(true);
      } else {
        saveAndRedirect(result);
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("signup.toasts.fail_generic_desc");
      toastError(msg, { title: t("signup.toasts.signup_failed_title") });
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <style>{`
        :root {
          --auth-orange: #f97316;
          --auth-orange-hover: #ea6a0a;
          --auth-bg: #111;
          --auth-panel-border: #1e1e1e;
          --auth-field-bg: #141414;
          --auth-field-border: #2a2a2a;
          --auth-text: #f0f0f0;
          --auth-muted: #555;
          --auth-faint: #444;
          --auth-label: #aaa;
          --auth-error: #f87171;
        }

        * { box-sizing: border-box; }

        html, body { margin: 0; padding: 0; }

        input::placeholder { color: var(--auth-faint); }

        .auth-shell {
          display: flex;
          height: 100vh;
          height: 100dvh;
          width: 100%;
          background: var(--auth-bg);
          font-family: Inter, "DM Sans", system-ui, sans-serif;
          overflow: hidden;
          position: relative;
        }

        .auth-home-btn {
          position: fixed;
          top: clamp(8px, 3vw, 20px);
          left: clamp(8px, 3vw, 20px);
          top: calc(clamp(8px, 3vw, 20px) + env(safe-area-inset-top, 0px));
          left: calc(clamp(8px, 3vw, 20px) + env(safe-area-inset-left, 0px));
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 6px;
          background: #1a1a1a;
          border: 1px solid var(--auth-field-border);
          border-radius: 999px;
          padding: clamp(6px, 2vw, 9px) clamp(8px, 2.6vw, 14px);
          font-size: clamp(9px, 2.4vw, 12px);
          font-weight: 600;
          color: #d0d0d0;
          text-decoration: none;
          cursor: pointer;
        }

        .auth-home-btn:hover {
          border-color: var(--auth-orange);
          color: #fff;
        }

        .auth-home-btn svg {
          width: clamp(11px, 3vw, 14px);
          height: clamp(11px, 3vw, 14px);
          flex: none;
        }

        .auth-home-btn span {
          white-space: nowrap;
        }

        /* Home button is mobile-only; hide once the carousel appears */
        @media (min-width: 860px) {
          .auth-home-btn { display: none; }
        }

        .auth-left {
          display: none;
          flex: 0 0 46%;
          border-right: 1px solid var(--auth-panel-border);
          min-width: 0;
          height: 100%;
          overflow: hidden;
        }

        .auth-right {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: clamp(52px, 16vw, 76px) clamp(10px, 5vw, 24px) clamp(16px, 5vw, 40px);
          padding: calc(clamp(52px, 16vw, 76px) + env(safe-area-inset-top, 0px))
                   calc(clamp(10px, 5vw, 24px) + env(safe-area-inset-right, 0px))
                   calc(clamp(16px, 5vw, 40px) + env(safe-area-inset-bottom, 0px))
                   calc(clamp(10px, 5vw, 24px) + env(safe-area-inset-left, 0px));
        }

        @media (min-width: 860px) {
          .auth-right {
            padding: clamp(16px, 6vw, 60px) clamp(10px, 5vw, 24px) clamp(16px, 5vw, 40px);
          }
        }

        .auth-card {
          width: 100%;
          max-width: 380px;
        }

        .auth-title {
          font-size: clamp(15px, 4.5vw, 24px);
          font-weight: 800;
          color: #fff;
          margin: 0 0 4px;
          letter-spacing: -0.4px;
          line-height: 1.25;
        }

        .auth-subtitle {
          font-size: clamp(10px, 2.8vw, 13px);
          color: var(--auth-muted);
          margin: 0 0 clamp(12px, 4vw, 22px);
          line-height: 1.4;
        }

        .auth-social-group {
          display: flex;
          flex-direction: column;
          gap: clamp(6px, 2vw, 10px);
          margin-bottom: clamp(12px, 4vw, 22px);
        }

        .auth-social-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          background: #1a1a1a;
          border: 1px solid var(--auth-field-border);
          border-radius: 10px;
          padding: clamp(8px, 2.6vw, 11px) clamp(8px, 3vw, 16px);
          font-size: clamp(10px, 2.8vw, 13px);
          font-weight: 600;
          color: #d0d0d0;
          cursor: pointer;
          min-height: 40px;
        }

        .auth-social-btn:disabled {
          color: var(--auth-muted);
          cursor: not-allowed;
        }

        .auth-social-btn:not(:disabled):hover {
          border-color: var(--auth-orange);
        }

        .auth-social-btn svg {
          width: clamp(13px, 3.5vw, 16px);
          height: clamp(13px, 3.5vw, 16px);
          flex: none;
        }

        .auth-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: clamp(10px, 4vw, 20px) 0;
        }

        .auth-divider-line {
          flex: 1;
          height: 1px;
          background: var(--auth-panel-border);
        }

        .auth-divider-text {
          font-size: clamp(9px, 2.4vw, 11px);
          color: var(--auth-faint);
          font-weight: 600;
        }

        .auth-field {
          margin-bottom: clamp(8px, 3vw, 14px);
        }

        .auth-label {
          font-size: clamp(10px, 2.6vw, 12px);
          font-weight: 600;
          color: var(--auth-label);
          display: block;
          margin-bottom: 6px;
        }

        .auth-input-row {
          position: relative;
          display: flex;
          align-items: center;
        }

        .auth-input-icon {
          position: absolute;
          left: clamp(9px, 2.6vw, 13px);
          pointer-events: none;
          display: flex;
        }

        .auth-input-icon svg {
          width: clamp(12px, 3vw, 14px);
          height: clamp(12px, 3vw, 14px);
        }

        .auth-input-suffix {
          position: absolute;
          right: clamp(9px, 2.6vw, 13px);
          display: flex;
        }

        .auth-input-suffix button svg {
          width: clamp(12px, 3vw, 14px);
          height: clamp(12px, 3vw, 14px);
        }

        .auth-input {
          width: 100%;
          background: var(--auth-field-bg);
          border: 1px solid var(--auth-field-border);
          border-radius: 10px;
          padding: clamp(8px, 2.8vw, 11px) clamp(28px, 8vw, 36px);
          font-size: clamp(11px, 3vw, 13px);
          color: var(--auth-text);
          outline: none;
          min-height: 38px;
        }

        .auth-input:focus {
          border-color: var(--auth-orange);
        }

        .auth-field-error {
          color: var(--auth-error);
          font-size: clamp(9px, 2.4vw, 11px);
          margin-top: 6px;
          line-height: 1.35;
        }

        .auth-submit {
          width: 100%;
          background: var(--auth-orange);
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: clamp(10px, 3.4vw, 13px);
          font-size: clamp(11px, 3.2vw, 14px);
          font-weight: 700;
          cursor: pointer;
          margin-top: 8px;
          min-height: 40px;
        }

        .auth-submit:hover {
          background: var(--auth-orange-hover);
        }

        .auth-terms {
          font-size: clamp(9px, 2.4vw, 11px);
          color: var(--auth-faint);
          text-align: center;
          margin: clamp(8px, 3vw, 14px) 0 0;
          line-height: 1.6;
        }

        .auth-terms a {
          color: #666;
          text-decoration: underline;
        }

        .auth-signin {
          text-align: center;
          font-size: clamp(10px, 2.8vw, 13px);
          color: var(--auth-muted);
          margin-top: clamp(10px, 3vw, 18px);
        }

        .auth-signin a {
          color: var(--auth-orange);
          text-decoration: none;
          font-weight: 700;
        }

        /* ── Ultra-small viewports (smartwatches, ~130-240px) ───────────── */
        @media (max-width: 240px) {
          .auth-right { padding: 8px 6px; }
          .auth-subtitle { display: none; }
          .auth-terms { display: none; }
          .auth-label { margin-bottom: 3px; }
          .auth-field { margin-bottom: 6px; }
          .auth-social-group { margin-bottom: 8px; }
          .auth-divider { margin: 6px 0; }
          .auth-home-btn span { display: none; }
          .auth-home-btn { padding: 6px; }
        }

        /* ── Two-column layout once there's room for the carousel ──────── */
        @media (min-width: 860px) {
          .auth-left { display: block; }
        }

        @media (min-width: 1400px) {
          .auth-card { max-width: 420px; }
        }
      `}</style>

      <div className="auth-shell">
        <a href="/" className="auth-home-btn" aria-label={t("signup.buttons.back_to_home")}>
          <ArrowLeft />
          <span>{t("signup.buttons.home")}</span>
        </a>

        {/* LEFT */}
        <div className="auth-left">
          <AuthCarousel />
        </div>

        {/* RIGHT */}
        <div className="auth-right">
          <div className="auth-card">

            <h1 className="auth-title">{t("signup.hero.title")}</h1>
            <p className="auth-subtitle">{t("signup.hero.subtitle")}</p>

            {/* Social */}
            <div className="auth-social-group">
              <SocialBtn
                icon={<GoogleIcon />}
                label={loading === "google" ? t("signup.buttons.signing_in") : t("signup.buttons.continue_google")}
                disabled={loading !== null}
                onClick={() => handleGoogle()}
              />
              <SocialBtn
                icon={<FacebookIcon />}
                label={loading === "facebook" ? t("signup.buttons.signing_in") : t("signup.buttons.continue_facebook")}
                disabled={loading !== null}
                onClick={handleFacebook}
              />
            </div>

            <Divider />

            <Field label={t("signup.fields.name_label")} error={fieldErrors.name}>
              <InputRow icon={<User />}>
                <input type="text" placeholder="Jean Pierre Mugisha" value={form.name}
                  onChange={set("name")} className="auth-input"
                  onBlur={() => handleBlur("name")}
                />
              </InputRow>
            </Field>

            <Field label={t("signup.fields.email_label")} error={fieldErrors.email}>
              <InputRow icon={<Mail />}>
                <input type="email" placeholder="you@example.com" value={form.email}
                  onChange={set("email")} className="auth-input"
                  onBlur={() => handleBlur("email")}
                />
              </InputRow>
            </Field>

            <Field label={t("signup.fields.phone_label")} error={fieldErrors.phone}>
              <InputRow icon={<Phone />}>
                <input type="tel" placeholder="+250 7XX XXX XXX" value={form.phone}
                  onChange={handlePhoneChange} className="auth-input"
                  onBlur={() => handleBlur("phone")}
                />
              </InputRow>
            </Field>

            <Field label={t("signup.fields.password_label")} error={fieldErrors.password}>
              <InputRow icon={<Lock />} suffix={
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#444", display: "flex" }}
                  aria-label={showPassword ? t("signin.fields.hide_password_aria") || "Hide password" : t("signin.fields.show_password_aria") || "Show password"}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              }>
                <input type={showPassword ? "text" : "password"} placeholder={t("signup.fields.password_placeholder") || "Min. 8 characters"} value={form.password}
                  onChange={set("password")} className="auth-input"
                  onBlur={() => handleBlur("password")}
                />
              </InputRow>
            </Field>

            <button
              type="button"
              disabled={loading === "email"}
              onClick={handleSubmit}
              className="auth-submit"
              style={{ opacity: loading === "email" ? 0.7 : 1 }}
            >
              {loading === "email" ? t("signup.buttons.registering") : t("signup.buttons.submit")}
            </button>

            <p className="auth-terms">
              {t("signup.footer.terms_p1")}{" "}
              <a href="/terms-and-conditions">{t("signup.footer.terms_link")}</a> &amp;{" "}
              <a href="/privacy-policy">{t("signup.footer.privacy_link")}</a>.
            </p>

            <p className="auth-signin">
              {t("signup.footer.has_account")}{" "}
              <a
                href="/signin"
                onClick={() => {
                  const existing = sessionStorage.getItem("auth_redirect");
                  if (!existing) saveRedirect();
                }}
              >{t("signup.footer.signin_link")}</a>
            </p>
          </div>
        </div>
      </div>
      {showWizard && authResult && (
        <RegistrationWizard
          email={form.email || authResult?.user?.email || ""}
          authResult={authResult}
          showRoleSelect={showRoleSelect}
          onComplete={() => saveAndRedirect(authResult)}
        />
      )}
    </>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

type AuthResult = Awaited<ReturnType<typeof registerWithEmail>>;

function saveAndRedirect(result: AuthResult) {
  localStorage.setItem("access_token", result.accessToken);
  localStorage.setItem("refresh_token", result.refreshToken);
  localStorage.setItem("user", JSON.stringify(result.user));
  const stored = getAndClearRedirect();
  const defaultDest = result.user.role === "EMPLOYER" ? "/owner" : "/seeker";
  window.location.href = stored || defaultDest;
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SocialBtn({
  icon, label, disabled, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="auth-social-btn"
    >
      {icon}{label}
    </button>
  );
}

function Divider() {
  const { t } = useLanguage();
  return (
    <div className="auth-divider">
      <div className="auth-divider-line" />
      <span className="auth-divider-text">{t("signup.general.or")}</span>
      <div className="auth-divider-line" />
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="auth-field">
      <label className="auth-label">{label}</label>
      {children}
      {error && <div className="auth-field-error">{error}</div>}
    </div>
  );
}

function InputRow({ icon, suffix, children }: { icon: React.ReactNode; suffix?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="auth-input-row">
      <span className="auth-input-icon">{icon}</span>
      {children}
      {suffix && <span className="auth-input-suffix">{suffix}</span>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}