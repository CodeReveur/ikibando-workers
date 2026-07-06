"use client";

import { useEffect, useState, useCallback } from "react";
import { CreditCard, Shield, Plus, RefreshCw, X, ArrowDownLeft, ArrowUpRight, Loader2, Wallet } from "lucide-react";
import {
  getWallet, getWalletTransactions, topupWallet, requestRefund, apiError,
  type WalletDto, type PaymentDto,
} from "@/lib/api";
import { StatCard, SectionHead, PageLoader } from "@/components/dashboard/ui";
import { fmt } from "@/lib/dashboard-data";
import { useLanguage } from "@/lib/language-context";

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
  const [topupMethod,  setTopupMethod]  = useState<"MTN_MOMO" | "AIRTEL_MONEY">("MTN_MOMO");
  const [topupBusy,    setTopupBusy]    = useState(false);
  const [topupErr,     setTopupErr]     = useState("");

  const [refundFor,  setRefundFor]  = useState<PaymentDto | null>(null);
  const [refundNote, setRefundNote] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);

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
    if (!amount || amount < 100) { setTopupErr(t("owner_payments.min_topup_err") || "Minimum top-up is RWF 100"); return; }
    if (!topupPhone || topupPhone.replace(/\D/g,"").length < 9) { setTopupErr(t("owner_payments.valid_phone_err") || "Enter a valid phone number"); return; }
    setTopupBusy(true); setTopupErr("");
    try {
      await topupWallet({ amount, phoneNumber: topupPhone.trim(), paymentMethod: topupMethod }, token);
      await load(); // refresh wallet + transactions
      setTopupOpen(false); setTopupAmt(""); setTopupPhone("");
    } catch (e: any) {
      setTopupErr(apiError(e, t("owner_payments.topup_failed_err") || "Top-up failed"));
    } finally { setTopupBusy(false); }
  };

  const doRefund = async () => {
    if (!refundFor) return;
    const token = localStorage.getItem("access_token")!;
    setRefundBusy(true);
    try {
      const updated = await requestRefund(refundFor.id, refundNote || "Employer requested refund", token);
      setPayments(prev => prev.map(p => p.id === updated.id ? updated : p));
      const w = await getWallet(token); setWallet(w);
      setRefundFor(null); setRefundNote("");
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
        <StatCard label={t("owner_payments.wallet_balance") || "Wallet Balance"} value={fmt(wallet?.balance ?? 0)} sub={t("owner_payments.available_spend") || "Available to spend"} accent="#f97316" />
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

      {payments.length === 0 ? (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"40px 24px", textAlign:"center" }}>
          <CreditCard size={28} color="#2a2a2a" style={{ marginBottom:12 }} />
          <p style={{ margin:0, color:"#444", fontSize:13 }}>{t("owner_payments.no_transactions") || "No transactions yet"}</p>
          <p style={{ margin:"6px 0 0", color:"#333", fontSize:12 }}>{t("owner_payments.no_transactions_desc") || "Transactions appear here when you post jobs."}</p>
        </div>
      ) : (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, overflow:"hidden", marginBottom:14 }}>
          {payments.map((p, i) => {
            const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.PENDING;
            const localizedStatus = t("seeker_jobs.status_" + p.status.toLowerCase()) || s.label;
            const isHeld = p.status === "HELD";

            return (
              <div key={p.id} className="payment-row" style={{
                borderBottom: i < payments.length - 1 ? "1px solid #181818" : "none",
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
                  </div>
                </div>
                <div className="payment-meta" style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
                  <span style={{ fontSize:10, fontWeight:700, borderRadius:99, padding:"3px 9px", color:s.color, background:s.bg }}>{localizedStatus}</span>
                  <p style={{ margin:0, fontSize:15, fontWeight:800, color:"#e0e0e0" }}>{fmt(p.amountRwf)}</p>
                  {p.type === "PAYMENT" && isHeld && (
                    <button onClick={() => { setRefundFor(p); setRefundNote(""); }} style={{ background:"rgba(96,165,250,0.07)", border:"1px solid rgba(96,165,250,0.15)", color:"#60a5fa", borderRadius:7, padding:"5px 10px", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                      {t("owner_payments.refund_btn") || "Refund"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Escrow info */}
      <div style={{ background:"rgba(34,197,94,0.03)", border:"1px solid rgba(34,197,94,0.1)", borderRadius:12, padding:"14px 18px", display:"flex", gap:10 }}>
        <Shield size={16} color="#22c55e" style={{ flexShrink:0, marginTop:1 }} />
        <p style={{ margin:0, fontSize:12, color:"#3e3e3e", lineHeight:1.7 }}>
          {t("owner_payments.escrow_info_desc") || "Each job requires a full escrow deposit (rate × hours × workers + 5% fee) deducted from your wallet at posting time. Funds are held securely and released only when you mark the job complete. You can request a refund on any HELD payment."}
        </p>
      </div>

      {/* Top-up modal */}
      {topupOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#111", border:"1px solid #222", borderRadius:18, width:"100%", maxWidth:440, padding:"28px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#fff" }}>{t("owner_payments.top_up_modal") || "Top Up Wallet"}</p>
              <button onClick={() => { setTopupOpen(false); setTopupErr(""); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#555" }}><X size={18} /></button>
            </div>

            {/* Provider selector */}
            <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>{t("owner_payments.momo_provider") || "MOBILE MONEY PROVIDER"}</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
              {/* MTN */}
              <button onClick={() => setTopupMethod("MTN_MOMO")} style={{
                background: topupMethod === "MTN_MOMO" ? "rgba(255,204,0,0.08)" : "#141414",
                border:`1px solid ${topupMethod === "MTN_MOMO" ? "#ffcc00" : "#222"}`,
                borderRadius:12, padding:"14px 12px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:12, transition:"all 0.15s",
              }}>
                {/* MTN logo mark */}
                <div style={{ width:38, height:38, borderRadius:8, background:"#ffcc00", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="24" height="14" viewBox="0 0 60 34" fill="none">
                    <path d="M0 0h12l18 22L48 0h12v34H48V14L30 34 12 14v20H0V0z" fill="#000"/>
                  </svg>
                </div>
                <div style={{ textAlign:"left" }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:800, color: topupMethod === "MTN_MOMO" ? "#ffcc00" : "#d0d0d0" }}>MTN</p>
                  <p style={{ margin:0, fontSize:10, color:"#555" }}>Mobile Money</p>
                </div>
              </button>
              {/* Airtel */}
              <button onClick={() => setTopupMethod("AIRTEL_MONEY")} style={{
                background: topupMethod === "AIRTEL_MONEY" ? "rgba(255,0,0,0.08)" : "#141414",
                border:`1px solid ${topupMethod === "AIRTEL_MONEY" ? "#ff3333" : "#222"}`,
                borderRadius:12, padding:"14px 12px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:12, transition:"all 0.15s",
              }}>
                {/* Airtel logo mark */}
                <div style={{ width:38, height:38, borderRadius:8, background:"#ff0000", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="22" height="22" viewBox="0 0 50 50" fill="none">
                    <path d="M25 5 C14 5 5 14 5 25 C5 36 14 45 25 45 C36 45 45 36 45 25 C45 14 36 5 25 5Z M25 38 C17 38 12 32 12 25 C12 18 17 12 25 12 C30 12 34 15 36 19 L29 22 C28 20 26 19 25 19 C21 19 19 22 19 25 C19 28 21 31 25 31 C27 31 29 30 30 28 L37 31 C35 35 30 38 25 38Z" fill="#fff"/>
                  </svg>
                </div>
                <div style={{ textAlign:"left" }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:800, color: topupMethod === "AIRTEL_MONEY" ? "#ff4444" : "#d0d0d0" }}>Airtel</p>
                  <p style={{ margin:0, fontSize:10, color:"#555" }}>Airtel Money</p>
                </div>
              </button>
            </div>

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>{t("owner_payments.amount_rwf") || "AMOUNT (RWF)"}</p>
            <input style={{ ...inp, marginBottom:14 }} type="number" min="100" placeholder="e.g. 50,000" value={topupAmt} onChange={e => setTopupAmt(e.target.value)} />

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>
              {t("owner_payments.phone_label", { provider: topupMethod === "MTN_MOMO" ? "MTN" : "AIRTEL" }) || `${topupMethod === "MTN_MOMO" ? "MTN" : "AIRTEL"} PHONE NUMBER`}
            </p>
            <input style={{ ...inp, marginBottom:6 }} type="tel"
              placeholder={topupMethod === "MTN_MOMO" ? "e.g. 0788 123 456" : "e.g. 0738 123 456"}
              value={topupPhone} onChange={e => setTopupPhone(e.target.value)} />
            <p style={{ margin:"0 0 18px", fontSize:11, color:"#2a2a2a", lineHeight:1.6 }}>
              {t("owner_payments.topup_hint") || "A USSD prompt will be sent to your phone. Approve it to complete the top-up. Funds appear in your wallet automatically once confirmed."}
            </p>

            {topupErr && <p style={{ margin:"0 0 12px", fontSize:12, color:"#ef4444", background:"rgba(239,68,68,0.07)", borderRadius:8, padding:"8px 12px" }}>{topupErr}</p>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={doTopup} disabled={topupBusy} style={{
                flex:1, background: topupMethod === "MTN_MOMO" ? "#ffcc00" : "#ff0000",
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
            <input
              autoFocus
              value={refundNote}
              onChange={e => setRefundNote(e.target.value)}
              placeholder="e.g. Job cancelled, worker did not show up"
              style={{ ...inp, marginBottom:20 }}
            />
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={doRefund} disabled={refundBusy} style={{ flex:1, background:"#60a5fa", color:"#fff", border:"none", borderRadius:9, padding:"11px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {refundBusy ? <Loader2 size={14} style={{ animation:"spin 0.7s linear infinite" }} /> : (t("owner_payments.confirm_refund") || "Confirm Refund")}
              </button>
              <button onClick={() => setRefundFor(null)} style={{ flex:1, background:"transparent", color:"#555", border:"1px solid #222", borderRadius:9, padding:"11px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
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
