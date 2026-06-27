"use client";

import { use } from "react";
import { useState, useEffect } from "react";
import Footer from "@/components/layout/footer";
import { ApplyModal } from "@/components/jobs/apply-modal";
import { getJob, daysAgo, type JobDto } from "@/lib/api";
import {
  MapPin, Clock, Users, ChevronLeft,
  CheckCircle, Briefcase, AlertCircle, ArrowRight,
} from "lucide-react";

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

const CSS = `
  * { box-sizing: border-box; }
  .back-btn:hover { border-color: #f97316 !important; color: #f97316 !important; }
  .apply-btn-cta:hover { background: #ea6a0a !important; }
`;

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [showApply, setShowApply] = useState(false);
  const [job, setJob] = useState<JobDto | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getJob(id)
      .then(setJob)
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <main style={{ background: "#111", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
        <p style={{ fontSize: 40, margin: "0 0 16px" }}>📋</p>
        <h1 style={{ color: "#fff", margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>Job not found</h1>
        <p style={{ color: "#555", fontSize: 14, margin: "0 0 24px" }}>This listing may have been filled or removed.</p>
        <a href="/jobs" style={{ color: "#f97316", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>← Back to Jobs</a>
      </main>
    );
  }

  if (!job) {
    return (
      <main style={{ background: "#111", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
        <p style={{ color: "#555", fontSize: 14 }}>Loading…</p>
      </main>
    );
  }

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
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>Rate</p>
            <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#f97316", letterSpacing: "-1px", lineHeight: 1 }}>
              {fmt(job.ratePerHour)}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>per hour · {job.durationHours}h duration</p>
          </div>
          {job.headcount > 1 && (
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total slots</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" }}>{job.headcount}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#444" }}>positions available</p>
            </div>
          )}
        </div>

        {/* DESCRIPTION */}
        {job.description && (
          <Section title="About this job">
            <p style={{ margin: 0, fontSize: 13, color: "#aaa", lineHeight: 1.85 }}>{job.description}</p>
          </Section>
        )}

        {/* NOTES */}
        {job.locationNotes && (
          <Section title="Additional notes">
            <p style={{ margin: 0, fontSize: 13, color: "#aaa", lineHeight: 1.85 }}>{job.locationNotes}</p>
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
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>Employer on MpahMapu</p>
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
            <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#f97316", letterSpacing: "-0.4px", whiteSpace: "nowrap" }}>
              {fmt(job.ratePerHour)} <span style={{ fontSize: 11, fontWeight: 500, color: "#555" }}>/hr</span>
            </p>
          </div>

          {/* Right: CTA */}
          <button
            className="apply-btn-cta"
            onClick={() => setShowApply(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "#f97316", color: "#fff", border: "none",
              borderRadius: 999, padding: "0 20px", height: 40,
              fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            Apply now <ArrowRight size={13} />
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