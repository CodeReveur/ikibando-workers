"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from "lucide-react";
import { AuthCarousel } from "@/components/auth/auth-carousel";
import { saveRedirect } from "@/lib/auth-redirect";
import { GoogleLoginGate, GOOGLE_AUTH_ENABLED } from "@/components/auth/google-login-gate";
import { loginWithGoogle, loginWithFacebook, loginWithEmail, getMotariState, apiError, apiErrorCode } from "@/lib/api";
import { getAndClearRedirect } from "@/lib/auth-redirect";
import { RegistrationWizard } from "@/components/auth/registration-wizard";
import { BadgeSubmissionWizard } from "@/components/auth/badge-submission-wizard";
import { AuthGate } from "@/components/auth/auth-gate";
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

export default function SignInPage() {
  const { t } = useLanguage();
  const { error: toastError } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"google" | "facebook" | "email" | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showBadgeWizard, setShowBadgeWizard] = useState(false);
  const [authResult, setAuthResult] = useState<any>(null);
  const [gateResult, setGateResult] = useState<any>(null);
  const fbReady = useRef(false);

  /* The resumed onboarding always uses the sliding full-page flow, so email and Google logins
     complete the same steps in the same way. */
  const [slideResume, setSlideResume] = useState(false);

  /* Post-authentication routing (shared by email + social + gate resolution). */
  const proceed = (result: any, slide = false) => {
    setSlideResume(slide);
    if (!result.user.onboardingCompleted) {
      setAuthResult(result);
      setShowWizard(true);
    } else if (result.user.role === "WORKER" && !result.user.badgeSubmitted) {
      setAuthResult(result);
      setShowBadgeWizard(true);
    } else {
      saveAndRedirect(result);
    }
  };

  /* ── Facebook SDK bootstrap (Disabled for v1) ────────────────────────── */
  /*
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
  }, []);
  */

  /**
   * Turn a sign-in failure into a clear, localized message plus the right next step.
   * Driven by the server's stable code, so it never depends on parsing English text.
   */
  const signInError = (e: unknown, fallback: string) => {
    const code = apiErrorCode(e);
    switch (code) {
      case "USE_GOOGLE_LOGIN":
        return {
          msg: t("signin.toasts.use_google_desc") || "This account signs in with Google, not a password. Please continue with Google.",
          action: undefined,
        };
      case "USE_FACEBOOK_LOGIN":
        return {
          msg: t("signin.toasts.use_facebook_desc") || "This account signs in with Facebook, not a password. Please continue with Facebook.",
          action: undefined,
        };
      case "USE_PASSWORD_LOGIN":
        return {
          msg: t("signin.toasts.use_password_desc") || "This email is registered with an email & password account. Please sign in with your email and password.",
          action: undefined,
        };
      case "NO_PASSWORD_SET":
        return {
          msg: t("signin.toasts.no_password_desc") || "This account doesn't have a password yet. Use 'Forgot password' to create one.",
          action: { label: t("signin.toasts.set_password_label"), href: "/forgot-password" },
        };
      case "NO_ACCOUNT_FOUND":
        return {
          msg: t("signin.toasts.no_account_desc") || "No account found for this Google account. Please sign up first.",
          action: { label: t("common.nav.signup") || "Sign up", href: "/signup" },
        };
      case "ACCOUNT_SUSPENDED":
        return { msg: t("signin.toasts.account_suspended_desc"), action: undefined };
      case "ACCOUNT_DEACTIVATED":
        return { msg: t("signin.toasts.account_deactivated_desc"), action: undefined };
      case "BAD_CREDENTIALS":
        return { msg: t("signin.toasts.invalid_creds_desc"), action: undefined };
      case "CREDENTIALS_EXPIRED":
        return { msg: t("signin.toasts.credentials_expired_desc"), action: undefined };
      case "AUTH_FAILED":
        return { msg: t("signin.toasts.auth_failed_desc"), action: undefined };
      default:
        return { msg: apiError(e, fallback), action: undefined };
    }
  };

  /* ── Google handler (button mounts only when a client id is configured) ── */
  const onGoogleSuccess = async ({ access_token }: { access_token: string }) => {
    setLoading("google");
    try {
      // Google resumes the SAME continuous slide onboarding as an email login (slide = true).
      proceed(await loginWithGoogle(access_token), true);
    } catch (e: unknown) {
      // Surface why Google was refused (e.g. it's a password account) instead of a generic failure.
      const { msg, action } = signInError(e, t("signin.toasts.google_fail_desc"));
      toastError(msg, { title: t("signin.toasts.login_failed_title"), action });
    } finally {
      setLoading(null);
    }
  };
  const onGoogleError = () =>
    toastError(t("signin.toasts.google_cancelled_desc"), { title: t("signin.toasts.login_failed_title") });

  /* ── Facebook handler (Disabled for v1) ─────────────────────────────── */
  /*
  const handleFacebook = () => {
    if (window.location.protocol !== "https:") {
      toastError(t("signin.toasts.fb_https_desc"), { title: t("signin.toasts.login_failed_title") });
      return;
    }
    if (!window.FB) {
      toastError(t("signin.toasts.fb_not_avail_desc"), { title: t("signin.toasts.login_failed_title") });
      return;
    }
    window.FB.login(
      (res) => {
        if (!res.authResponse?.accessToken) return;
        setLoading("facebook");
        loginWithFacebook(res.authResponse.accessToken)
          .then((result) => proceed(result))
          .catch(() => {
            toastError(t("signin.toasts.fb_fail_desc"), { title: t("signin.toasts.login_failed_title") });
          })
          .finally(() => {
            setLoading(null);
          });
      },
      { scope: "public_profile,email" }
    );
  };
  */

  /* ── Email / password handler ───────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!email || !password) {
      toastError(t("signin.toasts.email_pass_req_desc"), { title: t("signin.toasts.login_failed_title") });
      return;
    }
    setLoading("email");
    try {
      const result = await loginWithEmail({ email, password });
      if (result.requiresEmailVerification || result.requires2fa || result.requires2faSetup) {
        setGateResult(result);
      } else {
        proceed(result, true);
      }
    } catch (e: unknown) {
      const { msg, action } = signInError(e, t("signin.toasts.invalid_creds_desc"));
      toastError(msg, { title: t("signin.toasts.login_failed_title"), action });
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

        /* ── Ultra-small viewports: icon only, no label ─────────────────── */
        @media (max-width: 240px) {
          .auth-home-btn span { display: none; }
          .auth-home-btn { padding: 6px; }
        }

        /* ── Home button is mobile-only; hide once the carousel appears ── */
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
          padding: clamp(52px, 16vw, 76px) clamp(10px, 5vw, 24px) clamp(16px, 6vw, 40px);
          padding: calc(clamp(52px, 16vw, 76px) + env(safe-area-inset-top, 0px))
                   calc(clamp(10px, 5vw, 24px) + env(safe-area-inset-right, 0px))
                   calc(clamp(16px, 6vw, 40px) + env(safe-area-inset-bottom, 0px))
                   calc(clamp(10px, 5vw, 24px) + env(safe-area-inset-left, 0px));
        }

        @media (min-width: 860px) {
          .auth-right {
            align-items: center;
            padding: clamp(16px, 6vw, 40px) clamp(10px, 5vw, 24px);
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
          margin: 0 0 clamp(14px, 5vw, 28px);
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

        .auth-field-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 6px;
        }

        .auth-label {
          font-size: clamp(10px, 2.6vw, 12px);
          font-weight: 600;
          color: var(--auth-label);
        }

        .auth-forgot {
          font-size: clamp(9px, 2.4vw, 11px);
          color: var(--auth-orange);
          text-decoration: none;
          font-weight: 600;
          white-space: nowrap;
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

        .auth-signup {
          text-align: center;
          font-size: clamp(10px, 2.8vw, 13px);
          color: var(--auth-muted);
          margin-top: clamp(12px, 4vw, 20px);
        }

        .auth-signup a {
          color: var(--auth-orange);
          text-decoration: none;
          font-weight: 700;
        }

        /* ── Ultra-small viewports (smartwatches, ~130-240px) ───────────── */
        @media (max-width: 240px) {
          .auth-right { padding: 8px 6px; }
          .auth-subtitle { display: none; }
          .auth-label { margin-bottom: 3px; }
          .auth-field { margin-bottom: 6px; }
          .auth-social-group { margin-bottom: 8px; }
          .auth-divider { margin: 6px 0; }
          .auth-field-head { flex-direction: column; gap: 2px; }
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
        <a href="/" className="auth-home-btn" aria-label={t("signin.buttons.back_to_home")}>
          <ArrowLeft />
          <span>{t("signin.buttons.home")}</span>
        </a>

        {/* LEFT - Carousel */}
        <div className="auth-left">
          <AuthCarousel />
        </div>

        {/* RIGHT - Form */}
        <div className="auth-right">
          <div className="auth-card">

            <h1 className="auth-title">{t("signin.hero.welcome_back")}</h1>
            <p className="auth-subtitle">{t("signin.hero.subtitle")}</p>

            {/* Social */}
            <div className="auth-social-group">
              {GOOGLE_AUTH_ENABLED && (
                <GoogleLoginGate onSuccess={onGoogleSuccess} onError={onGoogleError}>
                  {(start) => (
                    <SocialBtn
                      icon={<GoogleIcon />}
                      label={loading === "google" ? t("signin.buttons.signing_in") : t("signin.buttons.continue_google")}
                      disabled={loading !== null}
                      onClick={start}
                    />
                  )}
                </GoogleLoginGate>
              )}
              {/* Facebook auth disabled in v1
              <SocialBtn
                icon={<FacebookIcon />}
                label={loading === "facebook" ? t("signin.buttons.signing_in") : t("signin.buttons.continue_facebook")}
                disabled={loading !== null}
                onClick={handleFacebook}
              />
              */}
            </div>

            <Divider />

            {/* Email */}
            <Field label={t("signin.fields.email_label")}>
              <InputRow icon={<Mail />}>
                <input
                  type="email" placeholder="you@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleSubmit(); }}
                  className="auth-input"
                />
              </InputRow>
            </Field>

            {/* Password */}
            <Field label={t("signin.fields.password_label")} extra={
              <a href="/forgot-password" className="auth-forgot">{t("signin.fields.forgot_password_link")}</a>
            }>
              <InputRow icon={<Lock />} suffix={
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#444", display: "flex" }}
                  aria-label={showPassword ? t("signin.fields.hide_password_aria") || "Hide password" : t("signin.fields.show_password_aria") || "Show password"}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              }>
                <input
                  type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleSubmit(); }}
                  className="auth-input"
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
              {loading === "email" ? t("signin.buttons.signing_in") : t("signin.buttons.submit")}
            </button>

            <p className="auth-signup">
              {t("signin.footer.no_account")}{" "}
              <a
                href="/signup"
                onClick={() => {
                  // Re-save so sessionStorage survives the page navigation
                  const existing = sessionStorage.getItem("auth_redirect");
                  if (!existing) saveRedirect();
                }}
              >{t("signin.footer.signup_link")}</a>
            </p>
          </div>
        </div>
      </div>
      {gateResult && (
        <AuthGate
          result={gateResult}
          email={email}
          password={password}
          onResolved={(final) => { setGateResult(null); proceed(final, true); }}
        />
      )}
      {showWizard && authResult && (
        <RegistrationWizard
          email={authResult.user.email}
          authResult={authResult}
          isLogin={true}
          slideMode={slideResume}
          onComplete={() => {
            if (authResult.user.role === "WORKER" && !authResult.user.badgeSubmitted) {
              setShowWizard(false);
              setShowBadgeWizard(true);
            } else {
              saveAndRedirect(authResult);
            }
          }}
        />
      )}
      {showBadgeWizard && authResult && (
        <BadgeSubmissionWizard
          authResult={authResult}
          onComplete={() => saveAndRedirect(authResult)}
        />
      )}
    </>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

type AuthResult = Awaited<ReturnType<typeof loginWithEmail>>;

async function saveAndRedirect(result: AuthResult) {
  localStorage.setItem("access_token", result.accessToken);
  localStorage.setItem("refresh_token", result.refreshToken);
  localStorage.setItem("user", JSON.stringify(result.user));
  const stored = getAndClearRedirect();
  let defaultDest = result.user.role === "EMPLOYER" ? "/owner" : "/seeker";
  // A worker whose account is a registered motari lands on the driver surface.
  if (result.user.role === "WORKER") {
    try {
      const s = await getMotariState(result.accessToken);
      if (s.profile) defaultDest = "/drive";
    } catch { /* backend hiccup: fall through to the normal dashboard */ }
  }
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
      <span className="auth-divider-text">{t("signin.general.or")}</span>
      <div className="auth-divider-line" />
    </div>
  );
}

function Field({
  label, extra, children,
}: {
  label: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-field">
      <div className="auth-field-head">
        <label className="auth-label">{label}</label>
        {extra}
      </div>
      {children}
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