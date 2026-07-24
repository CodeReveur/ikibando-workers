"use client";

import { useEffect, useState, useCallback } from "react";
import { CreditCard, Shield, Plus, RefreshCw, X, ArrowDownLeft, ArrowUpRight, Loader2, Wallet } from "lucide-react";
import {
  getWallet, getWalletTransactions, requestRefund, apiError,
  type WalletDto, type PaymentDto,
} from "@/lib/api";
import { StatCard, SectionHead, PageLoader } from "@/components/dashboard/ui";
import { fmt } from "@/lib/dashboard-data";
import { Balance } from "@/components/ui/balance";
import { useLanguage } from "@/lib/language-context";
import { PayMethodSelector, type PayMethodValue } from "@/components/ui/pay-logos";
import { runWalletTopup, isCardMethod } from "@/lib/pay-flow";

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  HELD:     { label:"In Escrow",  color:"#f59e0b", bg:"rgba(245,158,11,0.08)"  },
  RELEASED: { label:"Released",   color:"#22c55e", bg:"rgba(34,197,94,0.08)"   },
  REFUNDED: { label:"Refunded",   color:"#60a5fa", bg:"rgba(96,165,250,0.08)"  },
  PENDING:  { label:"Pending",    color:"#888",    bg:"rgba(120,120,120,0.08)"  },
  SUCCESS:  { label:"Success",    color:"#22c55e", bg:"rgba(34,197,94,0.08)"   },
  FAILED:   { label:"Failed",     color:"#ef4444", bg:"rgba(239,68,68,0.08)"   },
};

