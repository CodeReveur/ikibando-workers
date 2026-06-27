"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, Phone } from "lucide-react";
import { AuthCarousel } from "@/components/auth/auth-carousel";
import { saveRedirect } from "@/lib/auth-redirect";
import { useGoogleLogin } from "@react-oauth/google";
import { loginWithGoogle, loginWithFacebook, registerWithEmail } from "@/lib/api";
import { getAndClearRedirect } from "@/lib/auth-redirect";
import { RegistrationWizard } from "@/components/auth/registration-wizard";
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

export default function SignUpPage() {
  const { error: toastError } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState<"google" | "facebook" | "email" | null>(null);
  const [fieldErrors, setFieldErrors] = useState({ name: "", email: "", phone: "", password: "" });
  const [showWizard, setShowWizard] = useState(false);
  const [authResult, setAuthResult] = useState<any>(null);
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const fbReady = useRef(false);

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
    if (field === "name" && !form.name.trim()) err = "Name is required.";
    if (field === "email") {
      if (!form.email) err = "Email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err = "Please enter a valid email address.";
    }
    if (field === "phone") {
      if (!form.phone) err = "Phone number is required.";
      else if (!/^\+\d{1,4}\s?\d{6,14}$/.test(form.phone.replace(/[\s-]/g, ""))) err = "Invalid phone number format.";
    }
    if (field === "password") {
      if (!form.password) err = "Password is required.";
      else if (form.password.length < 8) err = "Password must be at least 8 characters.";
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
        toastError("Google sign-up failed. Please try again.", { title: "Sign Up Failed" });
      } finally {
        setLoading(null);
      }
    },
    onError: () => toastError("Google sign-up was cancelled or failed.", { title: "Sign Up Failed" }),
  });

  /* ── Facebook handler ───────────────────────────────────────────────── */
  const handleFacebook = () => {
    if (window.location.protocol !== "https:") {
      toastError("Facebook sign-up requires HTTPS. Use email or Google during local development.", { title: "Sign Up Failed" });
      return;
    }
    if (!window.FB) {
      toastError("Facebook sign-in is not available (App ID not configured).", { title: "Sign Up Failed" });
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
            toastError("Facebook sign-up failed. Please try again.", { title: "Sign Up Failed" });
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

    if (!form.name.trim()) { newErrors.name = "Name is required."; hasError = true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { newErrors.email = "Please enter a valid email address."; hasError = true; }
    if (!/^\+\d{1,4}\s?\d{6,14}$/.test(form.phone.replace(/[\s-]/g, ""))) { newErrors.phone = "Invalid phone number format."; hasError = true; }
    if (form.password.length < 8) { newErrors.password = "Password must be at least 8 characters."; hasError = true; }

    setFieldErrors(newErrors);
    if (hasError) {
      toastError("Please fill in all required fields correctly.", { title: "Sign Up Failed" });
      return;
    }

    setLoading("email");
    try {
      const result = await registerWithEmail({ ...form, role: "WORKER" });
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
        "Registration failed. Please try again.";
      toastError(msg, { title: "Sign Up Failed" });
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
        {/* LEFT */}
        <div className="auth-left" style={{ flex: "0 0 48%", borderRight: "1px solid #1e1e1e" }}>
          <AuthCarousel />
        </div>

        {/* RIGHT */}
        <div style={{
          flex: 1, overflowY: "auto",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: "60px 24px 40px",
        }}>
          <div style={{ width: "100%", maxWidth: 380 }}>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
              Create an account
            </h1>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 22px" }}>
              Join Rwanda&apos;s trusted workforce platform
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

            <Field label="Full name" error={fieldErrors.name}>
              <InputRow icon={<User size={14} color="#444" />}>
                <input type="text" placeholder="Jean Pierre Mugisha" value={form.name}
                  onChange={set("name")} style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; handleBlur("name"); }}
                />
              </InputRow>
            </Field>

            <Field label="Email" error={fieldErrors.email}>
              <InputRow icon={<Mail size={14} color="#444" />}>
                <input type="email" placeholder="you@example.com" value={form.email}
                  onChange={set("email")} style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; handleBlur("email"); }}
                />
              </InputRow>
            </Field>

            <Field label="Phone (MoMo)" error={fieldErrors.phone}>
              <InputRow icon={<Phone size={14} color="#444" />}>
                <input type="tel" placeholder="+250 7XX XXX XXX" value={form.phone}
                  onChange={handlePhoneChange} style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; handleBlur("phone"); }}
                />
              </InputRow>
            </Field>

            <Field label="Password" error={fieldErrors.password}>
              <InputRow icon={<Lock size={14} color="#444" />} suffix={
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#444", display: "flex" }}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }>
                <input type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" value={form.password}
                  onChange={set("password")} style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; handleBlur("password"); }}
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
              {loading === "email" ? "Creating account…" : "Create account"}
            </button>

            <p style={{ fontSize: 11, color: "#444", textAlign: "center", margin: "14px 0 0", lineHeight: 1.6 }}>
              By signing up you agree to our{" "}
              <a href="#" style={{ color: "#666", textDecoration: "underline" }}>Terms</a> &amp;{" "}
              <a href="#" style={{ color: "#666", textDecoration: "underline" }}>Privacy Policy</a>.
            </p>

            <p style={{ textAlign: "center", fontSize: 13, color: "#555", marginTop: 18 }}>
              Already have an account?{" "}
              <a
                href="/signin"
                style={{ color: "#f97316", textDecoration: "none", fontWeight: 700 }}
                onClick={() => {
                  const existing = sessionStorage.getItem("auth_redirect");
                  if (!existing) saveRedirect();
                }}
              >Sign in</a>
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#aaa", display: "block", marginBottom: 6 }}>{label}</label>
      {children}
      {error && <div style={{ color: "#f87171", fontSize: 11, marginTop: 6 }}>{error}</div>}
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
