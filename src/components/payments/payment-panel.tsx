"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPaymentSchedule, getJobActivity, requestPeriodPayment,
  getIncomingPaymentRequests, getMyPaymentRequests,
  approvePaymentRequest, declinePaymentRequest, disputePaymentRequest,
  apiError,
  type PaymentScheduleDto, type ActivityLogDto, type PaymentRequestDto, type SchedulePeriod,
} from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";
import { ReasonModal } from "@/components/ui/reason-modal";
import { Countdown } from "./countdown";

const CURRENCY = "RWF";
const fmt = (n: number) => `${CURRENCY} ${Number(n || 0).toLocaleString()}`;
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const card: React.CSSProperties = {
  background: "#131313", border: "1px solid #1c1c1c", borderRadius: 14, padding: 18, marginTop: 16,
};
const row: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
  padding: "12px 0", borderBottom: "1px solid #1a1a1a",
};
const btn: React.CSSProperties = {
  background: "#f97316", color: "#fff", border: "none", borderRadius: 8,
  padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};
const btnGhost: React.CSSProperties = {
  background: "#1a1a1a", color: "#ccc", border: "1px solid #2a2a2a", borderRadius: 8,
  padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};

const STATE_COLORS: Record<string, string> = {
  PAID: "#22c55e", AVAILABLE: "#f97316", PENDING: "#eab308",
  DISPUTED: "#ef4444", DECLINED: "#888", LOCKED: "#555", CANCELLED: "#888",
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color, background: `${color}22`,
      border: `1px solid ${color}44`, borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

export function PaymentPanel({ jobId, role, token }: {
  jobId: string; role: "worker" | "employer"; token: string;
}) {
  const { success, error: toastError } = useToast();
  const { t } = useLanguage();
  const [schedule, setSchedule] = useState<PaymentScheduleDto | null>(null);
  const [requests, setRequests] = useState<PaymentRequestDto[]>([]);
  const [activity, setActivity] = useState<ActivityLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Localized relative-time helper ("in 3d" / "2h ago").
  const relative = (s: string) => {
    const diff = new Date(s).getTime() - Date.now();
    const abs = Math.abs(diff);
    const mins = Math.round(abs / 60000), hrs = Math.round(abs / 3.6e6), days = Math.round(abs / 8.64e7);
    const v = days >= 1 ? `${days}d` : hrs >= 1 ? `${hrs}h` : `${mins}m`;
    return diff >= 0 ? (t("payments.rel_in", { v }) || `in ${v}`) : (t("payments.rel_ago", { v }) || `${v} ago`);
  };
  const stateLabel = (s: string) => t("payments.state_" + s) || s;

  const load = useCallback(async () => {
    try {
      const [sched, acts, reqs] = await Promise.all([
        getPaymentSchedule(jobId, token).catch(() => null),
        getJobActivity(jobId, token).catch(() => []),
        (role === "employer" ? getIncomingPaymentRequests(token) : getMyPaymentRequests(token))
          .then(rs => rs.filter(r => r.jobId === jobId)).catch(() => []),
      ]);
      setSchedule(sched);
      setActivity(acts);
      setRequests(reqs);
    } finally {
      setLoading(false);
    }
  }, [jobId, role, token]);

  useEffect(() => { load(); }, [load]);

  const reqFor = (index: number) => requests.find(r => r.periodIndex === index);

  async function doRequest(period: SchedulePeriod) {
    setBusy(`req-${period.index}`);
    try {
      await requestPeriodPayment(jobId, period.index, token);
      success(t("payments.toast_requested") || "Payment requested");
      await load();
    } catch (e) { toastError(apiError(e, t("payments.err_request") || "Couldn't request payment")); }
    finally { setBusy(null); }
  }
  async function doApprove(id: string) {
    setBusy(`ap-${id}`);
    try { await approvePaymentRequest(id, token); success(t("payments.toast_approved") || "Payment approved & released"); await load(); }
    catch (e) { toastError(apiError(e, t("payments.err_approve") || "Couldn't approve")); } finally { setBusy(null); }
  }
  // Reason prompts render as an in-app modal (see ReasonModal) rather than
  // window.prompt, which shows a bare "www.mpahmapu.com says" browser dialog.
  const [reasonFor, setReasonFor] = useState<{ id: string; kind: "decline" | "dispute" } | null>(null);

  async function submitReason(reason: string) {
    if (!reasonFor) return;
    const { id, kind } = reasonFor;
    setBusy(kind === "decline" ? `dc-${id}` : `di-${id}`);
    try {
      if (kind === "decline") {
        await declinePaymentRequest(id, reason, token);
        success(t("payments.toast_declined") || "Payment declined");
      } else {
        await disputePaymentRequest(id, reason, token);
        success(t("payments.toast_complaint") || "Complaint submitted — payment frozen");
      }
      setReasonFor(null);
      await load();
    } catch (e) {
      toastError(apiError(e, kind === "decline"
        ? (t("payments.err_decline") || "Couldn't decline")
        : (t("payments.err_complaint") || "Couldn't submit complaint")));
    } finally { setBusy(null); }
  }

  function doDecline(id: string) { setReasonFor({ id, kind: "decline" }); }
  function doDispute(id: string) { setReasonFor({ id, kind: "dispute" }); }

  if (loading) return <div style={{ ...card, color: "#666", fontSize: 13 }}>{t("payments.loading") || "Loading payments…"}</div>;
  if (!schedule) return null;

  const periods = schedule.periods || [];
  const unitLabel = schedule.paymentMode.replace("CUSTOM_", "").toLowerCase();

  return (
    <>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#f0f0f0", margin: 0 }}>
            {t("payments.title") || "Installment payments"}
          </h3>
          {schedule.directRelease && <Badge label={t("payments.auto_release_on") || "Auto-release on"} color="#22c55e" />}
        </div>
        <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 8px" }}>
          {t("payments.summary", {
            count: String(periods.length), unit: unitLabel,
            released: fmt(schedule.releasedTotal), total: fmt(schedule.workerPayoutTotal),
          }) || `${periods.length} × ${unitLabel} · ${fmt(schedule.releasedTotal)} / ${fmt(schedule.workerPayoutTotal)} released`}
        </p>

        {periods.map(p => {
          const r = reqFor(p.index);
          const color = STATE_COLORS[p.state] || "#888";
          return (
            <div key={p.index} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e8e8e8" }}>
                  {(t("payments.period", { index: String(p.index) }) || `Period ${p.index}`)} · {fmt(p.amountRwf)}
                </div>
                <div style={{ fontSize: 11.5, color: "#777", marginTop: 2 }}>
                  {p.state === "LOCKED"
                    ? `${t("payments.unlocks", { when: relative(p.unlockAt) }) || `Unlocks ${relative(p.unlockAt)}`} (${fmtDate(p.unlockAt)})`
                    : (t("payments.completed", { when: fmtDate(p.unlockAt) }) || `Completed ${fmtDate(p.unlockAt)}`)}
                  {r?.status === "PENDING" && r.expiresAt && (
                    <> · {(schedule.directRelease ? (t("payments.auto_approves_in") || "auto-approves in") : (t("payments.escalates_in") || "support case opens in"))} <Countdown to={r.expiresAt} /></>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <Badge label={stateLabel(p.state)} color={color} />
                {/* Worker actions */}
                {role === "worker" && p.requestable && (
                  <button style={btn} disabled={busy === `req-${p.index}`} onClick={() => doRequest(p)}>
                    {busy === `req-${p.index}` ? "…" : (t("payments.request_btn") || "Request payment")}
                  </button>
                )}
                {role === "worker" && r?.status === "PENDING" && (
                  <button style={btnGhost} disabled={busy === `di-${r.id}`} onClick={() => doDispute(r.id)}>
                    {t("payments.complaint_btn") || "Complaint"}
                  </button>
                )}
                {/* Employer actions */}
                {role === "employer" && r?.status === "PENDING" && (
                  <>
                    <button style={btn} disabled={busy === `ap-${r.id}`} onClick={() => doApprove(r.id)}>
                      {busy === `ap-${r.id}` ? "…" : (t("payments.approve_btn") || "Approve")}
                    </button>
                    <button style={btnGhost} disabled={busy === `dc-${r.id}`} onClick={() => doDecline(r.id)}>
                      {t("payments.decline_btn") || "Decline"}
                    </button>
                    <button style={btnGhost} disabled={busy === `di-${r.id}`} onClick={() => doDispute(r.id)}>
                      {t("payments.complaint_btn") || "Complaint"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity timeline */}
      <JobTimeline activity={activity} title={t("payments.activity_title") || "Activity history"} />

      <ReasonModal
        open={!!reasonFor}
        danger={reasonFor?.kind === "dispute"}
        required={reasonFor?.kind === "dispute"}
        busy={!!busy}
        title={reasonFor?.kind === "dispute"
          ? (t("payments.complaint_title") || "Raise a complaint")
          : (t("payments.decline_title") || "Decline this payment")}
        description={reasonFor?.kind === "dispute"
          ? (t("payments.complaint_prompt") || "Describe your complaint. The money stays frozen until an agent reviews it.")
          : (t("payments.decline_prompt") || "Tell the worker why, so they can fix it and resubmit. Optional.")}
        placeholder={reasonFor?.kind === "dispute"
          ? (t("payments.complaint_placeholder") || "What went wrong?")
          : (t("payments.decline_placeholder") || "Reason (optional)")}
        confirmLabel={reasonFor?.kind === "dispute"
          ? (t("payments.complaint_btn") || "Submit complaint")
          : (t("payments.decline_btn") || "Decline")}
        cancelLabel={t("common.general.cancel") || "Cancel"}
        onConfirm={submitReason}
        onCancel={() => setReasonFor(null)}
      />
    </>
  );
}

export function JobTimeline({ activity, title }: { activity: ActivityLogDto[]; title?: string }) {
  if (!activity || activity.length === 0) return null;
  return (
    <div style={card}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#f0f0f0", margin: "0 0 12px" }}>{title || "Activity history"}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {activity.map((a, i) => (
          <div key={a.id} style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14, flexShrink: 0 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#f97316", marginTop: 5 }} />
              {i < activity.length - 1 && <div style={{ width: 2, flex: 1, background: "#1c1c1c", marginTop: 3 }} />}
            </div>
            <div style={{ paddingBottom: i < activity.length - 1 ? 16 : 0, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: "#ddd", lineHeight: 1.5 }}>{a.message}</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                {a.actorName} · {fmtDate(a.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
