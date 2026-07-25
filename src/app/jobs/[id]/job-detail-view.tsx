"use client";

import { useState } from "react";
import Footer from "@/components/layout/footer";
import { ApplyModal } from "@/components/jobs/apply-modal";
import { daysAgo, workerNetHourly, workerNetTotal, type JobDto } from "@/lib/api";
import { useLanguage, usePageTitle } from "@/lib/language-context";
import { ratingLabel } from "@/lib/rating";
import {
  MapPin, Clock, Users, ChevronLeft,
  CheckCircle, Briefcase, AlertCircle, ArrowRight, Star,
} from "lucide-react";
import { RichTextDisplay } from "@/components/ui/rich-text-editor";
import { PaymentModeInfo } from "@/components/payments/payment-mode-info";

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

const CSS = `
  * { box-sizing: border-box; }
  .back-btn:hover { border-color: #f97316 !important; color: #f97316 !important; }
  .apply-btn-cta:hover { background: #ea6a0a !important; }
`;

/**
 * Presentation only. The job is fetched on the server and handed down, so the listing is in the
 * initial HTML instead of arriving after hydration. The server resolves a missing job to a real
 * 404 before this renders, so there is no loading or not-found branch here.
 */
export default function JobDetailView({ job }: { job: JobDto }) {
  const { t } = useLanguage();
  const [showApply, setShowApply] = useState(false);

  // The server picked a language at request time and cannot re-render, so keep the tab title in
  // step with the switcher here.
  usePageTitle(t("titles.job_detail", { title: job.title, district: job.district }));

  const posted = daysAgo(job.createdAt);

  return (
    <main style={{ background: "#111", minHeight: "100vh", color: "#f5f5f5", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
      <style>{CSS}</style>
      {showApply && <ApplyModal job={job} onClose={() => setShowApply(false)} />}

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 140px" }}>

        {/* BACK */}
        <a href="/jobs" className="back-btn" style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 13, fontWeight: 600, color: "#555", textDecoration: "none",
          border: "1px solid #272727", borderRadius: 999, padding: "6px 14px",
          marginBottom: 24, transition: "border-color 0.15s, color 0.15s",
        }}>
          <ChevronLeft size={14} /> Jobs
        </a>

        {/* TITLE + BADGES */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.6px", flex: 1, lineHeight: 1.2 }}>
              {job.title}
            </h1>
            {job.urgency === "IMMEDIATE" && (
              <span style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "4px 10px",
                background: "rgba(239,68,68,0.1)", color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.2)",
              }}>
                <AlertCircle size={11} /> Urgent
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "4px 12px",
              background: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)",
            }}>
              {job.category}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#555" }}>
              <MapPin size={12} color="#555" /> {job.district}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#555" }}>
              <Clock size={12} color="#555" /> {posted === 0 ? "Posted today" : `Posted ${posted}d ago`}
            </span>
            {job.headcount > 1 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#555" }}>
                <Users size={12} color="#555" /> {job.headcount} slots open
              </span>
            )}
          </div>
        </div>

        {/* PAY */}
        <div style={{
          background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)",
          borderRadius: 14, padding: "20px 22px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          {/* The headline number is what the worker takes home — the employer's posting price is
              theirs, not the worker's, and showing it here only sets up a nasty surprise at payout. */}
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              You&apos;ll earn
            </p>
            <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#f97316", letterSpacing: "-1px", lineHeight: 1 }}>
              {fmt(workerNetHourly(job))}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>
              {(() => {
                const u = ({ HOURLY:"hour", CUSTOM_HOURS:"hour", DAILY:"day", CUSTOM_DAYS:"day", WEEKLY:"week", MONTHLY:"month", CUSTOM_MONTHS:"month", YEARLY:"year" } as Record<string,string>)[job.paymentMode] || "hour";
                const d = job.durationHours;
                return `per ${u} · ${d} ${u}${d !== 1 ? "s" : ""} duration`;
              })()}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 700, color: "#22c55e" }}>
              {fmt(workerNetTotal(job))} total · all charges covered
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            {job.applicationsClosed ? (
              <>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>Applications</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>Closed</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#444" }}>All {job.headcount} position{job.headcount !== 1 ? "s" : ""} filled</p>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>Workers needed</p>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" }}>{job.acceptedCount ?? 0}/{job.headcount}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#444" }}>{job.pendingCount ?? 0} active application{(job.pendingCount ?? 0) !== 1 ? "s" : ""}</p>
              </>
            )}
          </div>
        </div>

        {/* PAYMENT SCHEDULE — how the worker gets paid over the job */}
        <div style={{
          background: "#141414", border: "1px solid #222", borderRadius: 12,
          padding: "12px 16px", marginBottom: 24,
        }}>
          <PaymentModeInfo
            paymentMode={job.paymentMode}
            paymentPeriods={job.paymentPeriods}
            paymentInterval={job.paymentInterval}
            durationUnits={job.durationHours}
            directRelease={job.directRelease}
          />
        </div>

        {/* DESCRIPTION */}
        {job.description && (
          <Section title="About this job">
            <RichTextDisplay content={job.description} />
          </Section>
        )}

        {/* REQUIREMENTS */}
        {job.requirements && (
          <Section title="Requirements">
            <RichTextDisplay content={job.requirements} />
          </Section>
        )}

        {/* NOTES */}
        {job.locationNotes && (
          <Section title="Additional notes">
            <RichTextDisplay content={job.locationNotes} />
          </Section>
        )}

        {/* EMPLOYER */}
        <Section title="Posted by">
          <div style={{
            background: "#1c1c1c", border: "1px solid #272727", borderRadius: 12, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 999, flexShrink: 0,
              background: "#272727", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: "#555",
            }}>
              {job.employerName[0]}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#f0f0f0" }}>{job.employerName}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>
                <Star size={11} color="#f97316" fill="#f97316" />
                {ratingLabel(job.employerRatingAvg, job.employerRatingCount)} · Employer on MpahMapu
              </p>
            </div>
            <CheckCircle size={14} color="#22c55e" />
          </div>
        </Section>

        {/* TRUST NOTE */}
        <div style={{
          background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.14)",
          borderRadius: 12, padding: "14px 16px", marginBottom: 24,
          display: "flex", gap: 12,
        }}>
          <Briefcase size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: "#555", lineHeight: 1.7 }}>
            Payments on MpahMapu are held in escrow and only released after you mark the work complete.
            Raise a dispute within <strong style={{ color: "#aaa" }}>24 hours</strong> for a full refund.
          </p>
        </div>

      </div>

      {/* STICKY CTA — matches navbar pill style */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "0 20px 20px",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}>
        <div style={{
          maxWidth: 680, margin: "0 auto",
          background: "rgba(22,22,22,0.85)",
          border: "1px solid rgba(45,45,45,0.9)",
          borderRadius: 999,
          height: 64,
          padding: "0 10px 0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxSizing: "border-box",
        }}>
          {/* Left: job summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e0e0e0", letterSpacing: "-0.2px" }}>
                {job.title}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
                {job.category} · {job.district}
              </p>
            </div>
            <div style={{ width: 1, height: 28, background: "#2a2a2a", flexShrink: 0 }} />
            <p title="What you take home, after all charges"
               style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#f97316", letterSpacing: "-0.4px", whiteSpace: "nowrap" }}>
              {fmt(workerNetHourly(job))} <span style={{ fontSize: 11, fontWeight: 500, color: "#555" }}>/hr</span>
            </p>
          </div>

          {/* Right: CTA */}
          <button
            className="apply-btn-cta"
            onClick={() => !job.applicationsClosed && setShowApply(true)}
            disabled={job.applicationsClosed}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: job.applicationsClosed ? "#2a2a2a" : "#f97316",
              color: job.applicationsClosed ? "#777" : "#fff", border: "none",
              borderRadius: 999, padding: "0 20px", height: 40,
              fontSize: 13, fontWeight: 700,
              cursor: job.applicationsClosed ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "background 0.15s",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {job.applicationsClosed ? "Applications closed" : <>Apply now <ArrowRight size={13} /></>}
          </button>
        </div>
      </div>

      <Footer />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.2px" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}