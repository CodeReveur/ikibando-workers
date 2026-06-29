"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, Loader2 } from "lucide-react";
import { applyForJob, apiError, type JobDto } from "@/lib/api";
import { saveRedirect } from "@/lib/auth-redirect";
import { useToast } from "@/components/ui/toast";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

interface Props { job: JobDto; onClose: () => void; }

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;
const rateLabel = (type: string) => {
  if (type === "PER_DAY") return "/ day";
  if (type === "PER_WEEK") return "/ wk";
  if (type === "PER_MONTH") return "/ mo";
  if (type === "PER_YEAR") return "/ yr";
  return "/ hr";
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 999, padding: 16, fontFamily: "Inter, DM Sans, system-ui, sans-serif",
};
const card: React.CSSProperties = {
  background: "#161616", border: "1px solid #222", borderRadius: 20,
  width: "100%", maxWidth: 400, padding: "24px",
};
const taInp: React.CSSProperties = {
  width: "100%", background: "#111", border: "1px solid #2a2a2a",
  borderRadius: 10, padding: "10px 12px", fontSize: 13,
  color: "#f0f0f0", outline: "none", fontFamily: "inherit",
  resize: "vertical", lineHeight: 1.65, boxSizing: "border-box",
};

export function ApplyModal({ job, onClose }: Props) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [bestFit, setBestFit]     = useState("");
  const [token, setToken]         = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);

  const DRAFT_KEY = `MpahMapu_draft_apply_${job.id}`;

  useEffect(() => {
    try { setToken(localStorage.getItem("access_token")); } catch { /* ignore */ }
  }, []);

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setBestFit(JSON.parse(raw) ?? "");
    } catch {}
  }, []);

  // Save draft on change
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(bestFit)); } catch {}
  }, [bestFit]);

  async function handleSubmit() {
    if (!token) {
      saveRedirect();
      window.location.href = "/signin";
      return;
    }
    setSubmitting(true);
    try {
      await applyForJob(job.id, { bestFit: bestFit.trim() || undefined }, token);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setDone(true);
    } catch (e: any) {
      toastError(apiError(e, "Failed to submit application. Please try again."), { title: "Application Failed" });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...card, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 56, height: 56, borderRadius: 999, margin: "0 auto 16px", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={28} color="#22c55e" />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: "#fff" }}>Application sent!</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#555", lineHeight: 1.65 }}>
          Your application for <strong style={{ color: "#f0f0f0" }}>{job.title}</strong> has been submitted. {job.employerName} will be notified.
        </p>
        <button onClick={onClose} style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 700, color: "#aaa", cursor: "pointer", fontFamily: "inherit" }}>
          Close
        </button>
      </div>
    </div>
  );

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>

        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>Apply for job</p>
            <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.title}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#555" }}>{fmt(job.ratePerHour)} {rateLabel(job.rateType)} · {job.district}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", flexShrink: 0 }}><X size={18} /></button>
        </div>

        {!token && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14,
            background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 8, padding: "8px 12px",
          }}>
            <span style={{ fontSize: 12, color: "#ef4444" }}>
              You must be{" "}
              <a
                href="/signin"
                style={{ color: "#f97316", fontWeight: 700 }}
                onClick={() => saveRedirect()}
              >
                signed in
              </a>
              {" "}to apply for jobs.
            </span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Why are you the best fit? (optional)
            </label>
            <RichTextEditor
              placeholder="Describe your experience, skills, or availability that make you ideal for this role…"
              value={bestFit}
              onChange={v => setBestFit(v)}
            />
          </div>

          <button
            disabled={!token || submitting}
            onClick={handleSubmit}
            style={{
              marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: token && !submitting ? "#f97316" : "#1c1c1c",
              border: token ? "none" : "1px solid #272727",
              borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700,
              color: token && !submitting ? "#fff" : "#444",
              cursor: token && !submitting ? "pointer" : "not-allowed", fontFamily: "inherit",
            }}
          >
            {submitting && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {submitting ? "Submitting…" : "Submit application"}
          </button>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        </div>
      </div>
    </div>
  );
}
