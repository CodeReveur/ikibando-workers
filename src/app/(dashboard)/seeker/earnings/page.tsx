"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Shield,
  X, Loader2, CreditCard, Clock,
} from "lucide-react";
import {
  getWallet, getWalletTransactions, requestWithdrawalOtp, confirmWithdrawal, apiError,
  getPricingConfig, DEFAULT_PRICING, type PricingConfig,
  type WalletDto, type PaymentDto,
} from "@/lib/api";
type WdMethod = "MTN_MOMO" | "AIRTEL_MONEY";
import { StatCard, SectionHead, PageLoader } from "@/components/dashboard/ui";
import { fmt } from "@/lib/dashboard-data";
import { useLanguage } from "@/lib/language-context";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { Balance } from "@/components/ui/balance";
import { DonationAddon } from "@/components/donate/donation-addon";

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  RELEASED: { label:"Released",   color:"#22c55e", bg:"rgba(34,197,94,0.08)"   },
  SUCCESS:  { label:"Success",    color:"#22c55e", bg:"rgba(34,197,94,0.08)"   },
  PENDING:  { label:"In Escrow",  color:"#f59e0b", bg:"rgba(245,158,11,0.08)"  },
  HELD:     { label:"In Escrow",  color:"#f59e0b", bg:"rgba(245,158,11,0.08)"  },
  REFUNDED: { label:"Refunded",   color:"#60a5fa", bg:"rgba(96,165,250,0.08)"  },
  FAILED:   { label:"Failed",     color:"#ef4444", bg:"rgba(239,68,68,0.08)"   },
};

