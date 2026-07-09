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
import { Countdown } from "./countdown";

const CURRENCY = "RWF";
const fmt = (n: number) => `${CURRENCY} ${Number(n || 0).toLocaleString()}`;
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
const relative = (s: string) => {
  const diff = new Date(s).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000), hrs = Math.round(abs / 3.6e6), days = Math.round(abs / 8.64e7);
  const unit = days >= 1 ? `${days}d` : hrs >= 1 ? `${hrs}h` : `${mins}m`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
};

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
  const [schedule, setSchedule] = useState<PaymentScheduleDto | null>(null);
  const [requests, setRequests] = useState<PaymentRequestDto[]>([]);
  const [activity, setActivity] = useState<ActivityLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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
      success("Payment requested");
      await load();
    } catch (e) { toastError(apiError(e, "Couldn't request payment")); }
    finally { setBusy(null); }
  }
  async function doApprove(id: string) {
    setBusy(`ap-${id}`);
    try { await approvePaymentRequest(id, token); success("Payment approved & released"); await load(); }
    catch (e) { toastError(apiError(e, "Couldn't approve")); } finally { setBusy(null); }
  }
  async function doDecline(id: string) {
    const reason = window.prompt("Reason for declining (optional):") ?? "";
    setBusy(`dc-${id}`);
    try { await declinePaymentRequest(id, reason, token); success("Payment declined"); await load(); }
    catch (e) { toastError(apiError(e, "Couldn't decline")); } finally { setBusy(null); }
  }
  async function doDispute(id: string) {
    const reason = window.prompt("Describe your complaint. The money will be frozen until an agent reviews it:");
    if (reason === null) return;
    setBusy(`di-${id}`);
    try { await disputePaymentRequest(id, reason, token); success("Complaint submitted — payment frozen"); await load(); }
    catch (e) { toastError(apiError(e, "Couldn't submit complaint")); } finally { setBusy(null); }
  }

  if (loading) return <div style={{ ...card, color: "#666", fontSize: 13 }}>Loading payments…</div>;
  if (!schedule) return null;

  const periods = schedule.periods || [];
  const unitLabel = schedule.paymentMode.replace("CUSTOM_", "").toLowerCase();

  return (
    <>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#f0f0f0", margin: 0 }}>
            Installment payments
          </h3>
          {schedule.directRelease && <Badge label="Auto-release on" color="#22c55e" />}
        </div>
        <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 8px" }}>
          {periods.length} {unitLabel} period{periods.length !== 1 ? "s" : ""} ·
          {" "}{fmt(schedule.releasedTotal)} of {fmt(schedule.workerPayoutTotal)} released
        </p>

        {periods.map(p => {
          const r = reqFor(p.index);
          const color = STATE_COLORS[p.state] || "#888";
          return (
            <div key={p.index} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e8e8e8" }}>
                  Period {p.index} · {fmt(p.amountRwf)}
                </div>
                <div style={{ fontSize: 11.5, color: "#777", marginTop: 2 }}>
                  {p.state === "LOCKED"
                    ? `Unlocks ${relative(p.unlockAt)} (${fmtDate(p.unlockAt)})`
                    : `Completed ${fmtDate(p.unlockAt)}`}
                  {r?.status === "PENDING" && r.expiresAt && (
                    <> · auto-approves in <Countdown to={r.expiresAt} /></>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <Badge label={p.state} color={color} />
                {/* Worker actions */}
                {role === "worker" && p.requestable && (
                  <button style={btn} disabled={busy === `req-${p.index}`} onClick={() => doRequest(p)}>
                    {busy === `req-${p.index}` ? "…" : `Request payment`}
                  </button>
                )}
                {role === "worker" && r?.status === "PENDING" && (
                  <button style={btnGhost} disabled={busy === `di-${r.id}`} onClick={() => doDispute(r.id)}>
                    Complaint
                  </button>
                )}
                {/* Employer actions */}
                {role === "employer" && r?.status === "PENDING" && (
                  <>
                    <button style={btn} disabled={busy === `ap-${r.id}`} onClick={() => doApprove(r.id)}>
                      {busy === `ap-${r.id}` ? "…" : "Approve"}
                    </button>
                    <button style={btnGhost} disabled={busy === `dc-${r.id}`} onClick={() => doDecline(r.id)}>
                      Decline
                    </button>
                    <button style={btnGhost} disabled={busy === `di-${r.id}`} onClick={() => doDispute(r.id)}>
                      Complaint
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity timeline */}
      <JobTimeline activity={activity} />
    </>
  );
}

export function JobTimeline({ activity }: { activity: ActivityLogDto[] }) {
  if (!activity || activity.length === 0) return null;
  return (
    <div style={card}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#f0f0f0", margin: "0 0 12px" }}>Activity history</h3>
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
