"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Check, X, Edit2, Trash2, Users, Clock,
  MapPin, CreditCard, CheckCircle, Circle, Loader2,
  DollarSign, User, Calendar, Briefcase, ChevronDown, ChevronUp, AlertCircle, Star, FileText,
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
import { startEmployerTracking } from "@/components/nav/live-nav";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/components/ui/toast";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { JobEvidence } from "@/components/jobs/job-evidence";
import { setJobAutoRelease } from "@/lib/api";

const dateLocaleMap: Record<string, string> = {
  rw: "rw-RW",
  kinyy: "rw-RW",
  sw: "sw-TZ",
  fr: "fr-FR",
  en: "en-US",
};

const d = (iso: string | null | undefined, locale = "en-US") =>
  iso ? new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : null;
const dt = (iso: string | null | undefined, locale = "en-US") =>
  iso ? new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

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
  const { t, language } = useLanguage();
  const { error: toastError } = useToast();
  const currentLocale = dateLocaleMap[language] || "en-RW";
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [job, setJob] = useState<JobDto | null>(null);
  const [apps, setApps] = useState<ApplicationDto[]>([]);
  const [txn, setTxn] = useState<PaymentDto | null>(null);
  const [token, setToken] = useState<string | null>(null);
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
    setToken(token);
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
    } catch (e: any) {
      toastError(apiError(e, t("owner_jobs.accept_failed") || "Could not accept applicants."));
    } finally { setBusy(null); }
  };

  const doAppAction = async (appId: string, status: "ACCEPTED" | "REJECTED", note?: string) => {
    const token = localStorage.getItem("access_token")!;
    setBusy(appId);
    try {
      const updated = await updateApplicationStatus(appId, { status, responseNote: note }, token);
      setApps(prev => prev.map(a => a.id === appId ? updated : a));
    } catch (e: any) {
      toastError(apiError(e, t("owner_jobs.accept_failed") || "Could not update the application."));
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
    if (!confirm(t("owner_jobs.confirm_cancel_alert") || "Cancel this job? The escrowed amount will be refunded to your wallet.")) return;
    const token = localStorage.getItem("access_token")!;
    setBusy("cancel");
    try {
      await cancelJob(id, token);
      router.push("/owner/offers");
    } finally { setBusy(null); }
  };

  const doToggleAutoRelease = async (val: boolean) => {
    const tk = token || localStorage.getItem("access_token");
    if (!tk) return;
    setBusy("autorelease");
    try {
      const updated = await setJobAutoRelease(id, val, tk);
      setJob(updated);
    } catch (e: any) {
      alert(apiError(e, t("owner_jobs.auto_release_failed") || "Couldn't update auto-release"));
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
  const headcount   = Number(job.headcount) || 1;
  const slotsLeft   = Math.max(0, headcount - accepted.length);
  const isFull      = slotsLeft <= 0;
  const startPast   = job.startTime ? new Date(job.startTime) <= new Date() : false;

  const workerPayout = txn?.workerPayoutRwf ?? null;
  const platformFee  = txn?.platformFeeRwf ?? null;
  const escrowed     = txn?.amountRwf ?? null;

  // ── Timeline stages ─────────────────────────────────────────────────────────
  const stages: Stage[] = [
    {
      done: true, active: false,
      label: t("owner_jobs.posted") || "Job Posted",
      date: d(job.createdAt, currentLocale),
      content: (
        <div>
          {job.description && <RichTextDisplay content={job.description} />}
          {escrowed != null && (
            <p style={{ margin: 0, fontSize: 12, color: "#22c55e" }}>
              RWF {escrowed.toLocaleString()} {t("owner_jobs.escrowed_from_wallet") || "escrowed from wallet"}
            </p>
          )}
        </div>
      ),
    },
    {
      done: apps.length > 0, active: apps.length > 0 && !hasAccepted,
      label: `${t("owner_jobs.applications") || "Applications"} (${apps.length})`,
      date: apps.length > 0 ? `${pending.length} ${t("seeker_jobs.status_pending") || "pending"} · ${accepted.length} ${t("settings_page.account.verified") || "accepted"} · ${rejected.length} ${t("common.general.rejected") || "rejected"}` : undefined,
      content: apps.length > 0 ? (
        <div>
          <button
            onClick={() => setExpandApps(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 11, display: "flex", alignItems: "center", gap: 4, padding: 0, marginBottom: expandApps ? 10 : 0, fontFamily: "inherit" }}>
            {expandApps ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expandApps ? (t("owner_jobs.hide_applicants") || "Hide applicants") : (t("owner_jobs.show_applicants") || "Show applicants")}
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
                  {app.appliedVia === "HIRE_NOW" ? ` · ${t("owner_jobs.direct_offer") || "Direct Offer"}` : ` · ${t("owner_jobs.self_applied") || "Self-applied"}`}
                  {app.createdAt ? ` · ${d(app.createdAt, currentLocale)}` : ""}
                </p>
                {app.bestFit && (
                  <div style={{ margin: "5px 0 0", fontSize: 11, color: "#999" }}>
                    <RichTextDisplay content={app.bestFit} />
                  </div>
                )}
                {app.attachments && app.attachments.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {app.attachments.map((url, i) => (
                      /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={url + i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="" style={{ width: 46, height: 46, borderRadius: 6, objectFit: "cover", border: "1px solid #242424" }} />
                        </a>
                      ) : (
                        <a key={url + i} href={url} target="_blank" rel="noopener noreferrer" style={{
                          display: "flex", alignItems: "center", gap: 5, background: "#161616",
                          border: "1px solid #242424", borderRadius: 6, padding: "5px 8px",
                          fontSize: 10, color: "#aaa", textDecoration: "none", maxWidth: 160,
                        }}>
                          <FileText size={12} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {(() => { try { return decodeURIComponent(url.split("/").pop() || "file").split("?")[0]; } catch { return "file"; } })()}
                          </span>
                        </a>
                      )
                    ))}
                  </div>
                )}
                {app.responseNote && <p style={{ margin: "3px 0 0", fontSize: 10, color: "#888" }}>{t("owner_offers.note_from_employer") || "Note:"} {app.responseNote}</p>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 10 }}>
                {app.status === "PENDING" && isOpen ? (
                  noteFor?.appId === app.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      <input
                        autoFocus
                        placeholder={t("owner_offers.optional_note_placeholder") || "Optional note…"}
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        style={{ background: "#0e0e0e", border: "1px solid #222", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#ccc", fontFamily: "inherit", width: 160, outline: "none" }}
                      />
                      <div style={{ display: "flex", gap: 4 }}>
                        <button disabled={busy === app.id} onClick={() => doAppAction(app.id, noteFor.action, noteText)}
                          style={{ background: noteFor.action === "ACCEPTED" ? "#22c55e" : "#ef4444", color: "#000", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {busy === app.id ? "…" : (t("owner_workers.confirm_btn") || "Confirm")}
                        </button>
                        <button onClick={() => { setNoteFor(null); setNoteText(""); }}
                          style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button disabled={!!busy || isFull}
                        title={isFull ? (t("owner_jobs.job_full") || "All requested workers have been hired") : undefined}
                        onClick={() => setNoteFor({ appId: app.id, action: "ACCEPTED" })}
                        style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: isFull ? "not-allowed" : "pointer", opacity: isFull ? 0.4 : 1, fontFamily: "inherit" }}>
                        {t("owner_offers.accept") || "Accept"}
                      </button>
                      <button disabled={!!busy} onClick={() => setNoteFor({ appId: app.id, action: "REJECTED" })}
                        style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("owner_offers.reject") || "Reject"}
                      </button>
                    </>
                  )
                ) : (
                  <span style={{
                    fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "3px 9px",
                    color: app.status === "ACCEPTED" ? "#22c55e" : app.status === "REJECTED" ? "#ef4444" : "#888",
                    background: app.status === "ACCEPTED" ? "rgba(34,197,94,0.08)" : app.status === "REJECTED" ? "rgba(239,68,68,0.08)" : "rgba(100,100,100,0.08)",
                  }}>{t("seeker_jobs.status_" + app.status.toLowerCase().replace(/\s+/g,"_")) || app.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : <p style={{ margin: 0, fontSize: 12, color: "#444" }}>{t("owner_offers.no_apps_desc") || "No applications yet."}</p>,
    },
    {
      done: hasAccepted, active: hasAccepted && !startPast,
      label: `${t("owner_analytics.workers_hired") || "Workers Hired"} (${accepted.length})`,
      date: accepted.length > 0 && accepted[0].respondedAt ? d(accepted[0].respondedAt, currentLocale) : undefined,
      content: hasAccepted ? (
        <div>
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
          {!isCompleted && (
            <button
              onClick={() => {
                startEmployerTracking(job.id, accepted[0]?.workerName || job.title, job.latitude ?? undefined, job.longitude ?? undefined);
              }}
              style={{
                marginTop: 10, display: "flex", alignItems: "center", gap: 6,
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.35)",
                color: "#22c55e", borderRadius: 999, padding: "7px 14px",
                fontSize: 11.5, fontWeight: 700, cursor: "pointer",
              }}
            >
              <MapPin size={12} /> {t("owner_jobs.track_worker") || "Track worker live"}
            </button>
          )}
        </div>
      ) : null,
    },
    {
      done: isCompleted || startPast, active: hasAccepted && startPast && !isCompleted,
      label: t("owner_jobs.in_progress") || "Job In Progress",
      date: job.startTime ? dt(job.startTime, currentLocale) : undefined,
      content: job.startTime ? (
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Calendar size={12} color="#666" />
            <span style={{ fontSize: 11, color: "#888" }}>{dt(job.startTime, currentLocale)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={12} color="#666" />
            <span style={{ fontSize: 11, color: "#888" }}>{job.durationHours}h {t("owner_jobs.duration") || "duration"}</span>
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
      label: t("owner_jobs.completed") || "Job Completed",
      date: d(job.completedAt, currentLocale),
      content: isCompleted ? (
        <div>
          {job.completionNotes && <p style={{ margin: 0, fontSize: 12, color: "#888", fontStyle: "italic" }}>"{job.completionNotes}"</p>}
        </div>
      ) : null,
    },
    {
      done: txn?.status === "RELEASED", active: isCompleted && txn?.status !== "RELEASED",
      label: t("owner_jobs.payment_released") || "Payment Released to Workers",
      date: txn?.releasedAt ? d(txn.releasedAt, currentLocale) : undefined,
      content: txn?.status === "RELEASED" && workerPayout != null ? (
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: "#444" }}>{t("owner_jobs.worker_payout") || "Worker payout"}</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#22c55e" }}>RWF {workerPayout.toLocaleString()}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: "#444" }}>{t("owner_jobs.per_worker") || "Per worker"} ({accepted.length || job.headcount})</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#d0d0d0" }}>
              RWF {Math.round(workerPayout / Math.max(1, accepted.length || job.headcount)).toLocaleString()}
            </p>
          </div>
        </div>
      ) : !isCompleted ? (
        <p style={{ margin: 0, fontSize: 12, color: "#333" }}>{t("owner_jobs.released_auto_desc") || "Released automatically when job is marked complete."}</p>
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
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .job-detail-grid { display:grid; grid-template-columns:1fr 340px; gap:20px; align-items:start; }
        @media (max-width: 900px) {
          .job-detail-grid { grid-template-columns:1fr; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push("/owner/offers")}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 12, fontFamily: "inherit", padding: 0, marginBottom: 14 }}>
          <ArrowLeft size={14} /> {t("owner_jobs.back_to_jobs") || "Back to My Jobs"}
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>{job.title}</h1>
              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "3px 10px", color: STATUS_COLOR[job.status] ?? "#888", background: `${STATUS_COLOR[job.status] ?? "#888"}18` }}>
                {t("seeker_jobs.status_" + job.status.toLowerCase().replace(/\s+/g,"_")) || job.status}
              </span>
              {job.applicationsClosed && (
                <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "3px 10px", color: "#f59e0b", background: "rgba(245,158,11,0.12)" }}>
                  {t("owner_jobs.applications_closed") || "Applications closed"}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#444" }}>{t("common.categories." + job.category.toLowerCase().replace(/\s+/g,"_")) || job.category} · {job.district} · {accepted.length}/{job.headcount} {Number(job.headcount) !== 1 ? (t("owner_offers.slots_plural") || "workers") : (t("owner_offers.slots") || "worker")} {t("settings_page.account.verified") || "hired"}</p>
          </div>
          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isOpen && pending.length > 0 && !isFull && (
              <button disabled={busy === "accept-all"} onClick={doAcceptAll}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {busy === "accept-all" ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <Users size={12} />}
                {t("owner_jobs.accept_all") || "Accept All"} ({Math.min(pending.length, slotsLeft)})
              </button>
            )}
            {isOpen && isFull && pending.length > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(100,100,100,0.08)", color: "#888", border: "1px solid #222", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700 }}>
                {t("owner_jobs.job_full") || "All workers hired"}
              </span>
            )}
            {isOpen && hasAccepted && (
              <button disabled={busy === "complete" || !job.workerVerified} onClick={() => job.workerVerified ? setShowComplete(true) : alert(t("owner_workers.wait_worker_verify_alert") || "Waiting for worker to verify completion")}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(96,165,250,0.08)", color: job.workerVerified ? "#60a5fa" : "#444", border: job.workerVerified ? "1px solid rgba(96,165,250,0.2)" : "1px solid #222", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: job.workerVerified ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                <CheckCircle size={12} /> {job.workerVerified ? (t("owner_jobs.complete_job") || "Complete Job") : (t("owner_workers.waiting_worker") || "Waiting for Worker")}
              </button>
            )}
            {isOpen && (
              <button disabled={!!busy} onClick={() => setShowEdit(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(249,115,22,0.08)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Edit2 size={12} /> {t("common.general.edit") || "Edit"}
              </button>
            )}
            {isOpen && (
              <button disabled={busy === "cancel"} onClick={doCancel}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {busy === "cancel" ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <Trash2 size={12} />}
                {t("owner_jobs.unpublish") || "Unpublish"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="job-detail-grid">
        {/* Left: Timeline */}
        <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 16, padding: "24px 28px" }}>
          <p style={{ margin: "0 0 24px", fontSize: 11, fontWeight: 700, color: "#333", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t("owner_jobs.timeline") || "Job Timeline"}
          </p>
          <Timeline stages={stages} />

          {token && hasAccepted && (
            <PaymentPanel jobId={id} role="employer" token={token} />
          )}

          {/* Proof of work the worker attached — read-only here. Hides itself when empty. */}
          {token && <JobEvidence jobId={id} canUpload={false} />}
        </div>

        {/* Right: Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Job details */}
          <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("owner_offers.job_details") || "Job Details"}</p>
            <InfoRow label={t("owner_offers.category") || "Category"} value={t("common.categories." + job.category.toLowerCase().replace(/\s+/g,"_")) || job.category} />
            <InfoRow label={t("seeker_jobs.label_location") || "Location"} value={`${job.district}${job.province ? `, ${job.province}` : ""}`} />
            {job.locationNotes && <InfoRow label={t("seeker_jobs.location_notes") || "Notes"} value={<RichTextDisplay content={job.locationNotes} />} />}
            <InfoRow label={t("owner_offers.rate") || "Rate"} value={`RWF ${job.ratePerHour?.toLocaleString()} / hr`} />
            <InfoRow label={t("owner_jobs.duration") || "Duration"} value={`${job.durationHours} hours`} />
            <InfoRow label={t("owner_offers.workers_needed") || "Headcount"} value={`${job.headcount} worker${job.headcount !== 1 ? "s" : ""}`} />
            <InfoRow label={t("owner_offers.urgency") || "Urgency"} value={job.urgency?.replace("_", " ")} />
            {job.startTime && <InfoRow label={t("owner_offers.start_time") || "Start Time"} value={dt(job.startTime, currentLocale) ?? "—"} />}
            {job.requirements && <InfoRow label={t("seeker_job_detail.requirements") || "Requirements"} value={<RichTextDisplay content={job.requirements} />} />}
          </div>

          {/* Auto-release toggle — editable anytime; affects future payment requests only. */}
          <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {t("owner_jobs.auto_release_title") || "Auto-release"}
            </p>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: busy === "autorelease" ? "wait" : "pointer" }}>
              <input type="checkbox" checked={!!job.directRelease} disabled={busy === "autorelease"}
                onChange={e => doToggleAutoRelease(e.target.checked)}
                style={{ marginTop: 2, accentColor: "#f97316", width: 16, height: 16 }} />
              <span style={{ fontSize: 12.5, color: "#bbb", lineHeight: 1.5 }}>
                {job.directRelease
                  ? (t("owner_jobs.auto_release_on_desc") || "On — you can approve payment requests, but if you don't act within 2 hours they auto-release.")
                  : (t("owner_jobs.auto_release_off_desc") || "Off — you must approve every payment request. Unapproved requests open a support case after 24 hours.")}
              </span>
            </label>
          </div>

          {/* Financial summary */}
          {txn && (
            <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("owner_jobs.escrow_summary") || "Escrow Summary"}</p>
              <InfoRow label={t("owner_jobs.total_escrowed") || "Total Escrowed"} value={<span style={{ color: "#f97316", fontWeight: 800 }}>RWF {escrowed?.toLocaleString()}</span>} />
              <InfoRow label={t("owner_jobs.worker_payout") || "Worker Payout"} value={`RWF ${workerPayout?.toLocaleString()}`} />
              <InfoRow label={t("owner_jobs.platform_fee_percent") || "Platform Fee (5%)"} value={`RWF ${platformFee?.toLocaleString()}`} />
              <InfoRow label={t("owner_jobs.payment_status") || "Payment Status"} value={
                <span style={{ color: txn.status === "RELEASED" ? "#22c55e" : txn.status === "REFUNDED" ? "#60a5fa" : "#f59e0b", fontWeight: 700 }}>
                  {txn.status}
                </span>
              } />
              {txn.releasedAt && <InfoRow label={t("owner_jobs.released") || "Released"} value={d(txn.releasedAt, currentLocale) ?? "—"} />}
              {txn.refundedAt && <InfoRow label={t("owner_jobs.refunded") || "Refunded"} value={d(txn.refundedAt, currentLocale) ?? "—"} />}
            </div>
          )}

          {/* Workers summary */}
          {accepted.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("owner_jobs.hired_workers") || "Hired Workers"}</p>
              {accepted.map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 99, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={13} color="#f97316" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#d0d0d0" }}>{a.workerName}</p>
                    <p style={{ margin: 0, fontSize: 10, color: "#444" }}>{a.workerDistrict ?? "—"} · Accepted {d(a.respondedAt, currentLocale)}</p>
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
            <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#fff" }}>{t("owner_jobs.mark_job_complete") || "Mark Job Complete"}</p>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "#555", lineHeight: 1.5 }}>
              {t("owner_jobs.complete_modal_desc", { amount: workerPayout?.toLocaleString() ?? "—" }) || `This will release RWF ${workerPayout?.toLocaleString() ?? "—"} to the worker(s). This action cannot be undone.`}
            </p>
            
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>{t("owner_workers.rating_required") || "RATING (REQUIRED)"}</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setRating(star)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: star <= rating ? "#f97316" : "#333", padding: 0 }}>
                  ★
                </button>
              ))}
            </div>

            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>{t("owner_workers.feedback_required") || "FEEDBACK (REQUIRED)"}</p>
            <select value={feedbackOption} onChange={e => setFeedbackOption(e.target.value)} style={{ ...inp, marginBottom: feedbackOption === "Other (requires text)" ? 10 : 18 }}>
              <option value="Excellent Work">{t("owner_workers.feedback_excellent") || "Excellent Work"}</option>
              <option value="Good Work">{t("owner_workers.feedback_good") || "Good Work"}</option>
              <option value="Needs Improvement">{t("owner_workers.feedback_improvement") || "Needs Improvement"}</option>
              <option value="Poor Work">{t("owner_workers.feedback_poor") || "Poor Work"}</option>
              <option value="Other (requires text)">{t("owner_workers.other_option") || "Other (requires text)"}</option>
            </select>
            {feedbackOption === "Other (requires text)" && (
              <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                rows={2} placeholder="Please describe..." style={{ ...inp, resize: "vertical", marginBottom: 18 }} />
            )}

            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>{t("owner_workers.completion_notes") || "COMPLETION NOTES (optional)"}</p>
            <textarea value={completionNote} onChange={e => setCompletionNote(e.target.value)}
              rows={2} placeholder="How did the job go?" style={{ ...inp, resize: "vertical", marginBottom: 18 }} />
            
            <div style={{ display: "flex", gap: 10 }}>
              <button disabled={busy === "complete"} onClick={doComplete}
                style={{ flex: 1, background: "#22c55e", color: "#000", border: "none", borderRadius: 9, padding: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {busy === "complete" ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <CheckCircle size={13} />} {t("owner_jobs.complete_and_release") || "Complete & Release Payment"}
              </button>
              <button onClick={() => setShowComplete(false)}
                style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #222", borderRadius: 9, padding: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {t("owner_workers.cancel") || "Cancel"}
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
  const { t } = useLanguage();
  const todayStr = new Date().toISOString().split("T")[0];
  const existingDate = job.startTime ? new Date(job.startTime).toISOString().split("T")[0] : "";
  const existingTime = job.startTime ? new Date(job.startTime).toTimeString().slice(0, 5) : "";

  // Once workers have applied/been hired, the sensitive terms (date, hours, headcount, urgency) are
  // locked — only title, location, description and requirements stay editable.
  const locked = ((job.acceptedCount ?? 0) + (job.pendingCount ?? 0)) > 0;

  const [form, setForm] = useState({
    title:         job.title ?? "",
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
      ...(form.title                       ? { title: form.title }                      : {}),
      // Sensitive fields are only sent when the job has no applicants yet.
      ...(!locked && startTime             ? { startTime }                              : {}),
      ...(!locked && form.durationHours    ? { durationHours: parseFloat(form.durationHours) } : {}),
      ...(!locked && form.headcount        ? { headcount: parseInt(form.headcount) }    : {}),
      ...(!locked && form.urgency          ? { urgency: form.urgency as any }           : {}),
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
          <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#fff" }}>{t("owner_jobs.edit_job") || "Edit Job"}</p>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#555" }}><X size={18} /></button>
        </div>
        <p style={{ margin:"0 0 16px", fontSize:12, color:"#444" }}>
          {t("owner_jobs.rate_locked_at", { rate: rate.toLocaleString() }) || `Rate locked at RWF ${rate.toLocaleString()}/hour`}
        </p>

        {locked && (
          <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:16 }}>
            <p style={{ margin:0, fontSize:12, color:"#eab308", lineHeight:1.5 }}>
              {t("owner_jobs.edit_locked_notice") || "Workers have already applied, so the date, hours, number of workers and urgency are locked. You can still update the title, location, description and requirements."}
            </p>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>{t("owner_jobs.title_label") || "Title"}</label>
          <input value={form.title} onChange={set("title")} style={s} placeholder={t("owner_jobs.title_ph") || "Job title"} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14, opacity: locked ? 0.5 : 1 }}>
          <div><label style={lbl}>{t("owner_jobs.start_date") || "Start Date"}</label><input type="date" min={todayStr} value={form.date} onChange={set("date")} style={s} disabled={locked} /></div>
          <div><label style={lbl}>{t("owner_jobs.start_time") || "Start Time"}</label><input type="time" value={form.time} onChange={set("time")} style={s} disabled={locked} /></div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14, opacity: locked ? 0.5 : 1 }}>
          <div>
            <label style={lbl}>{t("owner_jobs.duration_hours") || "Duration (hours)"}</label>
            <input type="number" min="0.5" step="0.5" value={form.durationHours} onChange={set("durationHours")} style={s} disabled={locked} />
          </div>
          <div>
            <label style={lbl}>{t("owner_jobs.workers_needed") || "Workers needed"}</label>
            <input type="number" min="1" max="200" value={form.headcount} onChange={set("headcount")} style={s} disabled={locked} />
          </div>
        </div>
        <div style={{ marginBottom:14, opacity: locked ? 0.5 : 1 }}>
          <label style={lbl}>{t("owner_jobs.urgency") || "Urgency"}</label>
          <select value={form.urgency} onChange={set("urgency")} style={s} disabled={locked}>
            <option value="SCHEDULED">{t("seeker_jobs.urgency_scheduled") || "Scheduled"}</option>
            <option value="SAME_DAY">{t("seeker_jobs.urgency_same_day") || "Same day"}</option>
            <option value="IMMEDIATE">{t("seeker_jobs.urgency_immediate") || "Immediate"}</option>
          </select>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <div>
            <label style={lbl}>{t("owner_jobs.province") || "Province"}</label>
            <select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value, district: "" }))} style={s}>
              <option value="">{t("common.general.select") || "Select…"}</option>
              {RWANDA_PROVINCES.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>{t("owner_jobs.district") || "District"}</label>
            <select value={form.district} onChange={set("district")} style={s} disabled={!form.province}>
              <option value="">{t("common.general.select") || "Select…"}</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>{t("owner_jobs.location_notes") || "Location notes"}</label>
          <RichTextEditor value={form.locationNotes} onChange={v => setForm(f => ({...f, locationNotes: v}))} placeholder="e.g. Gate B, 2nd floor…" />
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={lbl}>{t("owner_jobs.description") || "Description"}</label>
          <RichTextEditor value={form.description} onChange={v => setForm(f => ({...f, description: v}))} />
        </div>
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>{t("owner_jobs.requirements") || "Requirements"}</label>
          <RichTextEditor value={form.requirements} onChange={v => setForm(f => ({...f, requirements: v}))} />
        </div>

        {gross > 0 && (
          <div style={{ background:"#131313", border:"1px solid #1e1e1e", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:"#555" }}>{t("owner_jobs.gross_calc", { heads, hours, rate: rate.toLocaleString() }) || `Gross (${heads} × ${hours}h × RWF ${rate.toLocaleString()})`}</span>
              <span style={{ fontSize:11, color:"#888" }}>RWF {gross.toLocaleString()}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:"#555" }}>{t("owner_jobs.platform_fee_calc") || "Platform fee (25% from worker)"}</span>
              <span style={{ fontSize:11, color:"#ef4444" }}>−RWF {fee.toLocaleString()}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom: diff !== 0 ? 4 : 0 }}>
              <span style={{ fontSize:11, color:"#555" }}>{t("owner_jobs.workers_receive") || "Workers receive"}</span>
              <span style={{ fontSize:11, color:"#22c55e" }}>RWF {workerNet.toLocaleString()}</span>
            </div>
            {diff !== 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", borderTop:"1px solid #1e1e1e", paddingTop:6, marginTop:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#aaa" }}>{t("owner_jobs.escrow_change") || "Escrow change"}</span>
                <span style={{ fontSize:11, fontWeight:700, color: diff > 0 ? "#f97316" : "#22c55e" }}>
                  {diff > 0 ? "+" : ""}RWF {diff.toLocaleString()} {diff > 0 ? (t("owner_jobs.will_be_frozen") || "will be frozen") : (t("owner_jobs.will_be_refunded") || "will be refunded")}
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
            {t("owner_jobs.save_changes") || "Save Changes"}
          </button>
          <button onClick={onClose}
            style={{ flex:1, background:"transparent", color:"#555", border:"1px solid #222", borderRadius:9, padding:12, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            {t("owner_workers.cancel") || "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