export default function SeekerEarnings() {
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

  const [wallet,   setWallet]   = useState<WalletDto | null>(null);
  const [txns,     setTxns]     = useState<PaymentDto[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [wdOpen,    setWdOpen]    = useState(false);
  const [wdAmt,     setWdAmt]     = useState("");
  const [wdPhone,   setWdPhone]   = useState("");
  const [wdMethod,  setWdMethod]  = useState<WdMethod>("MTN_MOMO");
  const [wdBusy,    setWdBusy]    = useState(false);
  const [wdErr,     setWdErr]     = useState("");
  // OTP step: after details are submitted we email a code the user must confirm.
  const [wdStep,    setWdStep]    = useState<"details" | "otp">("details");
  const [wdDonation, setWdDonation] = useState(0);
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  useEffect(() => { getPricingConfig().then(setPricing).catch(() => {}); }, []);
  const [wdCode,    setWdCode]    = useState("");

  const load = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const [w, t] = await Promise.all([getWallet(token), getWalletTransactions(token)]);
      setWallet(w); setTxns(t);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeWd = () => {
    setWdOpen(false); setWdErr(""); setWdStep("details"); setWdCode("");
  };

  // Step 1: validate and request an email OTP.
  const doWithdraw = async () => {
    const token = localStorage.getItem("access_token")!;
    const amount = parseInt(wdAmt, 10);
    if (!amount || amount < 500) { setWdErr(t("seeker_earnings.min_wd_err") || "Minimum withdrawal is RWF 500"); return; }
    const fee = pricing.withdrawalFeeRwf || 0;
    if (amount + wdDonation + fee > (wallet?.balance ?? 0)) {
      setWdErr(`Your wallet balance (${fmt(wallet?.balance ?? 0)}) is below the total of ${fmt(amount + wdDonation + fee)}`
        + ` (withdrawal ${fmt(amount)}${wdDonation > 0 ? ` + ${fmt(wdDonation)} donation` : ""} + ${fmt(fee)} fee).`);
      return;
    }
    if (!wdPhone.trim() || wdPhone.replace(/\D/g,"").length < 9) { setWdErr(t("seeker_earnings.valid_phone_err") || "Enter a valid phone number"); return; }
    setWdBusy(true); setWdErr("");
    try {
      await requestWithdrawalOtp({ amount, phoneNumber: wdPhone.trim(), paymentMethod: wdMethod, donationRwf: wdDonation > 0 ? wdDonation : undefined }, token);
      setWdStep("otp"); setWdCode("");
      toastSuccess(t("seeker_earnings.otp_sent_toast") || "We've emailed you a code to confirm this withdrawal.");
    } catch (e: any) {
      const errMsg = apiError(e, t("seeker_earnings.wd_failed_err") || "Withdrawal failed. Please try again.");
      setWdErr(errMsg);
      toastError(errMsg);
    } finally { setWdBusy(false); }
  };

  // Step 2: confirm the emailed OTP and finalise the withdrawal.
  const confirmWd = async () => {
    const token = localStorage.getItem("access_token")!;
    const code = wdCode.trim();
    if (code.length !== 6) { setWdErr(t("seeker_earnings.otp_len_err") || "Enter the 6-digit code from your email"); return; }
    setWdBusy(true); setWdErr("");
    try {
      await confirmWithdrawal(code, token);
      await load(); // refresh wallet + transactions
      closeWd(); setWdAmt(""); setWdPhone("");
      toastSuccess(t("seeker_earnings.wd_success_toast") || "Withdrawal request submitted successfully!");
    } catch (e: any) {
      const errMsg = apiError(e, t("seeker_earnings.wd_failed_err") || "Withdrawal failed. Please try again.");
      setWdErr(errMsg);
      toastError(errMsg);
    } finally { setWdBusy(false); }
  };

  // Resend the OTP (re-uses the same details).
  const resendWd = async () => {
    const token = localStorage.getItem("access_token")!;
    const amount = parseInt(wdAmt, 10);
    setWdBusy(true); setWdErr("");
    try {
      await requestWithdrawalOtp({ amount, phoneNumber: wdPhone.trim(), paymentMethod: wdMethod, donationRwf: wdDonation > 0 ? wdDonation : undefined }, token);
      toastSuccess(t("seeker_earnings.otp_resent_toast") || "A new code has been emailed to you.");
    } catch (e: any) {
      toastError(apiError(e, t("seeker_earnings.wd_failed_err") || "Could not resend the code."));
    } finally { setWdBusy(false); }
  };

  const localizedStatusLabel = (status: string, type: string) => {
    if (type === "WITHDRAWAL" || type === "TOPUP") {
      if (status === "SUCCESS") return t("common.general.success") || "Success";
      if (status === "PENDING") return t("seeker_jobs.status_pending") || "Pending";
      if (status === "FAILED") return t("common.general.failed") || "Failed";
    }
    if (status === "RELEASED" || status === "SUCCESS") return t("seeker_earnings.released_on") || "Released";
    if (status === "PENDING" || status === "HELD") return t("seeker_earnings.in_escrow") || "In Escrow";
    if (status === "REFUNDED") return t("seeker_jobs.status_refunded") || "Refunded";
    if (status === "FAILED") return t("common.general.failed") || "Failed";
    return status;
  };

  if (loading) return <PageLoader />;

  const jobTxns     = txns.filter(t => t.type === "PAYMENT");
  const released    = jobTxns.filter(t => t.status === "RELEASED").reduce((s, t) => s + t.amountRwf, 0);
  const inEscrow    = jobTxns.filter(t => t.status === "PENDING" || t.status === "HELD").reduce((s, t) => s + t.amountRwf, 0);
  const jobCount    = jobTxns.filter(t => t.status === "RELEASED").length;

  const inp: React.CSSProperties = {
    width:"100%", background:"#131313", border:"1px solid #222", borderRadius:9,
    padding:"10px 14px", fontSize:13, color:"#d0d0d0", fontFamily:"inherit",
    outline:"none", boxSizing:"border-box",
  };

  return (
    <div>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .seeker-stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:28px; }
        .txn-row-link { display:flex; align-items:center; justify-content:space-between; text-decoration:none; cursor:pointer; transition:background 0.15s; }
        .txn-row-link:hover { background: rgba(255,255,255,0.02) !important; }
        @media (max-width: 900px) {
          .seeker-stats-grid { grid-template-columns:1fr; }
        }
        @media (max-width: 340px) {
          .seeker-stats-grid { gap:6px; }
          .wd-providers { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Wallet hero card */}
      <div style={{
        background:"linear-gradient(135deg,#141414 0%,#111 100%)",
        border:"1px solid #1c1c1c", borderRadius:18, padding:"28px 28px",
        marginBottom:20, position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:-50, right:-50, width:180, height:180, borderRadius:999, background:"rgba(249,115,22,0.03)", pointerEvents:"none" }} />
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <Wallet size={16} color="#f97316" />
          <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.08em" }}>{t("seeker_earnings.my_wallet")}</p>
        </div>
        <p style={{ margin:"0 0 6px", fontSize:42, fontWeight:900, color:"#fff", letterSpacing:"-2px" }}>
          <Balance amount={wallet?.balance ?? 0} toggle />
        </p>
        <p style={{ margin:"0 0 22px", fontSize:12, color:"#333" }}>
          {t("seeker_earnings.in_escrow_released")
            ?.replace("{inEscrow}", fmt(inEscrow))
            ?.replace("{released}", fmt(released)) || `${fmt(inEscrow)} in escrow · ${fmt(released)} released total`}
        </p>
        <button
          onClick={() => { setWdOpen(true); setWdAmt(""); setWdPhone(""); setWdErr(""); }}
          disabled={(wallet?.balance ?? 0) <= 0}
          style={{
            background: (wallet?.balance ?? 0) > 0 ? "#f97316" : "#2a2a2a",
            color: (wallet?.balance ?? 0) > 0 ? "#fff" : "#555",
            border:"none", borderRadius:9, padding:"11px 22px",
            fontSize:13, fontWeight:700, cursor:(wallet?.balance ?? 0) > 0 ? "pointer" : "not-allowed",
            fontFamily:"inherit",
          }}>
          {t("seeker_earnings.withdraw_momo")}
        </button>
      </div>

      {/* Stats */}
      <div className="seeker-stats-grid">
        <StatCard label={t("seeker_earnings.total_released")} value={fmt(released)}      sub={t("seeker_earnings.paid_to_wallet")}      accent="#22c55e" />
        <StatCard label={t("seeker_earnings.in_escrow")}      value={fmt(inEscrow)}      sub={t("seeker_earnings.awaiting_completion")} accent="#f59e0b" />
        <StatCard label={t("seeker_earnings.jobs_paid")}      value={String(jobCount)}   sub={t("seeker_earnings.completed_jobs")}      accent="#60a5fa" />
      </div>

      {/* Transaction list */}
      <SectionHead title={t("seeker_earnings.txn_history") || "Transaction History"} />

      {txns.length === 0 ? (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"40px 24px", textAlign:"center" }}>
          <CreditCard size={28} color="#2a2a2a" style={{ marginBottom:12 }} />
          <p style={{ margin:"0 0 6px", color:"#555", fontSize:14, fontWeight:600 }}>{t("seeker_earnings.no_txns")}</p>
          <p style={{ margin:0, color:"#333", fontSize:12 }}>{t("seeker_earnings.no_txns_desc")}</p>
        </div>
      ) : (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, overflow:"hidden", marginBottom:16 }}>
          {txns.map((tX, idx) => {
            const s = STATUS_STYLE[tX.status] ?? STATUS_STYLE.PENDING;
            const isRelease = tX.status === "RELEASED";
            return (
              <Link href={`/seeker/earnings/transactions/${tX.id}`} key={tX.id} className="txn-row-link" style={{
                padding:"16px 20px",
                borderBottom: idx < txns.length - 1 ? "1px solid #181818" : "none",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0 }}>
                  <div style={{ width:40, height:40, borderRadius:10, flexShrink:0, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {isRelease
                      ? <ArrowUpRight size={16} color="#22c55e" />
                      : tX.status === "REFUNDED"
                      ? <ArrowDownLeft size={16} color="#60a5fa" />
                      : <Clock size={16} color="#f59e0b" />}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, color:"#d0d0d0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {tX.jobTitle ?? (
                        tX.type === "WITHDRAWAL" ? (t("seeker_earnings.withdrawal") || "Withdrawal") :
                        tX.type === "TOPUP" ? (t("seeker_earnings.topup") || "Top Up") :
                        tX.type === "PAYMENT" ? (t("seeker_earnings.payment") || "Job Payment") :
                        (t("seeker_jobs.tab_all") || "Transaction")
                      )}
                    </p>
                    <p style={{ margin:0, fontSize:11, color:"#333" }}>
                      {new Date(tX.createdAt).toLocaleDateString(currentLocale, { day:"numeric", month:"short", year:"numeric" })}
                      {isRelease && tX.releasedAt ? ` · ${t("seeker_earnings.released_on") || "Released"} ${new Date(tX.releasedAt).toLocaleDateString(currentLocale)}` : ""}
                    </p>
                    {tX.notes && (
                      <p style={{ margin:0, fontSize:10, color:"#3a3a3a" }}>
                        {tX.notes
                          .replace("Withdrawal to MTN MoMo", t("seeker_earnings.wd_mtn_momo") || "Withdrawal to MTN MoMo")
                          .replace("Withdrawal to Airtel Money", t("seeker_earnings.wd_airtel_money") || "Withdrawal to Airtel Money")
                        }
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                  <span style={{ fontSize:10, fontWeight:700, borderRadius:99, padding:"3px 9px", color:s.color, background:s.bg }}>{localizedStatusLabel(tX.status, tX.type)}</span>
                  <p style={{ margin:0, fontSize:15, fontWeight:800, color: isRelease ? "#22c55e" : "#e0e0e0" }}>
                    {isRelease ? "+" : ""}{fmt(tX.amountRwf)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Escrow explanation */}
      <div style={{ background:"rgba(34,197,94,0.03)", border:"1px solid rgba(34,197,94,0.1)", borderRadius:12, padding:"14px 18px", display:"flex", gap:10, marginTop:9 }}>
        <Shield size={16} color="#22c55e" style={{ flexShrink:0, marginTop:2 }} />
        <p style={{ margin:0, fontSize:12, color:"#3e3e3e", lineHeight:1.7 }}>
          {t("seeker_earnings.escrow_explain")}
        </p>
      </div>

      {/* Withdraw modal */}
      {wdOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div className="wd-modal-card" style={{ background:"#111", border:"1px solid #222", borderRadius:18, width:"100%", maxWidth:440, padding:"22px clamp(16px,4vw,26px)", maxHeight:"min(90vh, 760px)", overflowY:"auto", overflowX:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#fff" }}>{t("seeker_earnings.withdraw_title")}</p>
              <button onClick={closeWd} style={{ background:"none", border:"none", cursor:"pointer", color:"#555" }}><X size={18} /></button>
            </div>

            <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:10, padding:"12px 16px", marginBottom:18 }}>
              <p style={{ margin:"0 0 2px", fontSize:11, color:"#3a3a3a" }}>{t("seeker_earnings.available_balance")}</p>
              <p style={{ margin:0, fontSize:22, fontWeight:900, color:"#22c55e" }}><Balance amount={wallet?.balance ?? 0} toggle /></p>
            </div>

            {wdStep === "details" && (<>
            {/* Provider selector */}
            <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>{t("seeker_earnings.momo_provider")}</p>
            <div className="wd-providers" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
              <button onClick={() => setWdMethod("MTN_MOMO")} style={{
                background: wdMethod === "MTN_MOMO" ? "rgba(255,204,0,0.08)" : "#141414",
                border:`1px solid ${wdMethod === "MTN_MOMO" ? "#ffcc00" : "#222"}`,
                borderRadius:12, padding:"14px 12px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:12, transition:"all 0.15s",
                width:"100%",
              }}>
                <div style={{ width:38, height:38, borderRadius:8, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, padding:4, boxSizing:"border-box" }}>
                  <img src="/mtn.png" alt="MTN" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }} />
                </div>
                <div style={{ textAlign:"left" }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:800, color: wdMethod === "MTN_MOMO" ? "#ffcc00" : "#d0d0d0" }}>MTN</p>
                  <p style={{ margin:0, fontSize:10, color:"#555" }}>Mobile Money</p>
                </div>
              </button>
              <button onClick={() => setWdMethod("AIRTEL_MONEY")} style={{
                background: wdMethod === "AIRTEL_MONEY" ? "rgba(255,0,0,0.08)" : "#141414",
                border:`1px solid ${wdMethod === "AIRTEL_MONEY" ? "#ff3333" : "#222"}`,
                borderRadius:12, padding:"14px 12px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:12, transition:"all 0.15s",
                width:"100%",
              }}>
                <div style={{ width:38, height:38, borderRadius:8, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, padding:4, boxSizing:"border-box" }}>
                  <img src="/airtel.png" alt="Airtel" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }} />
                </div>
                <div style={{ textAlign:"left" }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:800, color: wdMethod === "AIRTEL_MONEY" ? "#ff4444" : "#d0d0d0" }}>Airtel</p>
                  <p style={{ margin:0, fontSize:10, color:"#555" }}>Airtel Money</p>
                </div>
              </button>
            </div>

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>{t("seeker_earnings.amount_rwf")}</p>
            <input
              style={{ ...inp, marginBottom:14 }}
              type="number" min="500" max={wallet?.balance ?? 0}
              placeholder={t("seeker_earnings.min_amount") || "Min. RWF 500"}
              value={wdAmt} onChange={e => setWdAmt(e.target.value)}
            />

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>
              {t("seeker_earnings.phone_num_label")?.replace("{provider}", wdMethod === "MTN_MOMO" ? "MTN" : "AIRTEL") || `${wdMethod === "MTN_MOMO" ? "MTN" : "AIRTEL"} PHONE NUMBER`}
            </p>
            <input
              style={{ ...inp, marginBottom:6 }}
              type="tel"
              placeholder={wdMethod === "MTN_MOMO" ? "e.g. 0788 123 456" : "e.g. 0738 123 456"}
              value={wdPhone} onChange={e => setWdPhone(e.target.value)}
            />
            <p style={{ margin:"0 0 12px", fontSize:11, color:"#2a2a2a", lineHeight:1.6 }}>
              {t("seeker_earnings.phone_hint")}
            </p>

            <DonationAddon usdToRwf={pricing.usdToRwf} valueRwf={wdDonation} onChange={setWdDonation} />
            {wdDonation > 0 && (
              <p style={{ margin:"8px 0 4px", fontSize:12, color:"#22c55e" }}>
                {fmt(wdDonation)} will be given as a donation from your wallet, on top of your withdrawal.
              </p>
            )}

            {/* Fee + total-from-wallet breakdown, so there are no surprises. */}
            {(() => {
              const amt = parseInt(wdAmt, 10) || 0;
              const fee = pricing.withdrawalFeeRwf || 0;
              if (amt <= 0 && fee <= 0) return null;
              const total = amt + fee + wdDonation;
              const row = (label: string, val: string, strong = false) => (
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0", color: strong ? "#e0e0e0" : "#888" }}>
                  <span>{label}</span><span style={{ fontWeight: strong ? 800 : 500 }}>{val}</span>
                </div>
              );
              return (
                <div style={{ margin:"12px 0 4px", padding:"10px 14px", background:"#131313", border:"1px solid #1c1c1c", borderRadius:10 }}>
                  {row(t("seeker_earnings.you_receive") || "You receive", fmt(amt))}
                  {fee > 0 && row(t("seeker_earnings.withdrawal_fee") || "Withdrawal fee", `− ${fmt(fee)}`)}
                  {wdDonation > 0 && row(t("donate.cta") || "Donation", `− ${fmt(wdDonation)}`)}
                  <div style={{ height:1, background:"#222", margin:"6px 0" }} />
                  {row(t("seeker_earnings.total_from_wallet") || "Total from wallet", fmt(total), true)}
                </div>
              );
            })()}
            </>)}

            {wdStep === "otp" && (<>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <Shield size={15} color="#22c55e" />
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#e0e0e0" }}>
                  {t("seeker_earnings.otp_title") || "Confirm your withdrawal"}
                </p>
              </div>
              <p style={{ margin:"0 0 14px", fontSize:12, color:"#666", lineHeight:1.6 }}>
                {t("seeker_earnings.otp_desc") || "For your security, enter the 6-digit code we just emailed you to confirm this withdrawal."}
              </p>
              <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>
                {t("seeker_earnings.otp_label") || "VERIFICATION CODE"}
              </p>
              <input
                style={{ ...inp, marginBottom:10, letterSpacing:"8px", textAlign:"center", fontSize:20, fontWeight:800 }}
                type="text" inputMode="numeric" maxLength={6}
                placeholder="000000"
                value={wdCode}
                onChange={e => setWdCode(e.target.value.replace(/\D/g,"").slice(0,6))}
              />
              <button onClick={resendWd} disabled={wdBusy} style={{ background:"none", border:"none", color:"#60a5fa", fontSize:12, fontWeight:600, cursor:"pointer", padding:0, marginBottom:16, fontFamily:"inherit" }}>
                {t("seeker_earnings.otp_resend") || "Resend code"}
              </button>
            </>)}

            {wdErr && <p style={{ margin:"0 0 12px", fontSize:12, color:"#ef4444", background:"rgba(239,68,68,0.07)", borderRadius:8, padding:"8px 12px" }}>{wdErr}</p>}

            <div style={{ display:"flex", gap:10 }}>
              <button
                onClick={wdStep === "details" ? doWithdraw : confirmWd} disabled={wdBusy}
                style={{
                  flex:1, background: wdMethod === "MTN_MOMO" ? "#ffcc00" : "#ff0000",
                  color: wdMethod === "MTN_MOMO" ? "#000" : "#fff",
                  border:"none", borderRadius:9, padding:"12px", fontSize:13, fontWeight:800,
                  cursor:wdBusy ? "not-allowed" : "pointer", fontFamily:"inherit",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                }}
              >
                {wdBusy ? (
                  <>
                    <Loader2 size={14} style={{ animation:"spin 0.7s linear infinite" }} />{" "}
                    {t("seeker_earnings.processing") || "Processing…"}
                  </>
                ) : wdStep === "details" ? (
                  t("seeker_earnings.wd_send_code") || "Continue - email me a code"
                ) : (
                  t("seeker_earnings.wd_confirm_btn")
                    ?.replace("{amount}", wdAmt ? fmt(parseInt(wdAmt, 10)||0) : "") ||
                  `Confirm withdrawal ${wdAmt ? fmt(parseInt(wdAmt, 10)||0) : ""}`
                )}
              </button>
              <button
                onClick={wdStep === "otp" ? () => { setWdStep("details"); setWdErr(""); } : closeWd}
                style={{ flex:1, background:"transparent", color:"#555", border:"1px solid #222", borderRadius:9, padding:"12px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                {wdStep === "otp" ? (t("common.general.back") || "Back") : t("seeker_earnings.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .wd-modal-card { scrollbar-width: thin; scrollbar-color: #333 transparent; }
        .wd-modal-card::-webkit-scrollbar { width: 6px; }
        .wd-modal-card::-webkit-scrollbar-track { background: transparent; }
        .wd-modal-card::-webkit-scrollbar-thumb { background: #333; border-radius: 999px; }
        .wd-modal-card::-webkit-scrollbar-thumb:hover { background: #444; }
      `}</style>
    </div>
  );
}
