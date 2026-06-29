"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Check, Clock, MapPin, User,
  Calendar, Loader2, DollarSign, CheckCircle, X, Wallet,
} from "lucide-react";
import {
  getJob, getMyApplications, getWalletTransactions,
  updateApplicationStatus, withdrawApplication, verifyJobCompletion,
  type JobDto, type ApplicationDto, type PaymentDto,
} from "@/lib/api";
import { fmt } from "@/lib/dashboard-data";
import { RichTextDisplay } from "@/components/ui/rich-text-editor";

const d  = (iso: string | null | undefined) =>
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
        return (
          <div key={i} style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 20 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 999, marginTop: 2, flexShrink: 0,
                background: s.done ? dotColor : "transparent",
                border: `2px solid ${dotColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: s.active && !s.done ? "0 0 0 4px rgba(249,115,22,0.15)" : "none",
                zIndex: 1,
              }}>
                {s.done && <Check size={11} color="#000" strokeWidth={3} />}
              </div>
              {!isLast && (
                <div style={{ width: 2, flex: 1, minHeight: 32, background: s.done ? "#22c55e" : "#1c1c1c", marginTop: 4 }} />
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
                    Now
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

export default function SeekerJobDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [job,    setJob]    = useState<JobDto | null>(null);
  const [app,    setApp]    = useState<ApplicationDto | null>(null);
  const [txn,    setTxn]    = useState<PaymentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]   = useState<string | null>(null);
  const [note,    setNote]   = useState("");
  const [showNote, setShowNote] = useState<"ACCEPTED" | "REJECTED" | null>(null);
  const [showVerify, setShowVerify] = useState(false);
  const [badgeId, setBadgeId] = useState("");
  const [feedbackOption, setFeedbackOption] = useState("Pays on time");
  const [feedbackText, setFeedbackText] = useState("");
  const [rating, setRating] = useState(5);

  const load = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token || !id) return;
    setLoading(true);
    try {
      const [j, myApps, txns] = await Promise.all([
        getJob(id),
        getMyApplications(token),
        getWalletTransactions(token),
      ]);
      setJob(j);
      setApp(myApps.find(a => a.jobId === id) ?? null);
      setTxn(txns.find(t => t.type === "PAYMENT" && t.jobId === id) ?? null);
    } catch { router.push("/seeker/jobs"); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const doDecision = async (status: "ACCEPTED" | "REJECTED") => {
    if (!app) return;
    const token = localStorage.getItem("access_token")!;
    setBusy(status);
    try {
      const updated = await updateApplicationStatus(app.id, { status, responseNote: note || undefined }, token);
      setApp(updated);
      setShowNote(null); setNote("");
    } finally { setBusy(null); }
  };

  const doWithdraw = async () => {
    if (!app || !confirm("Withdraw your application?")) return;
    const token = localStorage.getItem("access_token")!;
    setBusy("withdraw");
    try {
      await withdrawApplication(app.id, token);
      router.push("/seeker/applications");
    } finally { setBusy(null); }
  };

  const doVerify = async () => {
    if (!badgeId.trim()) return alert("Badge ID is required");
    const token = localStorage.getItem("access_token")!;
    setBusy("verify");
    try {
      const payload: any = { badgeId, feedbackOption, rating };
      if (feedbackOption === "Other (requires text)") payload.feedbackText = feedbackText;
      const updated = await verifyJobCompletion(id, payload, token);
      setJob(updated);
      setShowVerify(false);
      await load();
    } catch (e: any) {
      alert("Verification failed");
    } finally { setBusy(null); }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <Loader2 size={24} color="#f97316" style={{ animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!job) return null;

  const isCompleted    = job.status === "COMPLETED";
  const isCancelled    = job.status === "CANCELLED";
  const appStatus      = app?.status ?? null;
  const isAccepted     = appStatus === "ACCEPTED";
  const isRejected     = appStatus === "REJECTED";
  const isPending      = appStatus === "PENDING";
  const isHireNow      = app?.appliedVia === "HIRE_NOW";
  const isViewed       = app?.employerViewed ?? false;
  const startPast      = job.startTime ? new Date(job.startTime) <= new Date() : false;
  const myPayout       = txn?.workerPayoutRwf ?? null;
  const isReleased     = txn?.status === "RELEASED";

  const STATUS_COLOR: Record<string, string> = {
    PENDING: "#f59e0b", ACCEPTED: "#22c55e", REJECTED: "#ef4444", WITHDRAWN: "#555",
  };

  const stages: Stage[] = [
    {
      done: true, active: false,
      label: isHireNow ? "You received a direct offer" : "You applied",
      date: d(app?.createdAt),
      content: app ? (
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
            {isHireNow ? "The employer sent you a direct hire offer" : "You submitted an application"}
            {app.createdAt ? ` on ${d(app.createdAt)}` : ""}
          </p>
          {app.bestFit && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#888", fontStyle: "italic" }}>
              Your note: "{app.bestFit}"
            </p>
          )}
        </div>
      ) : null,
    },
    {
      done: isViewed || !!appStatus && appStatus !== "PENDING", active: isViewed && isPending,
      label: isViewed ? "Employer reviewed your application" : "Awaiting employer review",
      date: isViewed && app?.respondedAt ? d(app.respondedAt) : undefined,
      content: !isViewed && isPending ? (
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>Your application is in the queue. You'll be notified when the employer responds.</p>
      ) : null,
    },
    {
      done: !isPending, active: isPending && isViewed,
      label: !isPending
        ? `Application ${appStatus}`
        : "Awaiting decision",
      date: app?.respondedAt ? d(app.respondedAt) : undefined,
      content: !isPending ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: app?.responseNote ? 6 : 0 }}>
            {isAccepted
              ? <CheckCircle size={14} color="#22c55e" />
              : <X size={14} color="#ef4444" />}
            <span style={{ fontSize: 12, fontWeight: 700, color: isAccepted ? "#22c55e" : "#ef4444" }}>
              {isAccepted ? "You got the job!" : appStatus === "REJECTED" ? "Not selected this time" : "Application withdrawn"}
            </span>
          </div>
          {app?.responseNote && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#888", fontStyle: "italic" }}>
              Employer note: "{app.responseNote}"
            </p>
          )}
        </div>
      ) : isPending && isHireNow ? (
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>Accept or decline this direct offer using the buttons above.</p>
      ) : null,
    },
    {
      done: isAccepted && (startPast || isCompleted), active: isAccepted && !startPast && !isCompleted,
      label: "Job Scheduled",
      date: job.startTime ? dt(job.startTime) : undefined,
      content: isAccepted ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {job.startTime && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Calendar size={12} color="#666" />
              <span style={{ fontSize: 11, color: "#888" }}>{dt(job.startTime)}</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={12} color="#666" />
            <span style={{ fontSize: 11, color: "#888" }}>{job.durationHours}h</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={12} color="#666" />
            <span style={{ fontSize: 11, color: "#888" }}>{job.district}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <DollarSign size={12} color="#666" />
            <span style={{ fontSize: 11, color: "#888" }}>RWF {job.ratePerHour?.toLocaleString()} / hr</span>
          </div>
        </div>
      ) : null,
    },
    {
      done: isCompleted, active: isAccepted && startPast && !isCompleted,
      label: "Job Completed",
      date: d(job.completedAt),
      content: isCompleted ? (
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#888" }}>
            Job marked complete by employer{job.completedAt ? ` on ${d(job.completedAt)}` : ""}.
          </p>
          {job.completionNotes && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#666", fontStyle: "italic" }}>"{job.completionNotes}"</p>
          )}
        </div>
      ) : null,
    },
    {
      done: isReleased, active: isCompleted && !isReleased,
      label: isReleased ? "Payment Received" : "Payment Pending Release",
      date: txn?.releasedAt ? d(txn.releasedAt) : undefined,
      content: myPayout != null ? (
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 10, color: "#444" }}>Your earnings</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: isReleased ? "#22c55e" : "#f97316" }}>
              {isReleased ? "+" : ""}RWF {myPayout.toLocaleString()}
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 10, color: "#444" }}>Status</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: isReleased ? "#22c55e" : "#f59e0b" }}>
              {isReleased ? "In your wallet" : "Held in escrow"}
            </span>
          </div>
        </div>
      ) : isAccepted && !isCompleted ? (
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
          Payment will be released to your wallet once the employer marks the job complete.
        </p>
      ) : null,
    },
  ];

  const inp: React.CSSProperties = {
    background: "#0e0e0e", border: "1px solid #222", borderRadius: 8,
    padding: "8px 12px", fontSize: 12, color: "#d0d0d0", fontFamily: "inherit", outline: "none",
  };

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 12, fontFamily: "inherit", padding: 0, marginBottom: 14 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>{job.title}</h1>
              {appStatus && (
                <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "3px 10px", color: STATUS_COLOR[appStatus] ?? "#888", background: `${STATUS_COLOR[appStatus] ?? "#888"}18` }}>
                  {appStatus}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#444" }}>
              by {job.employerName} · {job.category} · {job.district}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isPending && isHireNow && (
              showNote ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input placeholder="Optional message…" value={note} onChange={e => setNote(e.target.value)}
                    style={{ ...inp, width: 180 }} />
                  <button disabled={!!busy} onClick={() => doDecision(showNote)}
                    style={{ background: showNote === "ACCEPTED" ? "#22c55e" : "#ef4444", color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                    {busy ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : null}
                    {showNote === "ACCEPTED" ? "Confirm Accept" : "Confirm Decline"}
                  </button>
                  <button onClick={() => { setShowNote(null); setNote(""); }}
                    style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <button disabled={!!busy} onClick={() => setShowNote("ACCEPTED")}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    <CheckCircle size={12} /> Accept Offer
                  </button>
                  <button disabled={!!busy} onClick={() => setShowNote("REJECTED")}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    <X size={12} /> Decline
                  </button>
                </>
              )
            )}
            {isPending && !isHireNow && (
              <button disabled={busy === "withdraw"} onClick={doWithdraw}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {busy === "withdraw" ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <X size={12} />} Withdraw Application
              </button>
            )}
            {isAccepted && !job.workerVerified && !isCompleted && (
              <button disabled={busy === "verify"} onClick={() => setShowVerify(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <CheckCircle size={12} /> Finish
              </button>
            )}
            {job.workerVerified && !isCompleted && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", padding: "8px 14px", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, background: "rgba(34,197,94,0.08)" }}>
                Finished. Waiting for employer...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* Left: Timeline */}
        <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 16, padding: "24px 28px" }}>
          <p style={{ margin: "0 0 24px", fontSize: 11, fontWeight: 700, color: "#333", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Application Timeline
          </p>
          <Timeline stages={stages} />
        </div>

        {/* Right: Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Employer */}
          <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>Employer</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 99, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={16} color="#f97316" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#d0d0d0" }}>{job.employerName}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#444" }}>{job.district}</p>
              </div>
            </div>
          </div>

          {/* Job details */}
          <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>Job Details</p>
            <InfoRow label="Category" value={job.category} />
            <InfoRow label="Location" value={`${job.district}${job.province ? `, ${job.province}` : ""}`} />
            {job.locationNotes && <InfoRow label="Location Notes" value={<RichTextDisplay content={job.locationNotes} />} />}
            <InfoRow label="Rate" value={`RWF ${job.ratePerHour?.toLocaleString()} / hr`} />
            <InfoRow label="Duration" value={`${job.durationHours} hours`} />
            <InfoRow label="Headcount" value={`${job.headcount} worker${job.headcount !== 1 ? "s" : ""}`} />
            <InfoRow label="Urgency" value={job.urgency?.replace("_", " ")} />
            {job.startTime && <InfoRow label="Start Time" value={dt(job.startTime) ?? "—"} />}
            {job.requirements && <InfoRow label="Requirements" value={<RichTextDisplay content={job.requirements} />} />}
          </div>

          {/* Earnings */}
          {isAccepted && (
            <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your Earnings</p>
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <p style={{ margin: "0 0 4px", fontSize: 32, fontWeight: 900, color: isReleased ? "#22c55e" : "#f97316" }}>
                  RWF {myPayout != null ? myPayout.toLocaleString() : Math.round(job.ratePerHour * (job.durationHours ?? 1)).toLocaleString()}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#444" }}>
                  {isReleased
                    ? `Paid to your wallet on ${d(txn?.releasedAt)}`
                    : myPayout != null
                    ? "Held in escrow · released on completion"
                    : `Estimated · RWF ${job.ratePerHour?.toLocaleString()} × ${job.durationHours}h`}
                </p>
              </div>
              {isReleased && (
                <button onClick={() => router.push("/seeker/earnings")}
                  style={{ width: "100%", marginTop: 12, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Wallet size={12} /> View in Earnings
                </button>
              )}
            </div>
          )}

          {/* Job status badge */}
          <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, background: job.status === "OPEN" ? "#22c55e" : job.status === "COMPLETED" ? "#60a5fa" : "#ef4444", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              Job is <strong style={{ color: "#aaa" }}>{job.status}</strong>
              {isCompleted && job.completedAt ? ` · Completed ${d(job.completedAt)}` : ""}
              {isCancelled ? " — this job was cancelled" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Verify modal */}
      {showVerify && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 18, width: "100%", maxWidth: 420, padding: 28 }}>
            <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#fff" }}>Finish Job</p>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "#555" }}>
              Confirm that you have completed this job by entering your Badge MPU ID.
            </p>
            
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>YOUR BADGE MPU ID (REQUIRED)</p>
            <input value={badgeId} onChange={e => setBadgeId(e.target.value)}
              placeholder="e.g. MPU-12345" style={{ ...inp, width: "100%", marginBottom: 18, textTransform: "uppercase" }} />
              
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>RATE THE EMPLOYER (REQUIRED)</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setRating(star)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: star <= rating ? "#f97316" : "#333", padding: 0 }}>
                  ★
                </button>
              ))}
            </div>

            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>FEEDBACK (REQUIRED)</p>
            <select value={feedbackOption} onChange={e => setFeedbackOption(e.target.value)} style={{ ...inp, width: "100%", marginBottom: feedbackOption === "Other (requires text)" ? 10 : 18 }}>
              <option value="Pays on time">Pays on time</option>
              <option value="Good instructor">Good instructor</option>
              <option value="Gives tips">Gives tips</option>
              <option value="Needs Improvement">Needs Improvement</option>
              <option value="Other (requires text)">Other (requires text)</option>
            </select>
            {feedbackOption === "Other (requires text)" && (
              <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                rows={2} placeholder="Please describe..." style={{ ...inp, width: "100%", resize: "vertical", marginBottom: 18 }} />
            )}
            
            <div style={{ display: "flex", gap: 10 }}>
              <button disabled={busy === "verify"} onClick={doVerify}
                style={{ flex: 1, background: "#22c55e", color: "#000", border: "none", borderRadius: 9, padding: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {busy === "verify" ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <CheckCircle size={13} />} Finish
              </button>
              <button onClick={() => setShowVerify(false)}
                style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #222", borderRadius: 9, padding: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
