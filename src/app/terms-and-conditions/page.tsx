    "use client";

import Footer from "@/components/layout/footer";
import { ArrowRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/json-ld";

const sections = [
  {
    id: "01",
    title: "Acceptance of terms",
    body: `By creating an account or using MpahMapu - whether as a worker or an employer - you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the platform. We may update these terms from time to time; continued use after any change means you accept the revised terms.`,
  },
  {
    id: "02",
    title: "Who can use MpahMapu",
    body: `You must be at least 18 years old and legally permitted to work or hire in Rwanda to create an account. Workers must complete ID verification before accepting jobs. Employers must provide accurate business or personal details when posting jobs. Accounts are non-transferable.`,
  },
  {
    id: "03",
    title: "Posting and accepting jobs",
    body: `Employers are responsible for the accuracy of every job post - including location, pay rate, category, and duration. Workers accept jobs based on that information; material misrepresentation may result in account suspension. Workers must complete accepted jobs or cancel with adequate notice. Repeated no-shows may result in removal from the platform.`,
  },
  {
    id: "04",
    title: "Payments via MoMo",
    body: `All payments are processed through MTN Mobile Money (MoMo). Employers are charged the agreed rate plus the MpahMapu service fee at the time of job confirmation. Funds are released to workers upon job completion. MpahMapu does not hold funds for longer than necessary and is not responsible for delays caused by MoMo's own processing times.`,
  },
  {
    id: "05",
    title: "Ratings and conduct",
    body: `Both workers and employers can be rated after each completed job. Ratings must reflect genuine experience. Fraudulent, retaliatory, or coerced reviews violate these terms and may be removed. All users are expected to communicate respectfully; harassment, discrimination, or abuse of any kind will result in permanent account removal.`,
  },
  {
    id: "06",
    title: "Disputes and refunds",
    body: `If a dispute arises - for example, a job was not completed as agreed - either party can raise a claim within 48 hours of the job end time. MpahMapu will review available evidence and make a binding decision. Refunds, where applicable, are processed back via MoMo within 3–5 business days.`,
  },
  {
    id: "07",
    title: "Prohibited uses",
    body: `You may not use MpahMapu to solicit workers off-platform to avoid fees, post illegal or hazardous work, collect personal data from other users without consent, or attempt to reverse-engineer, scrape, or interfere with the platform. Violations may result in immediate account termination and, where applicable, legal action.`,
  },
  {
    id: "08",
    title: "Limitation of liability",
    body: `MpahMapu is a marketplace and is not the employer or employee of any party. We do not guarantee the quality of work performed, the conduct of any user, or the availability of jobs. To the maximum extent permitted by Rwandan law, MpahMapu's liability for any claim is limited to the fees you paid to us in the 30 days preceding the event giving rise to the claim.`,
  },
  {
    id: "09",
    title: "Governing law",
    body: `These terms are governed by the laws of the Republic of Rwanda. Any disputes that cannot be resolved through MpahMapu's internal process will be subject to the exclusive jurisdiction of the courts of Rwanda.`,
  },
  {
    id: "10",
    title: "Contact",
    body: `Questions about these terms? Reach us at legal@MpahMapu.rw or through the contact form on our website. We aim to respond within 2 business days.`,
  },
];

export default function TermsPage() {
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
        { name: "Home", url: "https://mpahmapu.com" },
        { name: "Terms and Conditions", url: "https://mpahmapu.com/terms-and-conditions" },
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
            Legal
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
            Terms &amp;{" "}
            <span style={{ color: "#f97316" }}>Conditions</span>
          </h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.75, maxWidth: 480, margin: "0 0 12px" }}>
            These terms govern your use of MpahMapu as a worker or employer.
            Please read them carefully before creating an account.
          </p>
          <p style={{ fontSize: 12, color: "#444", margin: 0 }}>
            Last updated: <span style={{ color: "#555" }}>1 June 2025</span>
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
          <strong style={{ color: "#f97316", fontWeight: 700 }}>Quick summary: </strong>
          MpahMapu connects workers and employers in Rwanda. You own your work
          and your earnings. We handle trust, verification, and MoMo payments.
          Be honest, be respectful, show up on time.
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
            Ready to get started?
          </h2>
          <p style={{ margin: "0 0 22px", fontSize: 13, color: "#666" }}>
            By creating an account you agree to these terms.
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
              Create account <ArrowRight size={13} />
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
              Privacy policy
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}