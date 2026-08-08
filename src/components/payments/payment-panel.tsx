"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPaymentSchedule, getJobActivity, requestPeriodPayment, type BillingMode,
  getIncomingPaymentRequests, getMyPaymentRequests,
  approvePaymentRequest, declinePaymentRequest, disputePaymentRequest,
  apiError,
  type PaymentScheduleDto, type ActivityLogDto, type PaymentRequestDto, type SchedulePeriod,
  type PayoutRequirement,
} from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";
import { ReasonModal } from "@/components/ui/reason-modal";
import { Countdown } from "./countdown";

const CURRENCY = "RWF";
const fmt = (n: number) => `${CURRENCY} ${Number(n || 0).toLocaleString()}`;
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";

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

export function PaymentPanel({ jobId, role, token, billingMode }: {
  jobId: string; role: "worker" | "employer"; token: string;
  /**
   * LISTING jobs are settled between employer and worker off-platform, so there is no schedule,
   * no approvals and no payout to show. Passing it here keeps that decision in one place instead
   * of each dashboard hiding pieces of the panel.
   */
  billingMode?: BillingMode | null;
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
        success(t("payments.toast_complaint") || "Complaint submitted - payment frozen");
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

  // Nothing about installments, approvals or payouts exists for a direct-payment job. Say so
  // plainly rather than rendering an empty payment table that implies something is pending.
  if (billingMode === "LISTING") {
    return (
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#fff" }}>
          {t("payments.direct_title") || "Paid directly"}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "#888", lineHeight: 1.65 }}>
          {role === "employer"
            ? (t("payments.direct_employer")
                || "You chose to pay this worker yourself, so MpahMapu holds no money for this job. There is nothing to approve or release here: agree the amount with the worker and pay them directly.")
            : (t("payments.direct_worker")
                || "This employer pays directly, so payment for this job is arranged between you and them. MpahMapu is not holding money for it, and no payout will arrive in your wallet.")}
        </p>
      </div>
    );
  }

  if (loading) return <div style={{ ...card, color: "#666", fontSize: 13 }}>{t("payments.loading") || "Loading payments…"}</div>;
  if (!schedule) return null;
  // Non-null alias so the nested render helpers below keep the narrowed type.
  const sd = schedule;

  const unitLabel = sd.paymentMode.replace("CUSTOM_", "").toLowerCase();
  const isEmployer = role === "employer";
  // Employer sees a section per accepted worker; the worker sees only their own schedule.
  const workerBlocks = isEmployer && sd.workers && sd.workers.length ? sd.workers : null;

  // Resolve the pending request behind a period (for the expiry countdown + action ids). For the
  // employer each period carries its own worker-scoped requestId; the worker has a single schedule.
  const requestForPeriod = (p: SchedulePeriod): PaymentRequestDto | undefined =>
    isEmployer ? requests.find(r => r.id === p.requestId) : reqFor(p.index);

  function RequirementBanner({ requirement }: { requirement?: PayoutRequirement | null }) {
    if (!requirement) return null;
    return (
      <div style={{
        background: requirement.met ? "rgba(34,197,94,0.08)" : "rgba(249,115,22,0.08)",
        border: `1px solid ${requirement.met ? "rgba(34,197,94,0.28)" : "rgba(249,115,22,0.32)"}`,
        borderRadius: 10, padding: "10px 12px", margin: "0 0 12px",
      }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
          color: requirement.met ? "#22c55e" : "#f97316", marginBottom: 4 }}>
          {requirement.met
            ? (t("payments.requirement_met") || "Payout requirement met")
            : (t("payments.requirement_title") || "Payout requirement")}
        </div>
        <div style={{ fontSize: 12, color: "#bbb", lineHeight: 1.55 }}>
          {requirement.message
            || `${t("payments.requirement_reach") || "Reach"} ${requirement.threshold} ${requirement.metricLabel} ${t("payments.requirement_to_unlock") || "to unlock these payments"}.`}
          {" "}
          <strong style={{ color: requirement.met ? "#22c55e" : "#f97316" }}>
            {requirement.progress} / {requirement.threshold}
          </strong>
          {requirement.proRata && !requirement.met && (
            <span style={{ color: "#777" }}> · {t("payments.requirement_prorata") || "partial progress pays a partial share"}</span>
          )}
        </div>
      </div>
    );
  }

  function PeriodRow({ p, keyPrefix }: { p: SchedulePeriod; keyPrefix?: string }) {
    const r = requestForPeriod(p);
    const color = STATE_COLORS[p.state] || "#888";
    const actId = p.requestId || r?.id || "";
    return (
      <div key={(keyPrefix || "") + p.index} style={row}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e8e8e8" }}>
            {(t("payments.period", { index: String(p.index) }) || `Period ${p.index}`)} · {fmt(p.amountRwf)}
            {p.fullAmountRwf != null && p.amountRwf < p.fullAmountRwf && !p.requirementBlocked && (
              <span style={{ fontSize: 11, fontWeight: 500, color: "#777" }}> {t("payments.of") || "of"} {fmt(p.fullAmountRwf)}</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: p.requirementBlocked ? "#f97316" : "#777", marginTop: 2 }}>
            {p.requirementBlocked
              ? (t("payments.requirement_blocked") || "Locked until the payout requirement above is met")
              : p.state === "LOCKED"
              ? `${t("payments.unlocks", { when: relative(p.unlockAt) }) || `Unlocks ${relative(p.unlockAt)}`} (${fmtDate(p.unlockAt)})`
              : (t("payments.completed", { when: fmtDate(p.unlockAt) }) || `Completed ${fmtDate(p.unlockAt)}`)}
            {p.state === "PENDING" && r?.expiresAt && (
              <> · {(sd.directRelease ? (t("payments.auto_approves_in") || "auto-approves in") : (t("payments.escalates_in") || "support case opens in"))} <Countdown to={r.expiresAt} /></>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <Badge label={stateLabel(p.state)} color={color} />
          {/* Worker actions */}
          {!isEmployer && p.requestable && (
            <button style={btn} disabled={busy === `req-${p.index}`} onClick={() => doRequest(p)}>
              {busy === `req-${p.index}` ? "…" : (t("payments.request_btn") || "Request payment")}
            </button>
          )}
          {!isEmployer && p.state === "PENDING" && actId && (
            <button style={btnGhost} disabled={busy === `di-${actId}`} onClick={() => doDispute(actId)}>
              {t("payments.complaint_btn") || "Complaint"}
            </button>
          )}
          {/* Employer actions - act on this worker's own request for this period */}
          {isEmployer && p.state === "PENDING" && actId && (
            <>
              <button style={btn} disabled={busy === `ap-${actId}`} onClick={() => doApprove(actId)}>
                {busy === `ap-${actId}` ? "…" : (t("payments.approve_btn") || "Approve")}
              </button>
              <button style={btnGhost} disabled={busy === `dc-${actId}`} onClick={() => doDecline(actId)}>
                {t("payments.decline_btn") || "Decline"}
              </button>
              <button style={btnGhost} disabled={busy === `di-${actId}`} onClick={() => doDispute(actId)}>
                {t("payments.complaint_btn") || "Complaint"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {workerBlocks ? (
        // ── Employer: one card per accepted worker ──────────────────────────────
        workerBlocks.map(w => {
          const paid  = w.periods.filter(p => p.state === "PAID").reduce((s, p) => s + (p.amountRwf || 0), 0);
          const total = w.periods.reduce((s, p) => s + (p.amountRwf || 0), 0);
          return (
            <div style={card} key={w.workerId}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "#f0f0f0", margin: 0 }}>{w.workerName}</h3>
                {sd.directRelease && <Badge label={t("payments.auto_release_on") || "Auto-release on"} color="#22c55e" />}
              </div>
              <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 8px" }}>
                {w.periods.length} × {unitLabel} · {fmt(paid)} / {fmt(total)} {t("payments.released") || "released"}
              </p>
              <RequirementBanner requirement={w.requirement} />
              {w.periods.map(p => <PeriodRow key={w.workerId + "-" + p.index} p={p} keyPrefix={w.workerId} />)}
            </div>
          );
        })
      ) : isEmployer ? (
        // Employer, but no accepted workers yet.
        <div style={{ ...card, color: "#666", fontSize: 13 }}>
          {t("payments.no_workers") || "No workers are on installments for this job yet."}
        </div>
      ) : (
        // ── Worker: their own schedule ──────────────────────────────────────────
        (() => {
          const periods = sd.periods || [];
          // Sum the per-period amounts - schedule.workerPayoutTotal is job-wide (all workers), so a
          // worker would otherwise see the whole job's payout instead of their own share.
          const perWorkerTotal    = periods.reduce((s, p) => s + (p.amountRwf || 0), 0);
          const perWorkerReleased = periods.filter(p => p.state === "PAID").reduce((s, p) => s + (p.amountRwf || 0), 0);
          return (
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "#f0f0f0", margin: 0 }}>
                  {t("payments.title") || "Installment payments"}
                </h3>
                {sd.directRelease && <Badge label={t("payments.auto_release_on") || "Auto-release on"} color="#22c55e" />}
              </div>
              <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 8px" }}>
                {t("payments.summary", {
                  count: String(periods.length), unit: unitLabel,
                  released: fmt(perWorkerReleased), total: fmt(perWorkerTotal),
                }) || `${periods.length} × ${unitLabel} · ${fmt(perWorkerReleased)} / ${fmt(perWorkerTotal)} released`}
              </p>
              <RequirementBanner requirement={sd.requirement} />
              {periods.map(p => <PeriodRow key={p.index} p={p} />)}
            </div>
          );
        })()
      )}

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