export default function OwnerPayments() {
  const { t, language } = useLanguage();
  const dateLocaleMap: Record<string, string> = {
    rw: "rw-RW",
    kinyy: "rw-RW",
    sw: "sw-TZ",
    fr: "fr-FR",
    en: "en-US",
  };
  const currentLocale = dateLocaleMap[language] || "en-RW";

  const [wallet,   setWallet]   = useState<WalletDto | null>(null);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [topupOpen,    setTopupOpen]    = useState(false);
  const [topupAmt,     setTopupAmt]     = useState("");
  const [topupPhone,   setTopupPhone]   = useState("");
  const [topupMethod,  setTopupMethod]  = useState<PayMethodValue>("MTN_MOMO");
  const [topupBusy,    setTopupBusy]    = useState(false);
  const [topupErr,     setTopupErr]     = useState("");

  const [refundFor,  setRefundFor]  = useState<PaymentDto | null>(null);
  const [refundNote, setRefundNote] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [generalRefundOpen, setGeneralRefundOpen] = useState(false);
  const [selectedRefundPaymentId, setSelectedRefundPaymentId] = useState("");
  const [typeFilter,   setTypeFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const [w, p] = await Promise.all([getWallet(token), getWalletTransactions(token)]);
      setWallet(w); setPayments(p);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doTopup = async () => {
    const token = localStorage.getItem("access_token")!;
    const amount = parseInt(topupAmt, 10);
    const card = isCardMethod(topupMethod);
    if (!amount || amount < 100) { setTopupErr(t("owner_payments.min_topup_err") || "Minimum top-up is RWF 100"); return; }
    // Card payments are collected on XentriPay's hosted page — no phone needed.
    if (!card && (!topupPhone || topupPhone.replace(/\D/g,"").length < 9)) {
      setTopupErr(t("owner_payments.valid_phone_err") || "Enter a valid phone number"); return;
    }
    setTopupBusy(true); setTopupErr("");
    try {
      const outcome = await runWalletTopup({
        amount, method: topupMethod, phone: card ? undefined : topupPhone.trim(), token,
      });
      if (outcome !== "success") {
        setTopupErr(outcome === "pending"
          ? (t("owner_payments.topup_pending_err") || "Payment not confirmed yet. If you were charged, it will reflect shortly.")
          : (t("owner_payments.topup_failed_err") || "Top-up failed"));
        return;
      }
      await load(); // refresh wallet + transactions
      setTopupOpen(false); setTopupAmt(""); setTopupPhone("");
    } catch (e: any) {
      setTopupErr(apiError(e, t("owner_payments.topup_failed_err") || "Top-up failed"));
    } finally { setTopupBusy(false); }
  };

  const PENDING_MSG = () => t("owner_payments.refund_submitted") ||
    "Refund request submitted. An admin will review it; approved refunds are returned to your wallet minus any applicable charges.";

  const doRefund = async () => {
    if (!refundFor) return;
    if (refundNote.trim().length < 10) { alert(t("owner_payments.refund_reason_err") || "Please give a clear reason (at least 10 characters)."); return; }
    const token = localStorage.getItem("access_token")!;
    setRefundBusy(true);
    try {
      const updated = await requestRefund(refundFor.id, refundNote.trim(), token);
      setPayments(prev => prev.map(p => p.id === updated.id ? updated : p));
      setRefundFor(null); setRefundNote("");
      alert(PENDING_MSG());
    } catch (e: any) {
      alert(apiError(e, t("owner_payments.refund_failed_err") || "Refund request failed"));
    } finally { setRefundBusy(false); }
  };

  const doGeneralRefund = async () => {
    if (!selectedRefundPaymentId) return;
    if (refundNote.trim().length < 10) { alert(t("owner_payments.refund_reason_err") || "Please give a clear reason (at least 10 characters)."); return; }
    const token = localStorage.getItem("access_token")!;
    setRefundBusy(true);
    try {
      const updated = await requestRefund(selectedRefundPaymentId, refundNote.trim(), token);
      setPayments(prev => prev.map(p => p.id === updated.id ? updated : p));
      setGeneralRefundOpen(false); setSelectedRefundPaymentId(""); setRefundNote("");
      alert(PENDING_MSG());
    } catch (e: any) {
      alert(apiError(e, t("owner_payments.refund_failed_err") || "Refund request failed"));
    } finally { setRefundBusy(false); }
  };

  if (loading) return <PageLoader />;

  const jobPayments  = payments.filter(p => p.type === "PAYMENT");
  const heldCount    = jobPayments.filter(p => p.status === "HELD").length;
  const releasedAmt  = jobPayments.filter(p => p.status === "RELEASED").reduce((s,p) => s + p.amountRwf, 0);
  const refundedAmt  = jobPayments.filter(p => p.status === "REFUNDED").reduce((s,p) => s + p.amountRwf, 0);

  const inp: React.CSSProperties = { width:"100%", background:"#131313", border:"1px solid #222", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#d0d0d0", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const filterSel: React.CSSProperties = { background:"#131313", border:"1px solid #222", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#d0d0d0", fontFamily:"inherit", outline:"none" };

  const filteredPayments = payments.filter(p =>
    (!typeFilter   || p.type   === typeFilter) &&
    (!statusFilter || p.status === statusFilter));

  return (
    <div>
      {/* Stats */}
      {/* Stats */}
      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 28px;
        }
        .payment-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
        }
        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .payment-row {
            flex-direction: column;
            align-items: stretch !important;
            gap: 12px;
          }
          .payment-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #1c1c1c;
            padding-top: 10px;
            text-align: right;
          }
        }
        @media (max-width: 500px) {
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      <div className="stats-grid">
        <StatCard label={t("owner_payments.wallet_balance") || "Wallet Balance"} value={<Balance amount={wallet?.balance ?? 0} toggle />} sub={t("owner_payments.available_spend") || "Available to spend"} accent="#f97316" />
        <StatCard label={t("owner_payments.in_escrow") || "In Escrow"}      value={String(heldCount) + " " + (t("owner_payments.jobs_unit") || "jobs")}    sub={t("owner_payments.awaiting_completion") || "Awaiting completion"} accent="#f59e0b" />
        <StatCard label={t("owner_payments.total_released") || "Total Released"} value={fmt(releasedAmt)}          sub={t("owner_payments.workers_paid") || "Workers paid"}     accent="#22c55e" />
        <StatCard label={t("owner_payments.refunded") || "Refunded"}       value={fmt(refundedAmt)}          sub={t("owner_payments.returned_wallet") || "Returned to wallet"} accent="#60a5fa" />
      </div>

      {/* Top up banner */}
      {(wallet?.balance ?? 0) < 5000 && (
        <div style={{ background:"rgba(249,115,22,0.04)", border:"1px solid rgba(249,115,22,0.12)", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
          <Shield size={18} color="#f97316" style={{ flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#f97316" }}>{t("owner_payments.low_balance") || "Low wallet balance"}</p>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#555" }}>{t("owner_payments.low_balance_desc") || "Add funds to your wallet to post jobs. Each job requires full escrow deposit upfront."}</p>
          </div>
          <button onClick={() => setTopupOpen(true)} style={{ background:"#f97316", color:"#fff", border:"none", borderRadius:9, padding:"9px 18px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
            {t("owner_payments.top_up_btn") || "Top up"}
          </button>
        </div>
      )}

      <SectionHead title={t("owner_payments.title") || "Transaction History"} action={
        <button onClick={() => setTopupOpen(true)} style={{
          display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:700,
          color:"#f97316", background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.2)",
          borderRadius:8, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit",
        }}>
          <Plus size={13} /> {t("owner_payments.add_funds") || "Add funds"}
        </button>
      } />

      {/* Filters — All is the default first option */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:12 }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={filterSel}>
          <option value="">{t("owner_payments.filter_all_types") || "All types"}</option>
          <option value="PAYMENT">{t("owner_payments.filter_escrow") || "Escrow payments"}</option>
          <option value="TOPUP">{t("owner_payments.wallet_topup") || "Top-ups"}</option>
          <option value="WITHDRAWAL">{t("owner_payments.withdrawal") || "Withdrawals"}</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterSel}>
          <option value="">{t("owner_payments.filter_all_statuses") || "All statuses"}</option>
          <option value="HELD">{t("owner_payments.in_escrow") || "In escrow"}</option>
          <option value="RELEASED">{t("seeker_jobs.status_released") || "Released"}</option>
          <option value="REFUNDED">{t("owner_payments.refunded") || "Refunded"}</option>
          <option value="PENDING">{t("seeker_jobs.status_pending") || "Pending"}</option>
          <option value="SUCCESS">{t("common.general.success") || "Success"}</option>
          <option value="FAILED">{t("common.general.failed") || "Failed"}</option>
        </select>
        {(typeFilter || statusFilter) && (
          <button onClick={() => { setTypeFilter(""); setStatusFilter(""); }} style={{ ...filterSel, cursor:"pointer", color:"#f97316" }}>
            {t("owner_payments.clear_filters") || "Clear"}
          </button>
        )}
      </div>

      {filteredPayments.length === 0 ? (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"40px 24px", textAlign:"center" }}>
          <CreditCard size={28} color="#2a2a2a" style={{ marginBottom:12 }} />
          <p style={{ margin:0, color:"#444", fontSize:13 }}>{payments.length === 0 ? (t("owner_payments.no_transactions") || "No transactions yet") : (t("owner_payments.no_match") || "No transactions match these filters")}</p>
          <p style={{ margin:"6px 0 0", color:"#333", fontSize:12 }}>{t("owner_payments.no_transactions_desc") || "Transactions appear here when you post jobs."}</p>
        </div>
      ) : (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, overflow:"hidden", marginBottom:14 }}>
          {filteredPayments.map((p, i) => {
            const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.PENDING;
            const localizedStatus = t("seeker_jobs.status_" + p.status.toLowerCase()) || s.label;
            const isHeld = p.status === "HELD";

            return (
              <div key={p.id} className="payment-row" style={{
                borderBottom: i < filteredPayments.length - 1 ? "1px solid #181818" : "none",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0 }}>
                  <div style={{ width:40, height:40, borderRadius:10, flexShrink:0,
                    background: p.type === "TOPUP" ? "rgba(34,197,94,0.08)" : p.type === "WITHDRAWAL" ? "rgba(239,68,68,0.08)" : "rgba(249,115,22,0.08)",
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {p.type === "TOPUP"      ? <Wallet size={16} color="#22c55e" /> :
                     p.type === "WITHDRAWAL" ? <ArrowUpRight size={16} color="#ef4444" /> :
                     p.status === "RELEASED" ? <ArrowDownLeft size={16} color="#22c55e" /> :
                     p.status === "REFUNDED" ? <RefreshCw size={16} color="#60a5fa" /> :
                                               <CreditCard size={16} color="#f97316" />}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, color:"#d0d0d0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {p.jobTitle ?? (p.type === "TOPUP" ? (t("owner_payments.wallet_topup") || "Wallet Top-up") : (t("owner_payments.withdrawal") || "Withdrawal"))}
                    </p>
                    <p style={{ margin:0, fontSize:11, color:"#444" }}>
                      {new Date(p.createdAt).toLocaleDateString(currentLocale, { day:"numeric", month:"short", year:"numeric" })}
                      {p.method ? ` · ${p.method.replace(/_/g," ")}` : ""}
                      {p.phoneNumber ? ` · ${p.phoneNumber}` : ""}
                    </p>
                    {p.refundReason && <p style={{ margin:0, fontSize:10, color:"#3a3a3a" }}>{t("owner_payments.reason") || "Reason:"} {p.refundReason}</p>}
                    {p.refundRequestedAt && p.status === "HELD" && (
                      <p style={{ margin:0, fontSize:10, color:"#f59e0b" }}>{t("owner_payments.refund_pending") || "Refund requested — awaiting admin approval"}</p>
                    )}
                  </div>
                </div>
                <div className="payment-meta" style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
                  <span style={{ fontSize:10, fontWeight:700, borderRadius:99, padding:"3px 9px", color:s.color, background:s.bg }}>{localizedStatus}</span>
                  <p style={{ margin:0, fontSize:15, fontWeight:800, color:"#e0e0e0" }}>{fmt(p.amountRwf)}</p>
                  {p.type === "PAYMENT" && isHeld && (
                    p.refundRequestedAt ? (
                      <span style={{ fontSize:10, fontWeight:700, borderRadius:99, padding:"3px 9px", color:"#f59e0b", background:"rgba(245,158,11,0.08)" }}>
                        {t("owner_payments.refund_pending_badge") || "Refund pending"}
                      </span>
                    ) : (
                      <button onClick={() => { setRefundFor(p); setRefundNote(""); }} style={{ background:"rgba(96,165,250,0.07)", border:"1px solid rgba(96,165,250,0.15)", color:"#60a5fa", borderRadius:7, padding:"5px 10px", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                        {t("owner_payments.refund_btn") || "Refund"}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Escrow info */}
      <div style={{ background:"rgba(34,197,94,0.03)", border:"1px solid rgba(34,197,94,0.1)", borderRadius:12, padding:"14px 18px", display:"flex", gap:10, marginTop:9, alignItems:"center", flexWrap:"wrap" }}>
        <Shield size={16} color="#22c55e" style={{ flexShrink:0 }} />
        <p style={{ margin:0, fontSize:12, color:"#3e3e3e", lineHeight:1.7, flex:1, minWidth:260 }}>
          {t("owner_payments.escrow_info_desc") || "Each job requires a full escrow deposit (rate × hours × workers + 5% fee) deducted from your wallet at posting time. Funds are held securely and released only when you mark the job complete. You can request a refund on any HELD payment."}
        </p>
        {payments.some(p => p.type === "PAYMENT" && p.status === "HELD") && (
          <button
            onClick={() => {
              setGeneralRefundOpen(true);
              setRefundNote("");
              setSelectedRefundPaymentId("");
            }}
            style={{
              background:"rgba(96,165,250,0.08)", border:"1px solid rgba(96,165,250,0.2)",
              color:"#60a5fa", borderRadius:8, padding:"6px 14px", fontSize:11, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit", flexShrink:0,
            }}
          >
            {t("owner_payments.claim_refund_link") || "Request a refund"}
          </button>
        )}
      </div>

      {/* Top-up modal */}
      {topupOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#111", border:"1px solid #222", borderRadius:18, width:"100%", maxWidth:440, padding:"28px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#fff" }}>{t("owner_payments.top_up_modal") || "Top Up Wallet"}</p>
              <button onClick={() => { setTopupOpen(false); setTopupErr(""); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#555" }}><X size={18} /></button>
            </div>

            {/* Payment method — mobile money or card */}
            <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>{t("owner_payments.pay_method") || "PAYMENT METHOD"}</p>
            <div style={{ marginBottom:18 }}>
              <PayMethodSelector value={topupMethod} onChange={setTopupMethod} />
            </div>

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>{t("owner_payments.amount_rwf") || "AMOUNT (RWF)"}</p>
            <input style={{ ...inp, marginBottom:14 }} type="number" min="100" placeholder="e.g. 50,000" value={topupAmt} onChange={e => setTopupAmt(e.target.value)} />

            {!isCardMethod(topupMethod) ? (
              <>
                <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>
                  {t("owner_payments.phone_label", { provider: topupMethod === "MTN_MOMO" ? "MTN" : "AIRTEL" }) || `${topupMethod === "MTN_MOMO" ? "MTN" : "AIRTEL"} PHONE NUMBER`}
                </p>
                <input style={{ ...inp, marginBottom:6 }} type="tel"
                  placeholder={topupMethod === "MTN_MOMO" ? "e.g. 0788 123 456" : "e.g. 0738 123 456"}
                  value={topupPhone} onChange={e => setTopupPhone(e.target.value)} />
                <p style={{ margin:"0 0 18px", fontSize:11, color:"#2a2a2a", lineHeight:1.6 }}>
                  {t("owner_payments.topup_hint") || "A USSD prompt will be sent to your phone. Approve it to complete the top-up. Funds appear in your wallet automatically once confirmed."}
                </p>
              </>
            ) : (
              <p style={{ margin:"6px 0 18px", fontSize:11, color:"#2a2a2a", lineHeight:1.6 }}>
                {t("owner_payments.topup_card_hint") || "You'll be taken to a secure card payment page in a new tab. Funds appear in your wallet automatically once the payment is confirmed."}
              </p>
            )}

            {topupErr && <p style={{ margin:"0 0 12px", fontSize:12, color:"#ef4444", background:"rgba(239,68,68,0.07)", borderRadius:8, padding:"8px 12px" }}>{topupErr}</p>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={doTopup} disabled={topupBusy} style={{
                flex:1,
                background: topupMethod === "MTN_MOMO" ? "#ffcc00" : topupMethod === "AIRTEL_MONEY" ? "#ff0000" : "#f97316",
                color: topupMethod === "MTN_MOMO" ? "#000" : "#fff",
                border:"none", borderRadius:9, padding:"12px", fontSize:13, fontWeight:800,
                cursor: topupBusy ? "not-allowed" : "pointer", fontFamily:"inherit",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              }}>
                {topupBusy ? <><Loader2 size={14} style={{ animation:"spin 0.7s linear infinite" }} /> {t("owner_payments.processing") || "Processing…"}</> : `${t("owner_payments.top_up_btn") || "Top up"} ${topupAmt ? fmt(parseInt(topupAmt,10)||0) : ""}`}
              </button>
              <button onClick={() => { setTopupOpen(false); setTopupErr(""); }} style={{ flex:1, background:"transparent", color:"#555", border:"1px solid #222", borderRadius:9, padding:"12px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                {t("owner_payments.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund modal */}
      {refundFor && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#111", border:"1px solid #222", borderRadius:18, width:"100%", maxWidth:420, padding:"28px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#fff" }}>{t("owner_payments.refund_modal") || "Request Refund"}</p>
              <button onClick={() => setRefundFor(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#555" }}><X size={18} /></button>
            </div>
            <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:10, padding:"12px 16px", marginBottom:18 }}>
              <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:700, color:"#e0e0e0" }}>{refundFor.jobTitle}</p>
              <p style={{ margin:0, fontSize:13, color:"#f97316", fontWeight:800 }}>{fmt(refundFor.amountRwf)}</p>
            </div>
            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a" }}>{t("owner_payments.reason_refund") || "REASON FOR REFUND"}</p>
            <textarea
              autoFocus
              value={refundNote}
              onChange={e => setRefundNote(e.target.value)}
              placeholder="e.g. Job cancelled, worker did not show up"
              rows={3}
              style={{ ...inp, marginBottom:10, resize:"vertical" }}
            />
            <p style={{ margin:"0 0 18px", fontSize:11, color:"#f59e0b", lineHeight:1.6, background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:8, padding:"9px 12px" }}>
              {t("owner_payments.refund_notice") || "Refunds are reviewed by an admin — this is not instant. The non-refundable service fee is kept, and if a worker is already engaged a cancellation charge applies."}
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={doRefund} disabled={refundBusy || refundNote.trim().length < 10} style={{ flex:1, background: refundNote.trim().length < 10 ? "#2a3a4a" : "#60a5fa", color:"#fff", border:"none", borderRadius:9, padding:"11px", fontSize:13, fontWeight:700, cursor: refundBusy || refundNote.trim().length < 10 ? "not-allowed" : "pointer", fontFamily:"inherit" }}>
                {refundBusy ? <Loader2 size={14} style={{ animation:"spin 0.7s linear infinite" }} /> : (t("owner_payments.submit_refund") || "Submit request")}
              </button>
              <button onClick={() => setRefundFor(null)} style={{ flex:1, background:"transparent", color:"#555", border:"1px solid #222", borderRadius:9, padding:"11px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                {t("owner_payments.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Refund modal */}
      {generalRefundOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#111", border:"1px solid #222", borderRadius:18, width:"100%", maxWidth:420, padding:"28px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#fff" }}>{t("owner_payments.claim_refund_title") || "Claim Escrow Refund"}</p>
              <button onClick={() => { setGeneralRefundOpen(false); setSelectedRefundPaymentId(""); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#555" }}><X size={18} /></button>
            </div>
            
            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a" }}>{t("seeker_jobs.label_job") || "JOB / OFFER"}</p>
            <select
              value={selectedRefundPaymentId}
              onChange={e => setSelectedRefundPaymentId(e.target.value)}
              style={{ ...inp, marginBottom:16 }}
            >
              <option value="">{t("owner_payments.select_escrow_payment") || "Select an escrow payment..."}</option>
              {payments.filter(p => p.type === "PAYMENT" && p.status === "HELD").map(p => (
                <option key={p.id} value={p.id}>
                  {p.jobTitle} ({fmt(p.amountRwf)})
                </option>
              ))}
            </select>

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a" }}>{t("owner_payments.reason_refund") || "REASON FOR REFUND"}</p>
            <textarea
              value={refundNote}
              onChange={e => setRefundNote(e.target.value)}
              placeholder="e.g. Job cancelled, worker did not show up"
              rows={3}
              style={{ ...inp, marginBottom:10, resize:"vertical" }}
            />
            <p style={{ margin:"0 0 18px", fontSize:11, color:"#f59e0b", lineHeight:1.6, background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:8, padding:"9px 12px" }}>
              {t("owner_payments.refund_notice") || "Refunds are reviewed by an admin — this is not instant. The non-refundable service fee is kept, and if a worker is already engaged a cancellation charge applies."}
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={doGeneralRefund} disabled={refundBusy || !selectedRefundPaymentId || refundNote.trim().length < 10} style={{ flex:1, background: (!selectedRefundPaymentId || refundNote.trim().length < 10) ? "#2a3a4a" : "#60a5fa", color:"#fff", border:"none", borderRadius:9, padding:"11px", fontSize:13, fontWeight:700, cursor: refundBusy || !selectedRefundPaymentId || refundNote.trim().length < 10 ? "not-allowed" : "pointer", fontFamily:"inherit" }}>
                {refundBusy ? <Loader2 size={14} style={{ animation:"spin 0.7s linear infinite" }} /> : (t("owner_payments.submit_refund") || "Submit request")}
              </button>
              <button onClick={() => { setGeneralRefundOpen(false); setSelectedRefundPaymentId(""); }} style={{ flex:1, background:"transparent", color:"#555", border:"1px solid #222", borderRadius:9, padding:"11px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                {t("owner_payments.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
