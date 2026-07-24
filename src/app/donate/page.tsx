"use client";

import { useState } from "react";
import { GraduationCap, BookOpen, HeartHandshake, LifeBuoy, Users, HandCoins } from "lucide-react";
import Footer from "@/components/layout/footer";
import { DonationModal } from "@/components/donate/donation-modal";
import { useLanguage } from "@/lib/language-context";

const ACCENT = "#f97316";

/**
 * Public "why donate" page. Explains what contributions to MpahMapu go towards — schooling for
 * children, education for all, family and emergency support, and community societies — and opens
 * the same donation flow used elsewhere. Linked from the footer.
 */
export default function DonatePage() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const causes = [
    { icon: <GraduationCap size={22} />, t: t("donate_page.c_scholar_t"),   d: t("donate_page.c_scholar_d") },
    { icon: <BookOpen size={22} />,      t: t("donate_page.c_education_t"), d: t("donate_page.c_education_d") },
    { icon: <HeartHandshake size={22} />,t: t("donate_page.c_family_t"),    d: t("donate_page.c_family_d") },
    { icon: <LifeBuoy size={22} />,      t: t("donate_page.c_life_t"),      d: t("donate_page.c_life_d") },
    { icon: <Users size={22} />,         t: t("donate_page.c_society_t"),   d: t("donate_page.c_society_d") },
  ];

  return (
    <main style={{ background: "#111", minHeight: "100vh", color: "#f5f5f5", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 32px" }}>
        {/* Hero */}
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 52, height: 52, borderRadius: 14, marginBottom: 18,
          background: "rgba(249,115,22,0.14)", color: ACCENT,
        }}>
          <HandCoins size={26} />
        </div>
        <h1 style={{ fontSize: "clamp(26px, 6vw, 38px)", fontWeight: 900, margin: 0, lineHeight: 1.1 }}>
          {t("donate_page.title")}
        </h1>
        <p style={{ fontSize: 15, color: "#aaa", lineHeight: 1.6, margin: "14px 0 0", maxWidth: 620 }}>
          {t("donate_page.intro")}
        </p>

        <button
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: 22,
            background: ACCENT, color: "#fff", border: "none", borderRadius: 12,
            padding: "13px 22px", fontSize: 15, fontWeight: 800, cursor: "pointer",
          }}
        >
          <HandCoins size={18} /> {t("donate_page.cta")}
        </button>

        {/* Causes */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 14, margin: "40px 0 0",
        }}>
          {causes.map((c, i) => (
            <div key={i} style={{
              background: "#161616", border: "1px solid #232323", borderRadius: 14, padding: 18,
            }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 40, height: 40, borderRadius: 10, marginBottom: 12,
                background: "rgba(249,115,22,0.12)", color: ACCENT,
              }}>{c.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>{c.t}</div>
              <div style={{ fontSize: 13, color: "#9a9a9a", lineHeight: 1.55, marginTop: 6 }}>{c.d}</div>
            </div>
          ))}
        </div>

        {/* Reassurance + CTA */}
        <div style={{
          marginTop: 28, padding: 18, borderRadius: 14,
          border: "1px solid rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.06)",
        }}>
          <p style={{ fontSize: 13.5, color: "#cfcfcf", lineHeight: 1.6, margin: 0 }}>
            {t("donate_page.note")}
          </p>
          <button
            onClick={() => setOpen(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14,
              background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 10,
              padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            <HandCoins size={16} /> {t("donate_page.cta")}
          </button>
        </div>
      </div>

      <Footer />
      <DonationModal open={open} onClose={() => setOpen(false)} />
    </main>
  );
}
