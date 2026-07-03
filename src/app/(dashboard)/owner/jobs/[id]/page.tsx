"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Check, X, Edit2, Trash2, Users, Clock,
  MapPin, CreditCard, CheckCircle, Circle, Loader2,
  DollarSign, User, Calendar, Briefcase, ChevronDown, ChevronUp, AlertCircle, Star,
} from "lucide-react";
import {
  getJob, getJobApplications, getWalletTransactions,
  updateApplicationStatus, cancelJob, completeJob, acceptAllApplications, updateJob, apiError,
  type JobDto, type ApplicationDto, type PaymentDto, type JobUpdatePayload,
} from "@/lib/api";
import { RWANDA_PROVINCES } from "@/lib/constants";
import { fmt } from "@/lib/dashboard-data";
import { ratingLabel } from "@/lib/rating";
import { RichTextEditor, RichTextDisplay } from "@/components/ui/rich-text-editor";

const d = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
const dt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

type Stage = { done: boolean; active: boolean; label: string; date?: string | null; content: React.ReactNode };

function Timeline({ stages }: { stages: Stage[] }) {
  return (
    <div style={{ position: "relative" }}>
      {stages.map((s, i) => {
        const isLast = i === stages.length - 1;
        const dotColor = s.done ? "#22c55e" : s.active ? "#f97316" : "#2a2a2a";
        const lineColor = s.done ? "#22c55e" : "#1c1c1c";
        return (
          <div key={i} style={{ display: "flex", gap: 16, position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 20 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 999, flexShrink: 0, marginTop: 2,
                background: s.done ? dotColor : "transparent",
                border: `2px solid ${dotColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: s.active ? "0 0 0 4px rgba(249,115,22,0.15)" : "none",
                zIndex: 1,
              }}>
                {s.done && <Check size={11} color="#000" strokeWidth={3} />}
              </div>
              {!isLast && (
                <div style={{ width: 2, flex: 1, minHeight: 32, background: lineColor, marginTop: 4 }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: s.content ? 10 : 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: s.done ? "#e0e0e0" : s.active ? "#f97316" : "#444" }}>
                  {s.label}
                </p>
                {s.date && <span style={{ fontSize: 11, color: "#333" }}>{s.date}</span>}
                {s.active && !s.done && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316", background: "rgba(249,115,22,0.1)", borderRadius: 99, padding: "2px 8px" }}>
                    Current
                  </span>
                )}
              </div>
              {s.content && (
                <div style={{ background: "#131313", border: "1px solid #1c1c1c", borderRadius: 10, padding: "12px 14px" }}>
                  {s.content}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
      <span style={{ fontSize: 11, color: "#444", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#ccc", textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

export default function OwnerJobDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [job, setJob] = useState<JobDto | null>(null);
  const [apps, setApps] = useState<ApplicationDto[]>([]);
  const [txn, setTxn] = useState<PaymentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [completionNote, setCompletionNote] = useState("");
  const [feedbackOption, setFeedbackOption] = useState("Excellent Work");
  const [feedbackText, setFeedbackText] = useState("");
  const [rating, setRating] = useState(5);
  const [showEdit, setShowEdit] = useState(false);
  const [noteFor, setNoteFor] = useState<{ appId: string; action: "ACCEPTED" | "REJECTED" } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [expandApps, setExpandApps] = useState(true);

  const load = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token || !id) return;
    setLoading(true);
    try {
      const [j, a, txns] = await Promise.all([
        getJob(id),
        getJobApplications(id, token),
        getWalletTransactions(token),
      ]);
      setJob(j);
      setApps(a);
      setTxn(txns.find(t => t.type === "PAYMENT" && t.jobId === id) ?? null);
    } catch { router.push("/owner/offers"); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const doAcceptAll = async () => {
    const token = localStorage.getItem("access_token")!;
    setBusy("accept-all");
    try {
      const updated = await acceptAllApplications(id, token);
      setApps(prev => prev.map(a => updated.find(u => u.id === a.id) ?? a));
    } finally { setBusy(null); }
  };

  const doAppAction = async (appId: string, status: "ACCEPTED" | "REJECTED", note?: string) => {
    const token = localStorage.getItem("access_token")!;
    setBusy(appId);
    try {
      const updated = await updateApplicationStatus(appId, { status, responseNote: note }, token);
      setApps(prev => prev.map(a => a.id === appId ? updated : a));
    } finally { setBusy(null); setNoteFor(null); setNoteText(""); }
  };

  const doComplete = async () => {
    const token = localStorage.getItem("access_token")!;
    setBusy("complete");
    try {
      const payload: any = { 
        completionNotes: completionNote,
        feedbackOption,
        rating
      };
      if (feedbackOption === "Other (requires text)") payload.feedbackText = feedbackText;
      const updated = await completeJob(id, payload, token);
      setJob(updated);
      setShowComplete(false);
      await load();
    } finally { setBusy(null); }
  };

  const doCancel = async () => {
    if (!confirm("Cancel this job? The escrowed amount will be refunded to your wallet.")) return;
    const token = localStorage.getItem("access_token")!;
    setBusy("cancel");
    try {
      await cancelJob(id, token);
      router.push("/owner/offers");
    } finally { setBusy(null); }
  };

  const doEdit = async (payload: JobUpdatePayload) => {
    const token = localStorage.getItem("access_token")!;
    setBusy("edit");
    try {
      const updated = await updateJob(id, payload, token);
      setJob(updated);
      setShowEdit(false);
    } finally { setBusy(null); }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <Loader2 size={24} color="#f97316" style={{ animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!job) return null;

  const pending  = apps.filter(a => a.status === "PENDING");
  const accepted = apps.filter(a => a.status === "ACCEPTED");
  const rejected = apps.filter(a => a.status === "REJECTED");
  const isOpen      = job.status === "OPEN";
  const isCompleted = job.status === "COMPLETED";
  const isCancelled = job.status === "CANCELLED";
  const hasAccepted = accepted.length > 0;
  const startPast   = job.startTime ? new Date(job.startTime) <= new Date() : false;

  const workerPayout = txn?.workerPayoutRwf ?? null;
  const platformFee  = txn?.platformFeeRwf ?? null;
  const escrowed     = txn?.amountRwf ?? null;

  // ── Timeline stages ─────────────────────────────────────────────────────────
  const stages: Stage[] = [
    {
      done: true, active: false,
      label: "Job Posted",
      date: d(job.createdAt),
      content: (
        <div>
          {job.description && <RichTextDisplay content={job.description} />}
          {escrowed != null && (
            <p style={{ margin: 0, fontSize: 12, color: "#22c55e" }}>
              RWF {escrowed.toLocaleString()} escrowed from wallet
            </p>
          )}
        </div>
      ),
    },
    {
      done: apps.length > 0, active: apps.length > 0 && !hasAccepted,
      label: `Applications (${apps.length})`,
      date: apps.length > 0 ? `${pending.length} pending · ${accepted.length} accepted · ${rejected.length} rejected` : undefined,
      content: apps.length > 0 ? (
        <div>
          <button
            onClick={() => setExpandApps(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 11, display: "flex", alignItems: "center", gap: 4, padding: 0, marginBottom: expandApps ? 10 : 0, fontFamily: "inherit" }}>
            {expandApps ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expandApps ? "Hide" : "Show"} applicants
          </button>
          {expandApps && apps.map(app => (
            <div key={app.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 0", borderBottom: "1px solid #1a1a1a",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#d0d0d0", display: "flex", alignItems: "center", gap: 6 }}>
                  {app.workerName}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10, color: "#f97316", fontWeight: 700 }}>
                    <Star size={9} color="#f97316" fill="#f97316" />{ratingLabel(app.workerRating, app.workerRatingCount)}
                  </span>
                </p>
                <p style={{ margin: 0, fontSize: 10, color: "#444" }}>
                  {app.workerDistrict ?? "—"}
                  {app.appliedVia === "HIRE_NOW" ? " · Direct Offer" : " · Self-applied"}
                  {app.createdAt ? ` · ${d(app.createdAt)}` : ""}
                </p>
                {app.bestFit && <p style={{ margin: "3px 0 0", fontSize: 10, color: "#555", fontStyle: "italic" }}>"{app.bestFit}"</p>}
                {app.responseNote && <p style={{ margin: "3px 0 0", fontSize: 10, color: "#888" }}>Note: {app.responseNote}</p>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 10 }}>
                {app.status === "PENDING" && isOpen ? (
                  noteFor?.appId === app.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      <input
                        autoFocus
                        placeholder="Optional note…"
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        style={{ background: "#0e0e0e", border: "1px solid #222", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#ccc", fontFamily: "inherit", width: 160, outline: "none" }}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        <button disabled={busy === app.id} onClick={() => doAppAction(app.id, noteFor.action, noteText)}
                          style={{ background: noteFor.action === "ACCEPTED" ? "#22c55e" : "#ef4444", color: "#000", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {busy === app.id ? "…" : noteFor.action === "ACCEPTED" ? "Confirm" : "Confirm"}
                        </button>
                        <button onClick={() => { setNoteFor(null); setNoteText(""); }}
                          style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button disabled={!!busy} onClick={() => setNoteFor({ appId: app.id, action: "ACCEPTED" })}
                        style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        Accept
                      </button>
                      <button disabled={!!busy} onClick={() => setNoteFor({ appId: app.id, action: "REJECTED" })}
                        style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        Reject
                      </button>
                    </>
                  )
                ) : (
                  <span style={{
                    fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "3px 9px",
                    color: app.status === "ACCEPTED" ? "#22c55e" : app.status === "REJECTED" ? "#ef4444" : "#888",
                    background: app.status === "ACCEPTED" ? "rgba(34,197,94,0.08)" : app.status === "REJECTED" ? "rgba(239,68,68,0.08)" : "rgba(100,100,100,0.08)",
                  }}>{app.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : <p style={{ margin: 0, fontSize: 12, color: "#444" }}>No applications yet.</p>,
    },
    {
      done: hasAccepted, active: hasAccepted && !startPast,
      label: `Workers Hired (${accepted.length})`,
      date: accepted.length > 0 && accepted[0].respondedAt ? d(accepted[0].respondedAt) : undefined,
      content: hasAccepted ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {accepted.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 8, padding: "6px 10px" }}>
              <div style={{ width: 24, height: 24, borderRadius: 99, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={12} color="#f97316" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#d0d0d0" }}>{a.workerName}</p>
                {a.workerDistrict && <p style={{ margin: 0, fontSize: 10, color: "#444" }}>{a.workerDistrict}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : null,
    },
    {
      done: isCompleted || startPast, active: hasAccepted && startPast && !isCompleted,
      label: "Job In Progress",
      date: job.startTime ? dt(job.startTime) : undefined,
      content: job.startTime ? (
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Calendar size={12} color="#666" />
            <span style={{ fontSize: 11, color: "#888" }}>{dt(job.startTime)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={12} color="#666" />
            <span style={{ fontSize: 11, color: "#888" }}>{job.durationHours}h duration</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={12} color="#666" />
            <span style={{ fontSize: 11, color: "#888" }}>{job.district}</span>
          </div>
        </div>
      ) : null,
    },
    {
      done: isCompleted, active: isCompleted,
      label: "Job Completed",
      date: d(job.completedAt),
      content: isCompleted ? (
        <div>
          {job.completionNotes && <p style={{ margin: 0, fontSize: 12, color: "#888", fontStyle: "italic" }}>"{job.completionNotes}"</p>}
        </div>
      ) : null,
    },
    {
      done: txn?.status === "RELEASED", active: isCompleted && txn?.status !== "RELEASED",
      label: "Payment Released to Workers",
      date: txn?.releasedAt ? d(txn.releasedAt) : undefined,
      content: txn?.status === "RELEASED" && workerPayout != null ? (
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: "#444" }}>Worker payout</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#22c55e" }}>RWF {workerPayout.toLocaleString()}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: "#444" }}>Per worker ({accepted.length || job.headcount})</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#d0d0d0" }}>
              RWF {Math.round(workerPayout / Math.max(1, accepted.length || job.headcount)).toLocaleString()}
            </p>
          </div>
        </div>
      ) : !isCompleted ? (
        <p style={{ margin: 0, fontSize: 12, color: "#333" }}>Released automatically when job is marked complete.</p>
      ) : null,
    },
  ];

  const STATUS_COLOR: Record<string, string> = {
    OPEN: "#22c55e", FILLED: "#f97316", COMPLETED: "#60a5fa", CANCELLED: "#ef4444",
  };

  const inp: React.CSSProperties = {
    width: "100%", background: "#0e0e0e", border: "1px solid #222", borderRadius: 8,
    padding: "9px 12px", fontSize: 12, color: "#d0d0d0", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push("/owner/offers")}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 12, fontFamily: "inherit", padding: 0, marginBottom: 14 }}>
          <ArrowLeft size={14} /> Back to My Jobs
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>{job.title}</h1>
              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "3px 10px", color: STATUS_COLOR[job.status] ?? "#888", background: `${STATUS_COLOR[job.status] ?? "#888"}18` }}>
                {job.status}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#444" }}>{job.category} · {job.district} · {job.headcount} worker{job.headcount !== 1 ? "s" : ""}</p>
          </div>
          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isOpen && pending.length > 0 && (
              <button disabled={busy === "accept-all"} onClick={doAcceptAll}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {busy === "accept-all" ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <Users size={12} />}
                Accept All ({pending.length})
              </button>
            )}
            {isOpen && hasAccepted && (
              <button disabled={busy === "complete" || !job.workerVerified} onClick={() => job.workerVerified ? setShowComplete(true) : alert("Waiting for worker to verify completion via their badge.")}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(96,165,250,0.08)", color: job.workerVerified ? "#60a5fa" : "#444", border: job.workerVerified ? "1px solid rgba(96,165,250,0.2)" : "1px solid #222", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: job.workerVerified ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                <CheckCircle size={12} /> {job.workerVerified ? "Complete Job" : "Waiting for Worker"}
              </button>
            )}
            {isOpen && (
              <button disabled={!!busy} onClick={() => setShowEdit(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(249,115,22,0.08)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Edit2 size={12} /> Edit
              </button>
            )}
            {isOpen && (
              <button disabled={busy === "cancel"} onClick={doCancel}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {busy === "cancel" ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <Trash2 size={12} />}
                Unpublish
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        {/* Left: Timeline */}
        <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 16, padding: "24px 28px" }}>
          <p style={{ margin: "0 0 24px", fontSize: 11, fontWeight: 700, color: "#333", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Job Timeline
          </p>
          <Timeline stages={stages} />
        </div>

        {/* Right: Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Job details */}
          <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>Job Details</p>
            <InfoRow label="Category" value={job.category} />
            <InfoRow label="Location" value={`${job.district}${job.province ? `, ${job.province}` : ""}`} />
            {job.locationNotes && <InfoRow label="Notes" value={<RichTextDisplay content={job.locationNotes} />} />}
            <InfoRow label="Rate" value={`RWF ${job.ratePerHour?.toLocaleString()} / hr`} />
            <InfoRow label="Duration" value={`${job.durationHours} hours`} />
            <InfoRow label="Headcount" value={`${job.headcount} worker${job.headcount !== 1 ? "s" : ""}`} />
            <InfoRow label="Urgency" value={job.urgency?.replace("_", " ")} />
            {job.startTime && <InfoRow label="Start Time" value={dt(job.startTime) ?? "—"} />}
            {job.requirements && <InfoRow label="Requirements" value={<RichTextDisplay content={job.requirements} />} />}
          </div>

          {/* Financial summary */}
          {txn && (
            <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>Escrow Summary</p>
              <InfoRow label="Total Escrowed" value={<span style={{ color: "#f97316", fontWeight: 800 }}>RWF {escrowed?.toLocaleString()}</span>} />
              <InfoRow label="Worker Payout" value={`RWF ${workerPayout?.toLocaleString()}`} />
              <InfoRow label="Platform Fee (5%)" value={`RWF ${platformFee?.toLocaleString()}`} />
              <InfoRow label="Payment Status" value={
                <span style={{ color: txn.status === "RELEASED" ? "#22c55e" : txn.status === "REFUNDED" ? "#60a5fa" : "#f59e0b", fontWeight: 700 }}>
                  {txn.status}
                </span>
              } />
              {txn.releasedAt && <InfoRow label="Released" value={d(txn.releasedAt) ?? "—"} />}
              {txn.refundedAt && <InfoRow label="Refunded" value={d(txn.refundedAt) ?? "—"} />}
            </div>
          )}

          {/* Workers summary */}
          {accepted.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>Hired Workers</p>
              {accepted.map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 99, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={13} color="#f97316" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#d0d0d0" }}>{a.workerName}</p>
                    <p style={{ margin: 0, fontSize: 10, color: "#444" }}>{a.workerDistrict ?? "—"} · Accepted {d(a.respondedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Complete job modal */}
      {showComplete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 18, width: "100%", maxWidth: 420, padding: 28 }}>
            <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#fff" }}>Mark Job Complete</p>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "#555" }}>
              This will release RWF {workerPayout?.toLocaleString() ?? "—"} to the worker{accepted.length !== 1 ? "s" : ""}. This action cannot be undone.
            </p>
            
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>RATING (REQUIRED)</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setRating(star)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: star <= rating ? "#f97316" : "#333", padding: 0 }}>
                  ★
                </button>
              ))}
            </div>

            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>FEEDBACK (REQUIRED)</p>
            <select value={feedbackOption} onChange={e => setFeedbackOption(e.target.value)} style={{ ...inp, marginBottom: feedbackOption === "Other (requires text)" ? 10 : 18 }}>
              <option value="Excellent Work">Excellent Work</option>
              <option value="Good Work">Good Work</option>
              <option value="Needs Improvement">Needs Improvement</option>
              <option value="Poor Work">Poor Work</option>
              <option value="Other (requires text)">Other (requires text)</option>
            </select>
            {feedbackOption === "Other (requires text)" && (
              <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                rows={2} placeholder="Please describe..." style={{ ...inp, resize: "vertical", marginBottom: 18 }} />
            )}

            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>COMPLETION NOTES (optional)</p>
            <textarea value={completionNote} onChange={e => setCompletionNote(e.target.value)}
              rows={2} placeholder="How did the job go?" style={{ ...inp, resize: "vertical", marginBottom: 18 }} />
            
            <div style={{ display: "flex", gap: 10 }}>
              <button disabled={busy === "complete"} onClick={doComplete}
                style={{ flex: 1, background: "#22c55e", color: "#000", border: "none", borderRadius: 9, padding: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {busy === "complete" ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <CheckCircle size={13} />} Complete & Release Payment
              </button>
              <button onClick={() => setShowComplete(false)}
                style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #222", borderRadius: 9, padding: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && job && (
        <EditJobModal
          job={job}
          saving={busy === "edit"}
          onSave={doEdit}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}

/* ── Reusable edit modal ─────────────────────────────────────────────────── */
function EditJobModal({ job, saving, onSave, onClose }: {
  job: JobDto;
  saving: boolean;
  onSave: (payload: JobUpdatePayload) => void;
  onClose: () => void;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const existingDate = job.startTime ? new Date(job.startTime).toISOString().split("T")[0] : "";
  const existingTime = job.startTime ? new Date(job.startTime).toTimeString().slice(0, 5) : "";

  const [form, setForm] = useState({
    date:          existingDate,
    time:          existingTime,
    durationHours: String(job.durationHours ?? ""),
    headcount:     String(job.headcount ?? ""),
    urgency:       job.urgency ?? "SCHEDULED",
    province:      job.province ?? "",
    district:      job.district ?? "",
    locationNotes: job.locationNotes ?? "",
    description:   job.description ?? "",
    requirements:  job.requirements ?? "",
  });
  const [err, setErr] = useState("");

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const districts = RWANDA_PROVINCES.find(p => p.label === form.province)?.districts ?? [];

  const rate      = job.ratePerHour;
  const hours     = parseFloat(form.durationHours) || 0;
  const heads     = parseInt(form.headcount) || 1;
  const gross     = Math.round(rate * hours * heads);
  const fee       = Math.round(gross * 0.25);
  const workerNet = gross - fee;
  const oldGross  = Math.round(rate * (job.durationHours ?? 0) * (job.headcount ?? 1));
  const diff      = gross - oldGross;

  const handleSave = () => {
    setErr("");
    const startTime = form.date && form.time
      ? new Date(`${form.date}T${form.time}:00`).toISOString() : undefined;
    const payload: JobUpdatePayload = {
      ...(startTime                        ? { startTime }                              : {}),
      ...(form.durationHours               ? { durationHours: parseFloat(form.durationHours) } : {}),
      ...(form.headcount                   ? { headcount: parseInt(form.headcount) }    : {}),
      ...(form.urgency                     ? { urgency: form.urgency as any }           : {}),
      ...(form.province                    ? { province: form.province }                : {}),
      ...(form.district                    ? { district: form.district }                : {}),
      locationNotes: form.locationNotes,
      description:  form.description,
      requirements: form.requirements,
    };
    onSave(payload);
  };

  const s: React.CSSProperties = { width:"100%", background:"#131313", border:"1px solid #222", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#d0d0d0", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:5 };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:500, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"32px 20px", overflowY:"auto" }}>
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:18, width:"100%", maxWidth:520, padding:"28px 28px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#fff" }}>Edit Job</p>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#555" }}><X size={18} /></button>
        </div>
        <p style={{ margin:"0 0 20px", fontSize:12, color:"#444" }}>
          {job.title} · Rate locked at RWF {rate.toLocaleString()}/{job.rateType?.replace("PER_","").toLowerCase()}
        </p>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <div><label style={lbl}>Start Date</label><input type="date" min={todayStr} value={form.date} onChange={set("date")} style={s} /></div>
          <div><label style={lbl}>Start Time</label><input type="time" value={form.time} onChange={set("time")} style={s} /></div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <div>
            <label style={lbl}>Duration (hours)</label>
            <input type="number" min="0.5" step="0.5" value={form.durationHours} onChange={set("durationHours")} style={s} />
          </div>
          <div>
            <label style={lbl}>Workers needed</label>
            <input type="number" min="1" max="200" value={form.headcount} onChange={set("headcount")} style={s} />
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Urgency</label>
          <select value={form.urgency} onChange={set("urgency")} style={s}>
            <option value="SCHEDULED">Scheduled</option>
            <option value="SAME_DAY">Same day</option>
            <option value="IMMEDIATE">Immediate</option>
          </select>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <div>
            <label style={lbl}>Province</label>
            <select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value, district: "" }))} style={s}>
              <option value="">Select…</option>
              {RWANDA_PROVINCES.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>District</label>
            <select value={form.district} onChange={set("district")} style={s} disabled={!form.province}>
              <option value="">Select…</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Location notes</label>
          <RichTextEditor value={form.locationNotes} onChange={v => setForm(f => ({...f, locationNotes: v}))} placeholder="e.g. Gate B, 2nd floor…" />
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={lbl}>Description</label>
          <RichTextEditor value={form.description} onChange={v => setForm(f => ({...f, description: v}))} />
        </div>
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>Requirements</label>
          <RichTextEditor value={form.requirements} onChange={v => setForm(f => ({...f, requirements: v}))} />
        </div>

        {gross > 0 && (
          <div style={{ background:"#131313", border:"1px solid #1e1e1e", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:"#555" }}>Gross ({heads} × {hours}h × RWF {rate.toLocaleString()})</span>
              <span style={{ fontSize:11, color:"#888" }}>RWF {gross.toLocaleString()}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:"#555" }}>Platform fee (25% from worker)</span>
              <span style={{ fontSize:11, color:"#ef4444" }}>−RWF {fee.toLocaleString()}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom: diff !== 0 ? 4 : 0 }}>
              <span style={{ fontSize:11, color:"#555" }}>Workers receive</span>
              <span style={{ fontSize:11, color:"#22c55e" }}>RWF {workerNet.toLocaleString()}</span>
            </div>
            {diff !== 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", borderTop:"1px solid #1e1e1e", paddingTop:6, marginTop:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#aaa" }}>Escrow change</span>
                <span style={{ fontSize:11, fontWeight:700, color: diff > 0 ? "#f97316" : "#22c55e" }}>
                  {diff > 0 ? "+" : ""}RWF {diff.toLocaleString()} {diff > 0 ? "will be frozen" : "will be refunded"}
                </span>
              </div>
            )}
          </div>
        )}

        {err && <p style={{ margin:"0 0 12px", fontSize:12, color:"#ef4444" }}>{err}</p>}
        <div style={{ display:"flex", gap:10 }}>
          <button disabled={saving} onClick={handleSave}
            style={{ flex:1, background:"#f97316", color:"#fff", border:"none", borderRadius:9, padding:12, fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            {saving ? <Loader2 size={13} style={{ animation:"spin 0.8s linear infinite" }} /> : null}
            Save Changes
          </button>
          <button onClick={onClose}
            style={{ flex:1, background:"transparent", color:"#555", border:"1px solid #222", borderRadius:9, padding:12, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
