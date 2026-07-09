"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleDollarSign, X } from "lucide-react";
import {
  getIncomingPaymentRequests, approvePaymentRequest, declinePaymentRequest, disputePaymentRequest,
  apiError, type PaymentRequestDto,
} from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";
import { Countdown } from "./countdown";

const fmt = (n: number) => `RWF ${Number(n || 0).toLocaleString()}`;

/**
 * Employer-only global approval surface. Polls for pending per-period payment requests, shows a
 * count badge in the navbar, and opens a modal to approve / decline / dispute from anywhere. Emails
 * deep-link here via ?approve=<requestId>, which auto-opens the modal.
 */
export function PaymentApprovalModal() {
  const { success, error: toastError } = useToast();
  const { t } = useLanguage();
  const [reqs, setReqs] = useState<PaymentRequestDto[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try { setReqs(await getIncomingPaymentRequests(token)); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  // Deep link from email: ?approve=<id> opens the modal.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("approve")) {
      setOpen(true);
    }
  }, []);

  async function act(fn: () => Promise<unknown>, key: string, ok: string) {
    setBusy(key);
    try { await fn(); success(ok); await load(); }
    catch (e) { toastError(apiError(e, "Action failed")); }
    finally { setBusy(null); }
  }
  const token = () => localStorage.getItem("access_token") || "";

  const count = reqs.length;

  return (
    <>
      <button className="topbar-icon-btn" onClick={() => setOpen(true)}
        aria-label={t("payments.approvals_title") || "Payment approvals"} style={{ position: "relative", color: count > 0 ? "#f97316" : "#555" }}>
        <CircleDollarSign size={15} />
        {count > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, padding: "0 4px",
            background: "#f97316", color: "#000", borderRadius: 99, fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{count}</span>
        )}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300,
          display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 16px",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#141414", border: "1px solid #1e1e1e", borderRadius: 16,
            width: "100%", maxWidth: 460, maxHeight: "70vh", overflow: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid #1c1c1c", position: "sticky", top: 0, background: "#141414" }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#f0f0f0" }}>
                {t("payments.approvals_title") || "Payment approvals"} {count > 0 && <span style={{ color: "#f97316" }}>({count})</span>}
              </p>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}><X size={16} /></button>
            </div>

            <div style={{ padding: 12 }}>
              {count === 0 && (
                <p style={{ textAlign: "center", color: "#555", fontSize: 13, padding: "28px 0" }}>
                  {t("payments.none_waiting") || "No payment requests waiting on you."}
                </p>
              )}
              {reqs.map(r => (
                <div key={r.id} style={{ border: "1px solid #1e1e1e", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f0f0f0" }}>{fmt(r.amountRwf)}</div>
                      <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                        {t("payments.req_meta", {
                          worker: r.workerName, index: String(r.periodIndex),
                          total: String(r.totalPeriods), job: r.jobTitle,
                        }) || `${r.workerName} · period ${r.periodIndex}/${r.totalPeriods} · ${r.jobTitle}`}
                      </div>
                      {r.expiresAt && (
                        <div style={{ fontSize: 11.5, color: "#eab308", marginTop: 4 }}>
                          {(r.directRelease ? (t("payments.auto_approves_in") || "auto-approves in") : (t("payments.escalates_in") || "support case opens in"))} <Countdown to={r.expiresAt} onElapsed={load} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button disabled={busy === r.id} onClick={() => act(() => approvePaymentRequest(r.id, token()), r.id, t("payments.toast_approved") || "Approved & released")}
                      style={{ flex: 1, background: "#22c55e", color: "#000", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                      {t("payments.approve_btn") || "Approve"}
                    </button>
                    <button disabled={busy === r.id} onClick={() => act(() => declinePaymentRequest(r.id, window.prompt(t("payments.decline_prompt") || "Reason (optional):") ?? "", token()), r.id, t("payments.toast_declined") || "Declined")}
                      style={{ flex: 1, background: "#1a1a1a", color: "#ef4444", border: "1px solid #2a2a2a", borderRadius: 8, padding: "9px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                      {t("payments.decline_btn") || "Decline"}
                    </button>
                    <button disabled={busy === r.id} onClick={() => {
                        const reason = window.prompt(t("payments.complaint_prompt") || "Complaint — the money will be frozen until an agent reviews it:");
                        if (reason !== null) act(() => disputePaymentRequest(r.id, reason, token()), r.id, t("payments.toast_complaint") || "Complaint submitted");
                      }}
                      style={{ background: "#1a1a1a", color: "#aaa", border: "1px solid #2a2a2a", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                      {t("payments.complaint_btn") || "Complaint"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
