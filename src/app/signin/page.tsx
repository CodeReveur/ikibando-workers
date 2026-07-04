"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { AuthCarousel } from "@/components/auth/auth-carousel";
import { saveRedirect } from "@/lib/auth-redirect";
import { useGoogleLogin } from "@react-oauth/google";
import { loginWithGoogle, loginWithFacebook, loginWithEmail } from "@/lib/api";
import { getAndClearRedirect } from "@/lib/auth-redirect";
import { RegistrationWizard } from "@/components/auth/registration-wizard";
import { BadgeSubmissionWizard } from "@/components/auth/badge-submission-wizard";
import { AuthGate } from "@/components/auth/auth-gate";
import { useToast } from "@/components/ui/toast";

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

  /* Post-authentication routing (shared by email + social + gate resolution). */
  const proceed = (result: any) => {
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
  }, []);

  /* ── Google handler ─────────────────────────────────────────────────── */
  const handleGoogle = useGoogleLogin({
    onSuccess: async ({ access_token }) => {
      setLoading("google");
      try {
        proceed(await loginWithGoogle(access_token));
      } catch {
        toastError("Google sign-in failed. Please try again.", { title: "Login Failed" });
      } finally {
        setLoading(null);
      }
    },
    onError: () => toastError("Google sign-in was cancelled or failed.", { title: "Login Failed" }),
  });

  /* ── Facebook handler ───────────────────────────────────────────────── */
  const handleFacebook = () => {
    if (window.location.protocol !== "https:") {
      toastError("Facebook sign-in requires HTTPS. Use email or Google during local development.", { title: "Login Failed" });
      return;
    }
    if (!window.FB) {
      toastError("Facebook sign-in is not available (App ID not configured).", { title: "Login Failed" });
      return;
    }
    window.FB.login(
      (res) => {
        if (!res.authResponse?.accessToken) return;
        setLoading("facebook");
        loginWithFacebook(res.authResponse.accessToken)
          .then((result) => proceed(result))
          .catch(() => {
            toastError("Facebook sign-in failed. Please try again.", { title: "Login Failed" });
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
    if (!email || !password) {
      toastError("Please enter your email and password.", { title: "Login Failed" });
      return;
    }
    setLoading("email");
    try {
      const result = await loginWithEmail({ email, password });
      if (result.requiresEmailVerification || result.requires2fa || result.requires2faSetup) {
        setGateResult(result);
      } else {
        proceed(result);
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Invalid email or password.";
      const isSocial = msg.includes("Google or Facebook");
      toastError(msg, {
        title: "Login Failed",
        action: isSocial ? { label: "Set a password via Forgot Password", href: "/forgot-password" } : undefined,
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <style>{`
        .auth-left { display: none; }
        @media (min-width: 860px) { .auth-left { display: block; } }
        input::placeholder { color: #444; }
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

            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 28px" }}>
              Sign in to your MpahMapu account
            </p>

            {/* Social */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              <SocialBtn
                icon={<GoogleIcon />}
                label={loading === "google" ? "Signing in…" : "Continue with Google"}
                disabled={loading !== null}
                onClick={() => handleGoogle()}
              />
              <SocialBtn
                icon={<FacebookIcon />}
                label={loading === "facebook" ? "Signing in…" : "Continue with Facebook"}
                disabled={loading !== null}
                onClick={handleFacebook}
              />
            </div>

            <Divider />

            {/* Email */}
            <Field label="Email">
              <InputRow icon={<Mail size={14} color="#444" />}>
                <input
                  type="email" placeholder="you@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
              </InputRow>
            </Field>

            {/* Password */}
            <Field label="Password" extra={
              <a href="/forgot-password" style={{ fontSize: 11, color: "#f97316", textDecoration: "none", fontWeight: 600 }}>
                Forgot?
              </a>
            }>
              <InputRow icon={<Lock size={14} color="#444" />} suffix={
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#444", display: "flex" }}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }>
                <input
                  type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
              </InputRow>
            </Field>

            <button
              type="button"
              disabled={loading === "email"}
              onClick={handleSubmit}
              style={{ ...submitStyle, opacity: loading === "email" ? 0.7 : 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#ea6a0a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f97316")}
            >
              {loading === "email" ? "Signing in…" : "Sign in"}
            </button>

            <p style={{ textAlign: "center", fontSize: 13, color: "#555", marginTop: 20 }}>
              Don&apos;t have an account?{" "}
              <a
                href="/signup"
                style={{ color: "#f97316", textDecoration: "none", fontWeight: 700 }}
                onClick={() => {
                  // Re-save so sessionStorage survives the page navigation
                  const existing = sessionStorage.getItem("auth_redirect");
                  if (!existing) saveRedirect();
                }}
              >Sign up</a>
            </p>
          </div>
        </div>
      </div>
      {gateResult && (
        <AuthGate
          result={gateResult}
          email={email}
          password={password}
          onResolved={(final) => { setGateResult(null); proceed(final); }}
        />
      )}
      {showWizard && authResult && (
        <RegistrationWizard
          email={authResult.user.email}
          authResult={authResult}
          isLogin={true}
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
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
        borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 600,
        color: disabled ? "#555" : "#d0d0d0", cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = "#f97316"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; }}
    >
      {icon}{label}
    </button>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
      <span style={{ fontSize: 11, color: "#444", fontWeight: 600 }}>OR</span>
      <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
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
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#aaa" }}>{label}</label>
        {extra}
      </div>
      {children}
    </div>
  );
}

function InputRow({ icon, suffix, children }: { icon: React.ReactNode; suffix?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <span style={{ position: "absolute", left: 13, pointerEvents: "none", display: "flex" }}>{icon}</span>
      {children}
      {suffix && <span style={{ position: "absolute", right: 13, display: "flex" }}>{suffix}</span>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#141414", border: "1px solid #2a2a2a",
  borderRadius: 10, padding: "11px 36px 11px 36px",
  fontSize: 13, color: "#f0f0f0", outline: "none", boxSizing: "border-box",
};

const submitStyle: React.CSSProperties = {
  width: "100%", background: "#f97316", color: "#fff", border: "none",
  borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700,
  cursor: "pointer", marginTop: 8,
};

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginRight: 2 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2" style={{ marginRight: 2 }}>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}
