"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Shield,
  X, Loader2, CreditCard, Clock,
} from "lucide-react";
import {
  getWallet, getWalletTransactions, requestWithdrawal, apiError,
  type WalletDto, type PaymentDto,
} from "@/lib/api";
type WdMethod = "MTN_MOMO" | "AIRTEL_MONEY";
import { StatCard, SectionHead, PageLoader } from "@/components/dashboard/ui";
import { fmt } from "@/lib/dashboard-data";

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  RELEASED: { label:"Released",   color:"#22c55e", bg:"rgba(34,197,94,0.08)"   },
  SUCCESS:  { label:"Success",    color:"#22c55e", bg:"rgba(34,197,94,0.08)"   },
  PENDING:  { label:"In Escrow",  color:"#f59e0b", bg:"rgba(245,158,11,0.08)"  },
  HELD:     { label:"In Escrow",  color:"#f59e0b", bg:"rgba(245,158,11,0.08)"  },
  REFUNDED: { label:"Refunded",   color:"#60a5fa", bg:"rgba(96,165,250,0.08)"  },
  FAILED:   { label:"Failed",     color:"#ef4444", bg:"rgba(239,68,68,0.08)"   },
};

export default function SeekerEarnings() {
  const [wallet,   setWallet]   = useState<WalletDto | null>(null);
  const [txns,     setTxns]     = useState<PaymentDto[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [wdOpen,    setWdOpen]    = useState(false);
  const [wdAmt,     setWdAmt]     = useState("");
  const [wdPhone,   setWdPhone]   = useState("");
  const [wdMethod,  setWdMethod]  = useState<WdMethod>("MTN_MOMO");
  const [wdBusy,    setWdBusy]    = useState(false);
  const [wdErr,     setWdErr]     = useState("");

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

  const doWithdraw = async () => {
    const token = localStorage.getItem("access_token")!;
    const amount = parseInt(wdAmt, 10);
    if (!amount || amount < 500) { setWdErr("Minimum withdrawal is RWF 500"); return; }
    if (amount > (wallet?.balance ?? 0)) { setWdErr("Amount exceeds wallet balance"); return; }
    if (!wdPhone.trim() || wdPhone.replace(/\D/g,"").length < 9) { setWdErr("Enter a valid phone number"); return; }
    setWdBusy(true); setWdErr("");
    try {
      await requestWithdrawal({ amount, phoneNumber: wdPhone.trim(), paymentMethod: wdMethod }, token);
      await load(); // refresh wallet + transactions
      setWdOpen(false); setWdAmt(""); setWdPhone("");
    } catch (e: any) {
      setWdErr(apiError(e, "Withdrawal failed. Please try again."));
    } finally { setWdBusy(false); }
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
      {/* Wallet hero card */}
      <div style={{
        background:"linear-gradient(135deg,#141414 0%,#111 100%)",
        border:"1px solid #1c1c1c", borderRadius:18, padding:"28px 28px",
        marginBottom:20, position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:-50, right:-50, width:180, height:180, borderRadius:999, background:"rgba(249,115,22,0.03)", pointerEvents:"none" }} />
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <Wallet size={16} color="#f97316" />
          <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.08em" }}>My Wallet</p>
        </div>
        <p style={{ margin:"0 0 6px", fontSize:42, fontWeight:900, color:"#fff", letterSpacing:"-2px" }}>
          {fmt(wallet?.balance ?? 0)}
        </p>
        <p style={{ margin:"0 0 22px", fontSize:12, color:"#333" }}>
          {fmt(inEscrow)} in escrow · {fmt(released)} released total
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
          Withdraw to MoMo
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:28 }}>
        <StatCard label="Total Released" value={fmt(released)}      sub="Paid to wallet"      accent="#22c55e" />
        <StatCard label="In Escrow"      value={fmt(inEscrow)}      sub="Awaiting completion" accent="#f59e0b" />
        <StatCard label="Jobs Paid"      value={String(jobCount)}   sub="Completed jobs"      accent="#60a5fa" />
      </div>

      {/* Transaction list */}
      <SectionHead title="Transaction History" />

      {txns.length === 0 ? (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"40px 24px", textAlign:"center" }}>
          <CreditCard size={28} color="#2a2a2a" style={{ marginBottom:12 }} />
          <p style={{ margin:"0 0 6px", color:"#555", fontSize:14, fontWeight:600 }}>No transactions yet</p>
          <p style={{ margin:0, color:"#333", fontSize:12 }}>Earnings appear here when employers release payment after completing a job.</p>
        </div>
      ) : (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, overflow:"hidden", marginBottom:16 }}>
          {txns.map((t, i) => {
            const s = STATUS_STYLE[t.status] ?? STATUS_STYLE.PENDING;
            const isRelease = t.status === "RELEASED";
            return (
              <div key={t.id} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"16px 20px",
                borderBottom: i < txns.length - 1 ? "1px solid #181818" : "none",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0 }}>
                  <div style={{ width:40, height:40, borderRadius:10, flexShrink:0, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {isRelease
                      ? <ArrowUpRight size={16} color="#22c55e" />
                      : t.status === "REFUNDED"
                      ? <ArrowDownLeft size={16} color="#60a5fa" />
                      : <Clock size={16} color="#f59e0b" />}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, color:"#d0d0d0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {t.jobTitle ?? (t.notes?.includes("Withdrawal") ? "Withdrawal" : "Transaction")}
                    </p>
                    <p style={{ margin:0, fontSize:11, color:"#333" }}>
                      {new Date(t.createdAt).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
                      {isRelease && t.releasedAt ? ` · Released ${new Date(t.releasedAt).toLocaleDateString()}` : ""}
                    </p>
                    {t.notes?.includes("Withdrawal") && (
                      <p style={{ margin:0, fontSize:10, color:"#3a3a3a" }}>{t.notes}</p>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                  <span style={{ fontSize:10, fontWeight:700, borderRadius:99, padding:"3px 9px", color:s.color, background:s.bg }}>{s.label}</span>
                  <p style={{ margin:0, fontSize:15, fontWeight:800, color: isRelease ? "#22c55e" : "#e0e0e0" }}>
                    {isRelease ? "+" : ""}{fmt(t.amountRwf)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Escrow explanation */}
      <div style={{ background:"rgba(34,197,94,0.03)", border:"1px solid rgba(34,197,94,0.1)", borderRadius:12, padding:"14px 18px", display:"flex", gap:10 }}>
        <Shield size={16} color="#22c55e" style={{ flexShrink:0, marginTop:2 }} />
        <p style={{ margin:0, fontSize:12, color:"#3e3e3e", lineHeight:1.7 }}>
          Employers deposit funds into escrow when posting a job. Your earnings are held securely until the employer marks the job complete.
          Once released, funds appear in your wallet balance and can be withdrawn to your MoMo account.
        </p>
      </div>

      {/* Withdraw modal */}
      {wdOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#111", border:"1px solid #222", borderRadius:18, width:"100%", maxWidth:440, padding:"28px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#fff" }}>Withdraw to Mobile Money</p>
              <button onClick={() => { setWdOpen(false); setWdErr(""); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#555" }}><X size={18} /></button>
            </div>

            <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:10, padding:"12px 16px", marginBottom:18 }}>
              <p style={{ margin:"0 0 2px", fontSize:11, color:"#3a3a3a" }}>Available balance</p>
              <p style={{ margin:0, fontSize:22, fontWeight:900, color:"#22c55e" }}>{fmt(wallet?.balance ?? 0)}</p>
            </div>

            {/* Provider selector */}
            <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>MOBILE MONEY PROVIDER</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
              <button onClick={() => setWdMethod("MTN_MOMO")} style={{
                background: wdMethod === "MTN_MOMO" ? "rgba(255,204,0,0.08)" : "#141414",
                border:`1px solid ${wdMethod === "MTN_MOMO" ? "#ffcc00" : "#222"}`,
                borderRadius:12, padding:"14px 12px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:12, transition:"all 0.15s",
              }}>
                <div style={{ width:38, height:38, borderRadius:8, background:"#ffcc00", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="24" height="14" viewBox="0 0 60 34" fill="none">
                    <path d="M0 0h12l18 22L48 0h12v34H48V14L30 34 12 14v20H0V0z" fill="#000"/>
                  </svg>
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
              }}>
                <div style={{ width:38, height:38, borderRadius:8, background:"#ff0000", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="22" height="22" viewBox="0 0 50 50" fill="none">
                    <path d="M25 5 C14 5 5 14 5 25 C5 36 14 45 25 45 C36 45 45 36 45 25 C45 14 36 5 25 5Z M25 38 C17 38 12 32 12 25 C12 18 17 12 25 12 C30 12 34 15 36 19 L29 22 C28 20 26 19 25 19 C21 19 19 22 19 25 C19 28 21 31 25 31 C27 31 29 30 30 28 L37 31 C35 35 30 38 25 38Z" fill="#fff"/>
                  </svg>
                </div>
                <div style={{ textAlign:"left" }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:800, color: wdMethod === "AIRTEL_MONEY" ? "#ff4444" : "#d0d0d0" }}>Airtel</p>
                  <p style={{ margin:0, fontSize:10, color:"#555" }}>Airtel Money</p>
                </div>
              </button>
            </div>

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>AMOUNT (RWF)</p>
            <input
              style={{ ...inp, marginBottom:14 }}
              type="number" min="1000" max={wallet?.balance ?? 0}
              placeholder="Min. RWF 500"
              value={wdAmt} onChange={e => setWdAmt(e.target.value)}
            />

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a", letterSpacing:"0.06em" }}>
              {wdMethod === "MTN_MOMO" ? "MTN" : "AIRTEL"} PHONE NUMBER
            </p>
            <input
              style={{ ...inp, marginBottom:6 }}
              type="tel"
              placeholder={wdMethod === "MTN_MOMO" ? "e.g. 0788 123 456" : "e.g. 0738 123 456"}
              value={wdPhone} onChange={e => setWdPhone(e.target.value)}
            />
            <p style={{ margin:"0 0 18px", fontSize:11, color:"#2a2a2a", lineHeight:1.6 }}>
              Funds will be sent to your mobile money account within minutes.
            </p>

            {wdErr && <p style={{ margin:"0 0 12px", fontSize:12, color:"#ef4444", background:"rgba(239,68,68,0.07)", borderRadius:8, padding:"8px 12px" }}>{wdErr}</p>}

            <div style={{ display:"flex", gap:10 }}>
              <button
                onClick={doWithdraw} disabled={wdBusy}
                style={{
                  flex:1, background: wdMethod === "MTN_MOMO" ? "#ffcc00" : "#ff0000",
                  color: wdMethod === "MTN_MOMO" ? "#000" : "#fff",
                  border:"none", borderRadius:9, padding:"12px", fontSize:13, fontWeight:800,
                  cursor:wdBusy ? "not-allowed" : "pointer", fontFamily:"inherit",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                }}
              >
                {wdBusy ? <><Loader2 size={14} style={{ animation:"spin 0.7s linear infinite" }} /> Processing…</> : `Withdraw ${wdAmt ? fmt(parseInt(wdAmt, 10)||0) : ""}`}
              </button>
              <button onClick={() => { setWdOpen(false); setWdErr(""); }} style={{ flex:1, background:"transparent", color:"#555", border:"1px solid #222", borderRadius:9, padding:"12px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
