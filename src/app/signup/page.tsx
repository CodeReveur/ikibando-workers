"use client";

import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, Phone } from "lucide-react";
import { AuthCarousel } from "@/components/auth/auth-carousel";

type Role = "worker" | "employer";

export default function SignUpPage() {
  const [role, setRole] = useState<Role>("worker");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

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
          <div style={{ width: "100%", maxWidth: 380 , marginTop: 240 }}>

            <style>{`.auth-mobile-logo { display: block; } @media (min-width: 860px) { .auth-mobile-logo { display: none; } }`}</style>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
              Create an account
            </h1>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 22px" }}>
              Join Rwanda&apos;s trusted workforce platform
            </p>

            {/* Role toggle */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              background: "#141414", border: "1px solid #272727",
              borderRadius: 12, padding: 4, marginBottom: 22,
            }}>
              {(["worker", "employer"] as Role[]).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)} style={{
                  background: role === r ? "#f97316" : "transparent",
                  color: role === r ? "#fff" : "#555",
                  border: "none", borderRadius: 9, padding: "9px",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  transition: "background 0.15s, color 0.15s",
                }}>
                  {r === "worker" ? "Find Work" : "Hire Workers"}
                </button>
              ))}
            </div>

            {/* Social */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              <SocialBtn icon={<GoogleIcon />} label="Continue with Google" />
              <SocialBtn icon={<FacebookIcon />} label="Continue with Facebook" />
            </div>

            <Divider />

            {/* Full name */}
            <Field label="Full name">
              <InputRow icon={<User size={14} color="#444" />}>
                <input type="text" placeholder="Jean Pierre Mugisha" value={form.name}
                  onChange={set("name")} style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
              </InputRow>
            </Field>

            {/* Email */}
            <Field label="Email">
              <InputRow icon={<Mail size={14} color="#444" />}>
                <input type="email" placeholder="you@example.com" value={form.email}
                  onChange={set("email")} style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
              </InputRow>
            </Field>

            {/* Phone */}
            <Field label="Phone (MoMo)">
              <InputRow icon={<Phone size={14} color="#444" />}>
                <input type="tel" placeholder="+250 7XX XXX XXX" value={form.phone}
                  onChange={set("phone")} style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
              </InputRow>
            </Field>

            {/* Password */}
            <Field label="Password">
              <InputRow icon={<Lock size={14} color="#444" />} suffix={
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#444", display: "flex" }}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }>
                <input type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" value={form.password}
                  onChange={set("password")} style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
              </InputRow>
            </Field>

            <button type="submit" style={submitStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#ea6a0a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f97316")}
            >
              Create account
            </button>

            <p style={{ fontSize: 11, color: "#444", textAlign: "center", margin: "14px 0 0", lineHeight: 1.6 }}>
              By signing up you agree to our{" "}
              <a href="#" style={{ color: "#666", textDecoration: "underline" }}>Terms</a> &amp;{" "}
              <a href="#" style={{ color: "#666", textDecoration: "underline" }}>Privacy Policy</a>.
            </p>

            <p style={{ textAlign: "center", fontSize: 13, color: "#555", marginTop: 18 }}>
              Already have an account?{" "}
              <a href="/signin" style={{ color: "#f97316", textDecoration: "none", fontWeight: 700 }}>Sign in</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── shared sub-components ── */

function SocialBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button type="button" style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
      borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 600,
      color: "#d0d0d0", cursor: "pointer",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f97316")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#aaa", display: "block", marginBottom: 6 }}>{label}</label>
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
