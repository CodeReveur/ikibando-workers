"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Check, Clock, MapPin, User,
  Calendar, Loader2, DollarSign, CheckCircle, X, Wallet, Star, Navigation,
} from "lucide-react";
import {
  getJob, getMyApplications, getWalletTransactions,
  updateApplicationStatus, withdrawApplication, verifyJobCompletion,
  workerNetHourly, workerNetTotal,
  type JobDto, type ApplicationDto, type PaymentDto,
} from "@/lib/api";
import { ratingLabel } from "@/lib/rating";
import { rateUnit, durationLabel } from "@/lib/rate-unit";
import { categoryLabel } from "@/lib/browse-taxonomy";
import { fmt } from "@/lib/dashboard-data";
import { RichTextDisplay } from "@/components/ui/rich-text-editor";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/components/ui/toast";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { JobEvidence } from "@/components/jobs/job-evidence";
import { PaymentModeInfo } from "@/components/payments/payment-mode-info";
import { startWorkerNav } from "@/components/nav/live-nav";

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
  const { t, language } = useLanguage();
  const { success: toastSuccess, error: toastError } = useToast();

  const dateLocaleMap: Record<string, string> = {
    rw: "rw-RW",
    kinyy: "rw-RW",
    sw: "sw-TZ",
    fr: "fr-FR",
    en: "en-US",
  };
  const currentLocale = dateLocaleMap[language] || "en-RW";

  const d  = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(currentLocale, { day: "numeric", month: "short", year: "numeric" }) : null;
  const dt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(currentLocale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  const [job,    setJob]    = useState<JobDto | null>(null);
  const [app,    setApp]    = useState<ApplicationDto | null>(null);
  const [txn,    setTxn]    = useState<PaymentDto | null>(null);
  const [token,  setToken]  = useState<string | null>(null);
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
    setToken(token);
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
      toastSuccess(status === "ACCEPTED"
        ? (t("seeker_job_detail.decision_accept_success") || "Offer accepted successfully!")
        : (t("seeker_job_detail.decision_reject_success") || "Offer declined successfully.")
      );
    } catch (e: any) {
      toastError(t("seeker_job_detail.decision_fail") || "Failed to update offer status.");
    } finally { setBusy(null); }
  };

  const doWithdraw = async () => {
    if (!app || !confirm("Withdraw your application?")) return;
    const token = localStorage.getItem("access_token")!;
    setBusy("withdraw");
    try {
      await withdrawApplication(app.id, token);
      toastSuccess(t("seeker_job_detail.withdraw_success") || "Application withdrawn successfully.");
      router.push("/seeker/applications");
    } catch (e: any) {
      toastError(t("seeker_job_detail.withdraw_fail") || "Failed to withdraw application.");
    } finally { setBusy(null); }
  };

  const doVerify = async () => {
    if (!badgeId.trim()) {
      toastError(t("seeker_job_detail.badge_required") || "Badge ID is required.");
      return;
    }
    const token = localStorage.getItem("access_token")!;
    setBusy("verify");
    try {
      const payload: any = { badgeId, feedbackOption, rating };
      if (feedbackOption === "Other (requires text)") payload.feedbackText = feedbackText;
      const updated = await verifyJobCompletion(id, payload, token);
      setJob(updated);
      setShowVerify(false);
      await load();
      toastSuccess(t("seeker_job_detail.verify_success") || "Job completion verified successfully!");
    } catch (e: any) {
      toastError(t("seeker_job_detail.verify_fail") || "Verification failed. Please check your badge ID.");
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
      label: isHireNow ? t("seeker_job_detail.direct_offer_recv") : t("seeker_job_detail.you_applied"),
      date: d(app?.createdAt),
      content: app ? (
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
            {isHireNow ? t("seeker_job_detail.direct_offer_desc") : t("seeker_job_detail.applied_desc")}
            {app.createdAt ? ` ${t("common.general.on") || "on"} ${d(app.createdAt)}` : ""}
          </p>
          {app.bestFit && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#888", fontStyle: "italic" }}>
              {t("seeker_job_detail.your_note")} "{app.bestFit}"
            </p>
          )}
        </div>
      ) : null,
    },
    {
      done: isViewed || !!appStatus && appStatus !== "PENDING", active: isViewed && isPending,
      label: isViewed ? t("seeker_job_detail.employer_reviewed") : t("seeker_job_detail.awaiting_review"),
      date: isViewed && app?.respondedAt ? d(app.respondedAt) : undefined,
      content: !isViewed && isPending ? (
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>{t("seeker_job_detail.in_queue_desc")}</p>
      ) : null,
    },
    {
      done: !isPending, active: isPending && isViewed,
      label: !isPending
        ? `${t("seeker_jobs.tab_all") || "Application"} ${
            appStatus === "ACCEPTED"
              ? (t("settings_page.account.verified") || "Accepted")
              : appStatus === "REJECTED"
              ? (t("common.general.rejected") || "Rejected")
              : (t("seeker_job_detail.app_withdrawn") || "Withdrawn")
          }`
        : t("seeker_job_detail.awaiting_decision"),
      date: app?.respondedAt ? d(app.respondedAt) : undefined,
      content: !isPending ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: app?.responseNote ? 6 : 0 }}>
            {isAccepted
              ? <CheckCircle size={14} color="#22c55e" />
              : <X size={14} color="#ef4444" />}
            <span style={{ fontSize: 12, fontWeight: 700, color: isAccepted ? "#22c55e" : "#ef4444" }}>
              {isAccepted ? t("seeker_job_detail.got_job") : appStatus === "REJECTED" ? t("seeker_job_detail.not_selected") : t("seeker_job_detail.app_withdrawn")}
            </span>
          </div>
          {app?.responseNote && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#888", fontStyle: "italic" }}>
              {t("seeker_job_detail.employer_note")} "{app.responseNote}"
            </p>
          )}
        </div>
      ) : isPending && isHireNow ? (
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>{t("seeker_job_detail.decline_btn_desc")}</p>
      ) : null,
    },
    {
      done: isAccepted && (startPast || isCompleted), active: isAccepted && !startPast && !isCompleted,
      label: t("seeker_job_detail.job_scheduled"),
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
            <span style={{ fontSize: 11, color: "#888" }}>{durationLabel(job)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={12} color="#666" />
            <span style={{ fontSize: 11, color: "#888" }}>{job.district}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <DollarSign size={12} color="#666" />
            {/* The worker's net - never the employer's posting price. */}
            <span style={{ fontSize: 11, color: "#888" }}>RWF {workerNetHourly(job).toLocaleString()} / {rateUnit(job).short}</span>
          </div>
        </div>
      ) : null,
    },
    {
      done: isCompleted, active: isAccepted && startPast && !isCompleted,
      label: t("seeker_job_detail.job_completed"),
      date: d(job.completedAt),
      content: isCompleted ? (
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#888" }}>
            {t("seeker_job_detail.marked_complete_by_employer")}{job.completedAt ? ` ${t("common.general.on") || "on"} ${d(job.completedAt)}` : ""}.
          </p>
          {job.completionNotes && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#666", fontStyle: "italic" }}>"{job.completionNotes}"</p>
          )}
        </div>
      ) : null,
    },
    {
      done: isReleased, active: isCompleted && !isReleased,
      label: isReleased ? t("seeker_job_detail.payment_received") : t("seeker_job_detail.payment_pending"),
      date: txn?.releasedAt ? d(txn.releasedAt) : undefined,
      content: myPayout != null ? (
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 10, color: "#444" }}>{t("seeker_job_detail.your_earnings")}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: isReleased ? "#22c55e" : "#f97316" }}>
              {isReleased ? "+" : ""}RWF {myPayout.toLocaleString()}
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 10, color: "#444" }}>{t("seeker_job_detail.status")}</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: isReleased ? "#22c55e" : "#f59e0b" }}>
              {isReleased ? t("seeker_job_detail.in_your_wallet") : t("seeker_job_detail.held_in_escrow")}
            </span>
          </div>
        </div>
      ) : isAccepted && !isCompleted ? (
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
          {t("seeker_job_detail.payment_released_desc")}
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
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .job-detail-grid { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 20px; align-items: start; }
        @media (max-width: 900px) {
          .job-detail-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 340px) {
          .job-detail-grid { gap: 10px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 12, fontFamily: "inherit", padding: 0, marginBottom: 14 }}>
          <ArrowLeft size={14} /> {t("seeker_job_detail.back")}
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>{job.title}</h1>
              {appStatus && (
                <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "3px 10px", color: STATUS_COLOR[appStatus] ?? "#888", background: `${STATUS_COLOR[appStatus] ?? "#888"}18` }}>
                  {appStatus === "ACCEPTED" ? (t("settings_page.account.verified") || "ACCEPTED") : appStatus === "REJECTED" ? (t("common.general.rejected") || "REJECTED") : appStatus}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#444" }}>
              {t("common.general.by") || "by"} {job.employerName} · {categoryLabel(job.category, t)} · {job.district}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isPending && isHireNow && (
              showNote ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input placeholder={t("common.general.optional_message") || "Optional message…"} value={note} onChange={e => setNote(e.target.value)}
                    style={{ ...inp, width: 180 }} />
                  <button disabled={!!busy} onClick={() => doDecision(showNote)}
                    style={{ background: showNote === "ACCEPTED" ? "#22c55e" : "#ef4444", color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                    {busy ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : null}
                    {showNote === "ACCEPTED" ? t("seeker_job_detail.confirm_accept") : t("seeker_job_detail.confirm_decline")}
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
                    <CheckCircle size={12} /> {t("seeker_job_detail.accept_offer")}
                  </button>
                  <button disabled={!!busy} onClick={() => setShowNote("REJECTED")}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    <X size={12} /> {t("seeker_job_detail.decline")}
                  </button>
                </>
              )
            )}
            {isPending && !isHireNow && (
              <button disabled={busy === "withdraw"} onClick={doWithdraw}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {busy === "withdraw" ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <X size={12} />} {t("seeker_job_detail.withdraw_app")}
              </button>
            )}
            {isAccepted && !job.workerVerified && !isCompleted && (
              <button disabled={busy === "verify"} onClick={() => setShowVerify(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <CheckCircle size={12} /> {t("seeker_job_detail.finish")}
              </button>
            )}
            {job.workerVerified && !isCompleted && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", padding: "8px 14px", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, background: "rgba(34,197,94,0.08)" }}>
                {t("seeker_job_detail.finished_waiting")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="job-detail-grid">
        {/* Left: Timeline */}
        <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 16, padding: "24px 28px" }}>
          <p style={{ margin: "0 0 24px", fontSize: 11, fontWeight: 700, color: "#333", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t("seeker_job_detail.app_timeline")}
          </p>
          <Timeline stages={stages} />

          {token && appStatus === "ACCEPTED" && (
            <PaymentPanel jobId={id} role="worker" token={token} billingMode={job?.billingMode} />
          )}

          {/* Optional proof of work - the worker uploads, employer and admins can review. */}
          {token && isAccepted && <JobEvidence jobId={id} canUpload />}
        </div>

        {/* Right: Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Employer */}
          <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("seeker_job_detail.employer")}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 99, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={16} color="#f97316" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#d0d0d0" }}>{job.employerName}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#444", display: "flex", alignItems: "center", gap: 4 }}>
                  <Star size={10} color="#f97316" fill="#f97316" />
                  {ratingLabel(job.employerRatingAvg, job.employerRatingCount)} · {job.district}
                </p>
              </div>
            </div>
          </div>

          {/* Job details */}
          <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("seeker_job_detail.job_details")}</p>
            <InfoRow label={t("seeker_job_detail.category")} value={categoryLabel(job.category, t)} />
            <InfoRow label={t("seeker_job_detail.location")} value={`${job.district}${job.province ? `, ${job.province}` : ""}`} />
            {(job.street || job.houseNumber) && (
              <InfoRow
                label={t("seeker_job_detail.address") || "Street / House"}
                value={[job.houseNumber, job.street].filter(Boolean).join(" ")}
              />
            )}
            {job.locationNotes && <InfoRow label={t("seeker_job_detail.location_notes")} value={<RichTextDisplay content={job.locationNotes} />} />}
            <InfoRow label={t("seeker_job_detail.rate")} value={`RWF ${workerNetHourly(job).toLocaleString()} / ${rateUnit(job).short}`} />
            <InfoRow label={t("seeker_job_detail.duration")} value={durationLabel(job)} />
            <InfoRow label={t("seeker_job_detail.headcount")} value={`${job.headcount} ${job.headcount !== 1 ? t("seeker_job_detail.workers") : t("seeker_job_detail.worker")}`} />
            {job.workerPayout != null && job.headcount > 0 && (
              <InfoRow
                label={t("seeker_job_detail.take_home") || "You'll earn (all charges covered)"}
                value={<span style={{ color: "#22c55e", fontWeight: 700 }}>RWF {Math.round(job.workerPayout / job.headcount).toLocaleString()}</span>}
              />
            )}
            <InfoRow label={t("seeker_job_detail.urgency")} value={job.urgency?.replace("_", " ")} />
            {job.startTime && <InfoRow label={t("seeker_job_detail.start_time")} value={dt(job.startTime) ?? "-"} />}
            {job.requirements && <InfoRow label={t("seeker_job_detail.requirements")} value={<RichTextDisplay content={job.requirements} />} />}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1a1a1a" }}>
              <PaymentModeInfo
                paymentMode={job.paymentMode}
                paymentPeriods={job.paymentPeriods}
                paymentInterval={job.paymentInterval}
                durationUnits={job.durationHours}
                directRelease={job.directRelease}
              />
            </div>

            {/* Track the way - live turn-by-turn navigation, available to every worker */}
            <button
              onClick={() => router.push(`/seeker/jobs/${job.id}/navigate`)}
              style={{
                width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "#f97316", color: "#fff", border: "none", borderRadius: 10,
                padding: "12px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <Navigation size={15} /> {t("seeker_job_detail.track_the_way") || "Track the way - live navigation"}
            </button>

            {/* Consent: only an accepted worker can let the employer follow the trip,
                and only if they choose to. Off by default. */}
            {isAccepted && (
              <button
                onClick={() => {
                  const label = job.address || [job.village, job.sector, job.district].filter(Boolean).join(", ") || job.district;
                  startWorkerNav(job.id, label, job.latitude ?? undefined, job.longitude ?? undefined, true);
                  toastSuccess(
                    t("seeker_job_detail.share_started") ||
                    "Your employer can now follow your trip. Turn it off any time from the tracking card.");
                }}
                style={{
                  width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: "transparent", color: "#22c55e", border: "1px solid rgba(34,197,94,0.4)",
                  borderRadius: 10, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <MapPin size={14} />
                {t("seeker_job_detail.share_location") || "Let the employer track me on the way"}
              </button>
            )}
          </div>

          {/* Earnings */}
          {isAccepted && (
            <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("seeker_job_detail.your_earnings")}</p>
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <p style={{ margin: "0 0 4px", fontSize: 32, fontWeight: 900, color: isReleased ? "#22c55e" : "#f97316" }}>
                  {/* Fallback used to be gross (rate x hours) - that overstated earnings. */}
                  RWF {(myPayout != null ? myPayout : workerNetTotal(job)).toLocaleString()}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#444" }}>
                  {isReleased
                    ? `${t("seeker_jobs.released_to_wallet") || "Paid to your wallet"} ${t("common.general.on") || "on"} ${d(txn?.releasedAt)}`
                    : myPayout != null
                    ? t("seeker_job_detail.released_on_completion")
                    : `${t("seeker_job_detail.estimated")} · RWF ${job.ratePerHour?.toLocaleString()} × ${durationLabel(job)}`}
                </p>
              </div>
              {isReleased && (
                <button onClick={() => router.push("/seeker/earnings")}
                  style={{ width: "100%", marginTop: 12, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Wallet size={12} /> {t("seeker_job_detail.view_in_earnings")}
                </button>
              )}
            </div>
          )}

          {/* Job status badge */}
          <div style={{ background: "#111", border: "1px solid #1c1c1c", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, background: job.status === "OPEN" ? "#22c55e" : job.status === "COMPLETED" ? "#60a5fa" : "#ef4444", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              {t("seeker_job_detail.job_is")} <strong style={{ color: "#aaa" }}>{job.status}</strong>
              {isCompleted && job.completedAt ? ` · ${t("seeker_job_detail.completed_on")} ${d(job.completedAt)}` : ""}
              {isCancelled ? ` - ${t("seeker_job_detail.job_cancelled")}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Verify modal */}
      {showVerify && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 18, width: "100%", maxWidth: 420, padding: 28 }}>
            <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#fff" }}>{t("seeker_job_detail.finish_job_modal")}</p>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "#555" }}>
              {t("seeker_job_detail.confirm_finish_desc")}
            </p>
            
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>{t("seeker_job_detail.badge_id_req")}</p>
            <input value={badgeId} onChange={e => setBadgeId(e.target.value)}
              placeholder="e.g. MPU-12345" style={{ ...inp, width: "100%", marginBottom: 18, textTransform: "uppercase" }} />
              
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>{t("seeker_job_detail.rate_employer_req")}</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setRating(star)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: star <= rating ? "#f97316" : "#333", padding: 0 }}>
                  ★
                </button>
              ))}
            </div>

            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a" }}>{t("seeker_job_detail.feedback_req")}</p>
            <select value={feedbackOption} onChange={e => setFeedbackOption(e.target.value)} style={{ ...inp, width: "100%", marginBottom: feedbackOption === "Other (requires text)" ? 10 : 18 }}>
              <option value="Pays on time">{t("seeker_job_detail.pays_on_time") || "Pays on time"}</option>
              <option value="Good instructor">{t("seeker_job_detail.good_instructor") || "Good instructor"}</option>
              <option value="Gives tips">{t("seeker_job_detail.gives_tips") || "Gives tips"}</option>
              <option value="Needs Improvement">{t("seeker_job_detail.needs_improvement") || "Needs Improvement"}</option>
              <option value="Other (requires text)">{t("seeker_job_detail.other_option") || "Other (requires text)"}</option>
            </select>
            {feedbackOption === "Other (requires text)" && (
              <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                rows={2} placeholder={t("seeker_job_detail.please_describe") || "Please describe..."} style={{ ...inp, width: "100%", resize: "vertical", marginBottom: 18 }} />
            )}
            
            <div style={{ display: "flex", gap: 10 }}>
              <button disabled={busy === "verify"} onClick={doVerify}
                style={{ flex: 1, background: "#22c55e", color: "#000", border: "none", borderRadius: 9, padding: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {busy === "verify" ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <CheckCircle size={13} />} {t("seeker_job_detail.finish")}
              </button>
              <button onClick={() => setShowVerify(false)}
                style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #222", borderRadius: 9, padding: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {t("seeker_job_detail.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
