"use client";

import Footer from "@/components/layout/footer";
import { ArrowRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/json-ld";
import { useLanguage } from "@/lib/language-context";

export default function TermsPage() {
  const { t } = useLanguage();

  const sections = [
    {
      id: "01",
      title: t("terms.sections.sec1.title") || "Acceptance of terms",
      body: t("terms.sections.sec1.body") || `By creating an account or using MpahMapu - whether as a worker or an employer - you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the platform. We may update these terms from time to time; continued use after any change means you accept the revised terms.`,
    },
    {
      id: "02",
      title: t("terms.sections.sec2.title") || "Who can use MpahMapu",
      body: t("terms.sections.sec2.body") || `You must be at least 18 years old and legally permitted to work or hire in Rwanda to create an account. Workers must complete ID verification before accepting jobs. Employers must provide accurate business or personal details when posting jobs. Accounts are non-transferable.`,
    },
    {
      id: "03",
      title: t("terms.sections.sec3.title") || "Posting and accepting jobs",
      body: t("terms.sections.sec3.body") || `Employers are responsible for the accuracy of every job post - including location, pay rate, category, and duration. Workers accept jobs based on that information; material misrepresentation may result in account suspension. Workers must complete accepted jobs or cancel with adequate notice. Repeated no-shows may result in removal from the platform.`,
    },
    {
      id: "04",
      title: t("terms.sections.sec4.title") || "Payments via MoMo",
      body: t("terms.sections.sec4.body") || `All payments are processed through MTN Mobile Money (MoMo). Employers are charged the agreed rate plus the MpahMapu service fee at the time of job confirmation. Funds are released to workers upon job completion. MpahMapu does not hold funds for longer than necessary and is not responsible for delays caused by MoMo's own processing times.`,
    },
    {
      id: "05",
      title: t("terms.sections.sec5.title") || "Ratings and conduct",
      body: t("terms.sections.sec5.body") || `Both workers and employers can be rated after each completed job. Ratings must reflect genuine experience. Fraudulent, retaliatory, or coerced reviews violate these terms and may be removed. All users are expected to communicate respectfully; harassment, discrimination, or abuse of any kind will result in permanent account removal.`,
    },
    {
      id: "06",
      title: t("terms.sections.sec6.title") || "Disputes and refunds",
      body: t("terms.sections.sec6.body") || `If a dispute arises - for example, a job was not completed as agreed - either party can raise a claim within 48 hours of the job end time. MpahMapu will review available evidence and make a binding decision. Refunds, where applicable, are processed back via MoMo within 3–5 business days.`,
    },
    {
      id: "07",
      title: t("terms.sections.sec7.title") || "Prohibited uses",
      body: t("terms.sections.sec7.body") || `You may not use MpahMapu to solicit workers off-platform to avoid fees, post illegal or hazardous work, collect personal data from other users without consent, or attempt to reverse-engineer, scrape, or interfere with the platform. Violations may result in immediate account termination and, where applicable, legal action.`,
    },
    {
      id: "08",
      title: t("terms.sections.sec8.title") || "Limitation of liability",
      body: t("terms.sections.sec8.body") || `MpahMapu is a marketplace and is not the employer or employee of any party. We do not guarantee the quality of work performed, the conduct of any user, or the availability of jobs. To the maximum extent permitted by Rwandan law, MpahMapu's liability for any claim is limited to the fees you paid to us in the 30 days preceding the event giving rise to the claim.`,
    },
    {
      id: "09",
      title: t("terms.sections.sec9.title") || "Governing law",
      body: t("terms.sections.sec9.body") || `These terms are governed by the laws of the Republic of Rwanda. Any disputes that cannot be resolved through MpahMapu's internal process will be subject to the exclusive jurisdiction of the courts of Rwanda.`,
    },
    {
      id: "10",
      title: t("terms.sections.sec10.title") || "Contact",
      body: t("terms.sections.sec10.body") || `Questions about these terms? Reach us at legal@MpahMapu.rw or through the contact form on our website. We aim to respond within 2 business days.`,
    },
  ];
  return (
    <main
      style={{
        background: "#111",
        minHeight: "100vh",
        color: "#f5f5f5",
        fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}
    >
      <BreadcrumbSchema items={[
        { name: t("common.nav.home") || "Home", url: "https://mpahmapu.com" },
        { name: (t("terms.hero.title_main") || "Terms &") + " " + (t("terms.hero.title_accent") || "Conditions"), url: "https://mpahmapu.com/terms-and-conditions" },
      ]} />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 64px" }}>

        {/* HERO */}
        <div style={{ marginBottom: 48 }}>
          <span
            style={{
              display: "inline-block",
              background: "rgba(249,115,22,0.1)",
              color: "#f97316",
              borderRadius: 999,
              padding: "4px 14px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            {t("terms.hero.tag")}
          </span>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 42px)",
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.08,
              letterSpacing: "-1.2px",
              margin: "0 0 16px",
            }}
          >
            {t("terms.hero.title_main")}{" "}
            <span style={{ color: "#f97316" }}>{t("terms.hero.title_accent")}</span>
          </h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.75, maxWidth: 480, margin: "0 0 12px" }}>
            {t("terms.hero.desc")}
          </p>
          <p style={{ fontSize: 12, color: "#444", margin: 0 }}>
            {t("terms.hero.last_updated_prefix")}{" "}
            <span style={{ color: "#555" }}>{t("terms.hero.last_updated_date")}</span>
          </p>
        </div>

        {/* INTRO CARD */}
        <div
          style={{
            background: "rgba(249,115,22,0.06)",
            border: "1px solid rgba(249,115,22,0.15)",
            borderRadius: 14,
            padding: "18px 20px",
            marginBottom: 48,
            fontSize: 13,
            color: "#888",
            lineHeight: 1.75,
          }}
        >
          <strong style={{ color: "#f97316", fontWeight: 700 }}>
            {t("terms.intro.summary_prefix")}
          </strong>
          {t("terms.intro.summary_body")}
        </div>

        {/* SECTIONS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sections.map(({ id, title, body }, i) => (
            <div
              key={id}
              style={{ display: "flex", gap: 20, position: "relative" }}
            >
              {/* vertical connector */}
              {i < sections.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: 19,
                    top: 40,
                    bottom: -2,
                    width: 1,
                    background: "#1e1e1e",
                  }}
                />
              )}
              {/* step badge */}
              <div
                style={{
                  flexShrink: 0,
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  background: "rgba(249,115,22,0.08)",
                  border: "1px solid rgba(249,115,22,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#f97316",
                  letterSpacing: "0.04em",
                }}
              >
                {id}
              </div>
              <div style={{ paddingBottom: 32 }}>
                <p
                  style={{
                    margin: "8px 0 6px",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#f0f0f0",
                  }}
                >
                  {title}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#555",
                    lineHeight: 1.8,
                  }}
                >
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* DIVIDER */}
        <div
          style={{ borderTop: "1px solid #1e1e1e", margin: "48px 0 40px" }}
        />

        {/* CTA */}
        <div
          style={{
            background: "rgba(249,115,22,0.06)",
            border: "1px solid rgba(249,115,22,0.15)",
            borderRadius: 18,
            padding: "32px 28px",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 20,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.4px",
            }}
          >
            {t("terms.cta.title")}
          </h2>
          <p style={{ margin: "0 0 22px", fontSize: 13, color: "#666" }}>
            {t("terms.cta.desc")}
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              href="/signup"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#f97316",
                color: "#fff",
                borderRadius: 999,
                padding: "11px 22px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {t("terms.cta.btn_signup")} <ArrowRight size={13} />
            </a>
            <a
              href="/privacy-policy"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                color: "#aaa",
                borderRadius: 999,
                padding: "11px 22px",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid #2a2a2a",
              }}
            >
              {t("terms.cta.btn_privacy")}
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}