"use client";

import { use } from "react";
import { useState } from "react";
import Footer from "@/components/layout/footer";
import { ApplyModal } from "@/components/jobs/apply-modal";
import { JOBS } from "@/lib/data";
import {
  MapPin, Clock, Users, ChevronLeft,
  CheckCircle, Briefcase, AlertCircle, ArrowRight,
} from "lucide-react";

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;
const postedLabel = (d: number) => d === 0 ? "Posted today" : `Posted ${d}d ago`;

const CSS = `
  * { box-sizing: border-box; }
  .back-btn:hover { border-color: #f97316 !important; color: #f97316 !important; }
  .apply-btn:hover { background: #ea6a0a !important; }
  .req-item::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 999px; background: #f97316; margin-right: 10px; flex-shrink: 0; margin-top: 6px; }
`;

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [showApply, setShowApply] = useState(false);

  const job = JOBS.find(j => String(j.id) === id);

  if (!job) {
    return (
      <main style={{ background: "#111", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
        <p style={{ fontSize: 40, margin: "0 0 16px" }}>📋</p>
        <h1 style={{ color: "#fff", margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>Job not found</h1>
        <p style={{ color: "#555", fontSize: 14, margin: "0 0 24px" }}>This listing may have been filled or removed.</p>
        <a href="/jobs" style={{ color: "#f97316", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>← Back to Jobs</a>
      </main>
    );
  }

  return (
    <main style={{ background: "#111", minHeight: "100vh", color: "#f5f5f5", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
      <style>{CSS}</style>
      {showApply && <ApplyModal job={job} onClose={() => setShowApply(false)} />}

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 120px" }}>

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
            {job.urgent && (
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

          {/* Meta row */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "4px 12px",
              background: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)",
            }}>
              {job.category}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#555" }}>
              <MapPin size={12} color="#555" /> {job.location}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#555" }}>
              <Clock size={12} color="#555" /> {postedLabel(job.posted)}
            </span>
            {job.slots > 1 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#555" }}>
                <Users size={12} color="#555" /> {job.slots} slots open
              </span>
            )}
          </div>
        </div>

        {/* PAY - prominent */}
        <div style={{
          background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)",
          borderRadius: 14, padding: "20px 22px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pay</p>
            <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#f97316", letterSpacing: "-1px", lineHeight: 1 }}>
              {fmt(job.amount)}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>per {job.period}</p>
          </div>
          {job.slots > 1 && (
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total slots</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" }}>{job.slots}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#444" }}>positions available</p>
            </div>
          )}
        </div>

        {/* DESCRIPTION */}
        <Section title="About this job">
          <p style={{ margin: 0, fontSize: 13, color: "#aaa", lineHeight: 1.85 }}>{job.description}</p>
        </Section>

        {/* REQUIREMENTS */}
        <Section title="Requirements">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {job.requirements.map((r, i) => (
              <div key={i} className="req-item" style={{ display: "flex", alignItems: "flex-start", fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
                {r}
              </div>
            ))}
          </div>
        </Section>

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
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>
                {job.employerJobs > 0 ? `${job.employerJobs} jobs posted on Ikibando` : "New employer"}
              </p>
            </div>
            {job.employerJobs >= 5 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle size={14} color="#22c55e" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>Trusted</span>
              </div>
            )}
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
            Payments on Ikibando are held in escrow and only released after you mark the work complete.
            Raise a dispute within <strong style={{ color: "#aaa" }}>24 hours</strong> for a full refund.
          </p>
        </div>

      </div>

      {/* STICKY FOOTER */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#111", borderTop: "1px solid #1e1e1e",
        padding: "16px 20px", zIndex: 50,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "#555" }}>{job.category} · {job.location}</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#f97316", letterSpacing: "-0.4px" }}>
              {fmt(job.amount)} <span style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>/ {job.period}</span>
            </p>
          </div>
          <button
            className="apply-btn"
            onClick={() => setShowApply(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#f97316", color: "#fff", border: "none",
              borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s",
            }}
          >
            Apply for this job <ArrowRight size={14} />
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
