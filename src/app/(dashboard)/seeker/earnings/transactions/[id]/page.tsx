"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Clock, Copy, Check } from "lucide-react";
import { getWalletTransactions, type PaymentDto } from "@/lib/api";
import { PageLoader } from "@/components/dashboard/ui";
import { fmt } from "@/lib/dashboard-data";
import { useLanguage } from "@/lib/language-context";
import Link from "next/link";

const STATUS_STYLE: Record<string, { labelKey: string; color: string; bg: string }> = {
  RELEASED: { labelKey: "seeker_earnings.released_on", color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  SUCCESS:  { labelKey: "common.general.success",      color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  PENDING:  { labelKey: "seeker_jobs.status_pending",  color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  HELD:     { labelKey: "seeker_earnings.in_escrow",   color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  REFUNDED: { labelKey: "seeker_jobs.status_refunded", color: "#60a5fa", bg: "rgba(96,165,250,0.08)" },
  FAILED:   { labelKey: "common.general.failed",       color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
};

export default function SeekerTransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  
  const dateLocaleMap: Record<string, string> = {
    rw: "rw-RW",
    kinyy: "rw-RW",
    sw: "sw-TZ",
    fr: "fr-FR",
    en: "en-US",
  };
  const currentLocale = dateLocaleMap[language] || "en-RW";

  const [txn, setTxn] = useState<PaymentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    
    getWalletTransactions(token)
      .then(list => {
        const found = list.find(tx => tx.id === id);
        if (found) setTxn(found);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const copy = () => {
    if (!txn?.id) return;
    navigator.clipboard.writeText(txn.id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <PageLoader />;

  if (!txn) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
          {t("transaction_detail.not_found") || "Transaction not found"}
        </p>
        <p style={{ fontSize: 13, color: "#555", marginTop: 8 }}>
          {t("transaction_detail.not_found_desc") || "This transaction may not exist or you do not have permission to view it."}
        </p>
        <Link href="/seeker/earnings" style={{ display: "inline-block", marginTop: 20, color: "#f97316", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
          ← {t("transaction_detail.back") || "Back to Wallet"}
        </Link>
      </div>
    );
  }

  const s = STATUS_STYLE[txn.status] ?? STATUS_STYLE.PENDING;
  const isRelease = txn.status === "RELEASED";
  const isOut = txn.type === "WITHDRAWAL";

  const d = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(currentLocale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div style={{ padding: "10px 0" }}>
      <style>{`
        .txn-detail-layout { display: grid; grid-template-columns: 1fr 1.5fr; gap: 24px; align-items: start; }
        .detail-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 0; border-bottom: 1px solid #1c1c1c; }
        .detail-label { font-size: 12px; color: #555; font-weight: 600; }
        .detail-value { font-size: 13px; color: #d0d0d0; text-align: right; word-break: break-all; max-width: 60%; }
        @media (max-width: 800px) {
          .txn-detail-layout { grid-template-columns: 1fr; gap: 20px; }
        }
        @media (max-width: 340px) {
          .detail-row { flex-direction: column; align-items: stretch; gap: 4px; }
          .detail-value { text-align: left; max-width: 100%; }
        }
      `}</style>

      {/* Back button */}
      <Link href="/seeker/earnings" style={{ display: "flex", alignItems: "center", gap: 6, color: "#555", textDecoration: "none", fontSize: 13, fontWeight: 700, marginBottom: 20, width: "fit-content" }}>
        <ArrowLeft size={16} />
        {t("transaction_detail.back") || "Back to Wallet"}
      </Link>

      <div className="txn-detail-layout">
        {/* Left Column: Hero Card */}
        <div style={{
          background: "linear-gradient(135deg,#131313 0%,#0d0d0d 100%)",
          border: "1px solid #1c1c1c", borderRadius: 18, padding: "40px 24px",
          textAlign: "center"
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, background: isRelease ? "rgba(34,197,94,0.08)" : isOut ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px"
          }}>
            {isRelease ? (
              <ArrowUpRight size={30} color="#22c55e" />
            ) : isOut ? (
              <ArrowDownLeft size={30} color="#ef4444" />
            ) : (
              <Clock size={30} color="#f59e0b" />
            )}
          </div>

          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#3a3a3a", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {t("transaction_detail.amount") || "Amount"}
          </p>
          <p style={{ margin: 0, fontSize: 38, fontWeight: 900, color: isRelease ? "#22c55e" : "#fff", letterSpacing: "-1.5px" }}>
            {isRelease ? "+" : isOut ? "-" : ""}{fmt(txn.amountRwf)}
          </p>
          
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, background: s.bg, borderRadius: 99, padding: "5px 14px" }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: s.color }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>
              {t(s.labelKey) || txn.status}
            </span>
          </div>
        </div>

        {/* Right Column: Info Card */}
        <div style={{ background: "#131313", border: "1px solid #1c1c1c", borderRadius: 18, padding: "10px 24px" }}>
          {/* Transaction ID */}
          <div className="detail-row">
            <span className="detail-label">{t("transaction_detail.txn_id") || "Transaction ID"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#888" }}>
                {txn.id}
              </span>
              <button onClick={copy} style={{ background: "none", border: "none", color: copied ? "#22c55e" : "#555", cursor: "pointer", padding: 2, display: "flex" }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* Transaction Type */}
          <div className="detail-row">
            <span className="detail-label">{t("transaction_detail.type") || "Transaction Type"}</span>
            <span className="detail-value">
              {txn.type === "WITHDRAWAL" ? (t("seeker_earnings.withdrawal") || "Withdrawal") :
               txn.type === "TOPUP" ? (t("seeker_earnings.topup") || "Top Up") :
               txn.type === "PAYMENT" ? (t("seeker_earnings.payment") || "Job Payment") :
               (t("seeker_jobs.tab_all") || "Transaction")}
            </span>
          </div>

          {/* Job details (if applicable) */}
          {txn.jobId && (
            <div className="detail-row">
              <span className="detail-label">{t("seeker_job_detail.job_details") || "Job"}</span>
              <Link href={`/seeker/jobs/${txn.jobId}`} className="detail-value" style={{ color: "#f97316", textDecoration: "none", fontWeight: 600 }}>
                {txn.jobTitle || "View Job"}
              </Link>
            </div>
          )}

          {/* Date & Time */}
          <div className="detail-row">
            <span className="detail-label">{t("transaction_detail.date") || "Date & Time"}</span>
            <span className="detail-value">{d(txn.createdAt)}</span>
          </div>

          {/* Payment Method / Provider */}
          {txn.method && (
            <div className="detail-row">
              <span className="detail-label">{t("transaction_detail.provider") || "Payment Provider"}</span>
              <span className="detail-value">
                {txn.method === "MTN_MOMO" ? "MTN Mobile Money" :
                 txn.method === "AIRTEL_MONEY" ? "Airtel Money" :
                 txn.method}
              </span>
            </div>
          )}

          {/* Phone number */}
          {txn.phoneNumber && (
            <div className="detail-row">
              <span className="detail-label">{t("transaction_detail.phone") || "Phone Number"}</span>
              <span className="detail-value">{txn.phoneNumber}</span>
            </div>
          )}

          {/* Payout breakdown */}
          {txn.platformFeeRwf !== null && (
            <div className="detail-row">
              <span className="detail-label">{t("transaction_detail.platform_fee") || "Platform Fee"}</span>
              <span className="detail-value">-{fmt(txn.platformFeeRwf)}</span>
            </div>
          )}
          {txn.workerPayoutRwf !== null && (
            <div className="detail-row">
              <span className="detail-label">{t("transaction_detail.worker_payout") || "Net Payout"}</span>
              <span className="detail-value" style={{ fontWeight: 700, color: "#fff" }}>{fmt(txn.workerPayoutRwf)}</span>
            </div>
          )}

          {/* Descriptions / Notes */}
          {txn.notes && (
            <div className="detail-row" style={{ borderBottom: "none" }}>
              <span className="detail-label">{t("transaction_detail.notes") || "Notes"}</span>
              <span className="detail-value" style={{ color: "#a0a0a0", fontStyle: "italic" }}>
                {txn.notes
                  .replace("Withdrawal to MTN MoMo", t("seeker_earnings.wd_mtn_momo") || "Withdrawal to MTN MoMo")
                  .replace("Withdrawal to Airtel Money", t("seeker_earnings.wd_airtel_money") || "Withdrawal to Airtel Money")
                }
              </span>
            </div>
          )}

          {/* Dynamic Dates based on state */}
          {txn.heldAt && (
            <div className="detail-row">
              <span className="detail-label">{t("transaction_detail.held_at") || "Held in Escrow At"}</span>
              <span className="detail-value">{d(txn.heldAt)}</span>
            </div>
          )}
          {txn.releasedAt && (
            <div className="detail-row">
              <span className="detail-label">{t("transaction_detail.released_at") || "Released At"}</span>
              <span className="detail-value">{d(txn.releasedAt)}</span>
            </div>
          )}
          {txn.refundedAt && (
            <div className="detail-row">
              <span className="detail-label">{t("transaction_detail.refunded_at") || "Refunded At"}</span>
              <span className="detail-value">{d(txn.refundedAt)}</span>
            </div>
          )}
          {txn.refundReason && (
            <div className="detail-row" style={{ borderBottom: "none" }}>
              <span className="detail-label">{t("transaction_detail.refund_reason") || "Refund Reason"}</span>
              <span className="detail-value" style={{ color: "#ef4444" }}>{txn.refundReason}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
