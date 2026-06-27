"use client";

import Footer from "@/components/layout/footer";
import { Eye, Lock, Share2, Trash2, Mail, ArrowRight } from "lucide-react";

const highlights = [
  {
    Icon: Eye,
    title: "What we collect",
    body: "Name, phone number, ID document, location, and job history - only what's needed to run the platform.",
  },
  {
    Icon: Lock,
    title: "How we protect it",
    body: "Data is encrypted in transit and at rest. ID documents are stored on isolated, access-controlled servers.",
  },
  {
    Icon: Share2,
    title: "Who we share with",
    body: "Only the other party in a confirmed job booking, and MoMo for payment processing. Never sold to advertisers.",
  },
  {
    Icon: Trash2,
    title: "Your right to delete",
    body: "Request account deletion at any time. We remove your personal data within 30 days, except where law requires otherwise.",
  },
];

const sections = [
  {
    id: "01",
    title: "Information we collect",
    body: `When you register, we collect your full name, phone number, and national ID number. Workers also submit a photo of their ID document for verification. When you use the platform we collect job history, ratings, and general location data (district level) to match you with nearby opportunities or workers. We do not collect precise GPS coordinates without your explicit consent.`,
  },
  {
    id: "02",
    title: "How we use your information",
    body: `We use your data to operate the platform: verifying identities, matching workers to jobs, processing MoMo payments, and displaying your rating to prospective employers or workers. We may also use aggregated, anonymised data to improve our matching algorithms and understand how the platform is used - this data cannot identify you individually.`,
  },
  {
    id: "03",
    title: "Who we share your data with",
    body: `When a job is confirmed, the employer can see the worker's name, photo, rating, and job category experience - and vice versa. Beyond this, we share data only with MTN MoMo for payment processing and, if legally required, with Rwandan law enforcement or regulatory authorities. We do not sell, rent, or trade your personal data to any third party for marketing purposes.`,
  },
  {
    id: "04",
    title: "ID verification",
    body: `Workers submit a national ID document during onboarding. This document is reviewed by our verification team and then stored in an encrypted, access-restricted environment. Only authorised MpahMapu staff can access raw ID documents, and only for the purpose of resolving disputes or meeting legal obligations. Verified status is displayed as a badge; the underlying document is never shared with employers.`,
  },
  {
    id: "05",
    title: "MoMo and payment data",
    body: `We store only the MoMo phone number associated with your account. Full transaction records are held by MTN MoMo under their own privacy policy. MpahMapu retains payment records (amount, date, job reference) for up to 7 years as required by Rwandan tax law.`,
  },
  {
    id: "06",
    title: "Cookies and app analytics",
    body: `Our web and mobile platforms use essential cookies to keep you logged in and remember your preferences. We also use privacy-respecting analytics to understand which features are used and where the platform can be improved. Analytics data is aggregated and does not identify individual users. You can disable non-essential cookies in your device or browser settings.`,
  },
  {
    id: "07",
    title: "Data retention",
    body: `Active accounts: data is retained as long as your account is open. Deleted accounts: personal data is removed within 30 days of deletion, except for transaction records (7 years, legal requirement) and data relevant to unresolved disputes. Anonymised, aggregated data may be retained indefinitely.`,
  },
  {
    id: "08",
    title: "Your rights",
    body: `Under Rwandan law and in the spirit of fair data practice, you have the right to access a copy of your personal data, correct inaccurate information, request deletion of your account and data, and object to certain processing. To exercise any of these rights, contact privacy@MpahMapu.rw or use the in-app support form. We will respond within 10 business days.`,
  },
  {
    id: "09",
    title: "Security",
    body: `We use TLS encryption for all data in transit, AES-256 encryption for sensitive data at rest, and strict access controls so that only the staff who need data to do their jobs can access it. We conduct regular internal security reviews. If a breach occurs that affects your data, we will notify you within 72 hours and report it to the Rwanda Information Society Authority (RISA) as required.`,
  },
  {
    id: "10",
    title: "Changes to this policy",
    body: `We may update this Privacy Policy to reflect changes in the law or the platform. If changes are material, we will notify you via SMS or in-app notification at least 7 days before they take effect. Continued use of MpahMapu after that date constitutes acceptance.`,
  },
  {
    id: "11",
    title: "Contact us",
    body: `For privacy questions, data requests, or to report a concern, contact our data team at privacy@MpahMapu.rw. For general queries use legal@MpahMapu.rw or the contact form on our website.`,
  },
];

export default function PrivacyPage() {
  return (
    <main
      style={{
        background: "#111",
        minHeight: "100vh",
        color: "#f5f5f5",
        fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}
    >
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
            Privacy{" "}
            <span style={{ color: "#f97316" }}>Policy</span>
          </h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.75, maxWidth: 480, margin: "0 0 12px" }}>
            We collect only what we need, protect it carefully, and never sell it.
            Here is exactly how your data is handled on MpahMapu.
          </p>
          <p style={{ fontSize: 12, color: "#444", margin: 0 }}>
            Last updated: <span style={{ color: "#555" }}>1 June 2025</span>
          </p>
        </div>

        {/* HIGHLIGHTS GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
            marginBottom: 48,
          }}
        >
          {highlights.map(({ Icon, title, body }) => (
            <div
              key={title}
              style={{
                background: "#1c1c1c",
                border: "1px solid #272727",
                borderRadius: 14,
                padding: "20px",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "rgba(249,115,22,0.1)",
                  border: "1px solid rgba(249,115,22,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Icon size={18} color="#f97316" strokeWidth={1.75} />
              </div>
              <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#f0f0f0" }}>
                {title}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#555", lineHeight: 1.7 }}>
                {body}
              </p>
            </div>
          ))}
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
          <strong style={{ color: "#f97316", fontWeight: 700 }}>Plain language summary: </strong>
          We use your name, phone, and ID to verify you and run the platform. Payments go through MoMo - we
          never touch your cash. We share your info only with the person you are working with, and only
          what they need. You can delete your account any time.
        </div>

        {/* SECTIONS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sections.map(({ id, title, body }, i) => (
            <div
              key={id}
              style={{ display: "flex", gap: 20, position: "relative" }}
            >
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
        <div style={{ borderTop: "1px solid #1e1e1e", margin: "48px 0 40px" }} />

        {/* CONTACT BANNER */}
        <div
          style={{
            background: "#1c1c1c",
            border: "1px solid #272727",
            borderRadius: 16,
            padding: "24px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mail size={20} color="#f97316" />
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#f0f0f0" }}>
              Data &amp; privacy questions
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#555" }}>
              Email{" "}
              <a
                href="mailto:privacy@MpahMapu.rw"
                style={{ color: "#f97316", textDecoration: "none", fontWeight: 600 }}
              >
                privacy@MpahMapu.rw
              </a>{" "}
              - we respond within 10 business days.
            </p>
          </div>
        </div>

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
            Join thousands of workers and employers already on MpahMapu.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
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
              href="/terms-and-conditions"
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
              Terms &amp; conditions
            </a>
          </div>
        </div>

      </div>
      <Footer />
    </main>
  );
}