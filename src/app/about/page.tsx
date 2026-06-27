"use client";


import Footer from "@/components/layout/footer";
import { Users, Shield, Zap, Heart, MapPin, ArrowRight } from "lucide-react";

const stats = [
  { value: "2,400+", label: "Verified workers" },
  { value: "8,900+", label: "Jobs completed"   },
  { value: "15+",    label: "Job categories"   },
  { value: "4.8★",   label: "Average rating"   },
];

const values = [
  {
    Icon: Shield,
    title: "Trust first",
    body: "Every worker is ID-verified before they can accept jobs. Employers know exactly who is showing up.",
  },
  {
    Icon: Zap,
    title: "Speed matters",
    body: "Post a job in under 2 minutes. Workers get notified instantly and can confirm in one tap.",
  },
  {
    Icon: Heart,
    title: "Fair pay",
    body: "We display clear rates upfront. No hidden fees, no cash disputes - payments go through MoMo.",
  },
  {
    Icon: Users,
    title: "Community",
    body: "Built in Kigali, for Rwandans. We believe every worker deserves dignity and every employer deserves reliability.",
  },
];

const steps = [
  { n: "01", title: "Create an account",    body: "Sign up as a worker or employer in under a minute." },
  { n: "02", title: "Post or browse",        body: "Employers post jobs; workers browse and apply instantly." },
  { n: "03", title: "Get matched fast",      body: "We surface the best-fit workers based on category and location." },
  { n: "04", title: "Pay via MoMo",          body: "Secure mobile-money payments - no cash, no disputes." },
];

export default function AboutPage() {
  return (
    <main style={{
      background: "#111", minHeight: "100vh", color: "#f5f5f5",
      fontFamily: "Inter, DM Sans, system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 64px" }}>

        {/* HERO */}
        <div style={{ marginBottom: 56 }}>
          <span style={{
            display: "inline-block", background: "rgba(249,115,22,0.1)", color: "#f97316",
            borderRadius: 999, padding: "4px 14px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18,
          }}>
            About MpahMapu
          </span>
          <h1 style={{
            fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 900, color: "#fff",
            lineHeight: 1.05, letterSpacing: "-1.5px", margin: "0 0 18px",
          }}>
            Rwanda&apos;s on-demand<br />
            <span style={{ color: "#f97316" }}>workforce platform.</span>
          </h1>
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.75, maxWidth: 500, margin: 0 }}>
            MpahMapu connects employers with ID-verified, rated workers across Rwanda -
            for events, cleaning, security, driving and more. Hired in minutes, paid via MoMo.
          </p>
        </div>

        {/* STATS */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10, marginBottom: 56,
        }}>
          {stats.map(({ value, label }) => (
            <div key={label} style={{
              background: "#1c1c1c", border: "1px solid #272727",
              borderRadius: 14, padding: "22px 20px",
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 900, color: "#f97316", letterSpacing: "-1px" }}>{value}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#555", fontWeight: 600 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* OUR STORY */}
        <div style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", margin: "0 0 16px" }}>
            Our story
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.8, margin: 0 }}>
              MpahMapu was founded in Rwanda in 2025 after watching skilled workers struggle to find consistent work
              and employers scramble to find reliable help on short notice. The solution was simple: a platform that
              makes both sides fast, transparent, and safe.
            </p>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.8, margin: 0 }}>
              The name <em style={{ color: "#aaa" }}>MpahMapu</em> means &ldquo;a group that comes together to work&rdquo; in Kinyarwanda -
              which is exactly what we&apos;re building. A community where every job is done with pride and every worker
              is treated with respect.
            </p>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", margin: "0 0 20px" }}>
            How it works
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {steps.map(({ n, title, body }, i) => (
              <div key={n} style={{ display: "flex", gap: 20, position: "relative" }}>
                {/* line */}
                {i < steps.length - 1 && (
                  <div style={{
                    position: "absolute", left: 19, top: 40, bottom: -2,
                    width: 1, background: "#1e1e1e",
                  }} />
                )}
                <div style={{
                  flexShrink: 0, width: 38, height: 38, borderRadius: 999,
                  background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#f97316",
                }}>
                  {n}
                </div>
                <div style={{ paddingBottom: 28 }}>
                  <p style={{ margin: "8px 0 4px", fontSize: 14, fontWeight: 700, color: "#f0f0f0" }}>{title}</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.7 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VALUES */}
        <div style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", margin: "0 0 20px" }}>
            What we stand for
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
          }}>
            {values.map(({ Icon, title, body }) => (
              <div key={title} style={{
                background: "#1c1c1c", border: "1px solid #272727",
                borderRadius: 14, padding: "20px",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
                }}>
                  <Icon size={18} color="#f97316" strokeWidth={1.75} />
                </div>
                <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#f0f0f0" }}>{title}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#555", lineHeight: 1.7 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* LOCATION */}
        <div style={{
          background: "#1c1c1c", border: "1px solid #272727",
          borderRadius: 16, padding: "24px 24px",
          display: "flex", alignItems: "center", gap: 16, marginBottom: 56,
        }}>
          <div style={{
            flexShrink: 0, width: 44, height: 44, borderRadius: 12,
            background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MapPin size={20} color="#f97316" />
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#f0f0f0" }}>Based in Rwanda, Rwanda</p>
            <p style={{ margin: 0, fontSize: 12, color: "#555" }}>Currently serving Rwanda districts - expanding across East Africa soon.</p>
          </div>
        </div>

        {/* CTA */}
        <div style={{
          background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
          borderRadius: 18, padding: "32px 28px", textAlign: "center",
        }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>
            Ready to get started?
          </h2>
          <p style={{ margin: "0 0 22px", fontSize: 13, color: "#666" }}>
            Join thousands of workers and employers already on MpahMapu.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/signup" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#f97316", color: "#fff", borderRadius: 999,
              padding: "11px 22px", fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>
              Create account <ArrowRight size={13} />
            </a>
            <a href="/contact" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", color: "#aaa", borderRadius: 999,
              padding: "11px 22px", fontSize: 13, fontWeight: 600, textDecoration: "none",
              border: "1px solid #2a2a2a",
            }}>
              Contact us
            </a>
          </div>
        </div>

      </div>
      <Footer />
    </main>
  );
}
