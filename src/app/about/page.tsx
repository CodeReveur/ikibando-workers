"use client";

import Footer from "@/components/layout/footer";
import { Users, Shield, Zap, Heart, MapPin, ArrowRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/json-ld";
import { useLanguage } from "@/lib/language-context";

export default function AboutPage() {
  const { t } = useLanguage();

  const stats = [
    { value: t("about.stats.workers_val"), label: t("about.stats.workers_lbl") },
    { value: t("about.stats.jobs_val"), label: t("about.stats.jobs_lbl")   },
    { value: t("about.stats.categories_val"), label: t("about.stats.categories_lbl")   },
    { value: t("about.stats.rating_val"), label: t("about.stats.rating_lbl")   },
  ];

  const values = [
    {
      Icon: Shield,
      title: t("about.values.val1_title"),
      body: t("about.values.val1_body"),
    },
    {
      Icon: Zap,
      title: t("about.values.val2_title"),
      body: t("about.values.val2_body"),
    },
    {
      Icon: Heart,
      title: t("about.values.val3_title"),
      body: t("about.values.val3_body"),
    },
    {
      Icon: Users,
      title: t("about.values.val4_title"),
      body: t("about.values.val4_body"),
    },
  ];

  const steps = [
    { n: "01", title: t("about.how_it_works.step1_title"), body: t("about.how_it_works.step1_body") },
    { n: "02", title: t("about.how_it_works.step2_title"), body: t("about.how_it_works.step2_body") },
    { n: "03", title: t("about.how_it_works.step3_title"), body: t("about.how_it_works.step3_body") },
    { n: "04", title: t("about.how_it_works.step4_title"), body: t("about.how_it_works.step4_body") },
  ];

  return (
    <main style={{
      background: "#111", minHeight: "100vh", color: "#f5f5f5",
      fontFamily: "Inter, DM Sans, system-ui, sans-serif",
    }}>
      <BreadcrumbSchema items={[
        { name: "Home", url: "https://mpahmapu.com" },
        { name: "About", url: "https://mpahmapu.com/about" },
      ]} />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 64px" }}>

        {/* HERO */}
        <div style={{ marginBottom: 56 }}>
          <span style={{
            display: "inline-block", background: "rgba(249,115,22,0.1)", color: "#f97316",
            borderRadius: 999, padding: "4px 14px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18,
          }}>
            {t("about.hero.tag")}
          </span>
          <h1 style={{
            fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 900, color: "#fff",
            lineHeight: 1.05, letterSpacing: "-1.5px", margin: "0 0 18px",
          }}>
            {t("about.hero.title_main")}<br />
            <span style={{ color: "#f97316" }}>{t("about.hero.title_accent")}</span>
          </h1>
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.75, maxWidth: 500, margin: 0 }}>
            {t("about.hero.desc")}
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
            {t("about.story.title")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.8, margin: 0 }}>
              {t("about.story.p1")}
            </p>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.8, margin: 0 }}>
              {t("about.story.p2").split("MpahMapu")[0]}
              <em style={{ color: "#aaa" }}>MpahMapu</em>
              {t("about.story.p2").split("MpahMapu")[1]}
            </p>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", margin: "0 0 20px" }}>
            {t("about.how_it_works.title")}
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
            {t("about.values.title")}
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
            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#f0f0f0" }}>{t("about.location.title")}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#555" }}>{t("about.location.desc")}</p>
          </div>
        </div>

        {/* CTA */}
        <div style={{
          background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
          borderRadius: 18, padding: "32px 28px", textAlign: "center",
        }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>
            {t("about.cta.title")}
          </h2>
          <p style={{ margin: "0 0 22px", fontSize: 13, color: "#666" }}>
            {t("about.cta.desc")}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/signup" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#f97316", color: "#fff", borderRadius: 999,
              padding: "11px 22px", fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>
              {t("about.cta.btn_create")} <ArrowRight size={13} />
            </a>
            <a href="/contact" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", color: "#aaa", borderRadius: 999,
              padding: "11px 22px", fontSize: 13, fontWeight: 600, textDecoration: "none",
              border: "1px solid #2a2a2a",
            }}>
              {t("about.cta.btn_contact")}
            </a>
          </div>
        </div>

      </div>
      <Footer />
    </main>
  );
}
