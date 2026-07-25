"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Briefcase, Clock, CheckCircle, X, MapPin,
  Wallet, TrendingUp, Zap, ArrowRight, Sparkles,
} from "lucide-react";
import {
  getWallet, getMyApplications, getWalletTransactions,
  updateApplicationStatus, apiError, getAnnouncements, applicationNetHourly,
  type WalletDto, type ApplicationDto, type PaymentDto, type FeatureAnnouncement,
} from "@/lib/api";
import { StatCard, SectionHead, Dot, PageLoader } from "@/components/dashboard/ui";
import { rateUnit } from "@/lib/rate-unit";
import { fmt } from "@/lib/dashboard-data";
import { Balance } from "@/components/ui/balance";
import { useSession } from "@/components/dashboard/session-ctx";
import { useLanguage } from "@/lib/language-context";

const CSS = `
  .sk-card { transition:border-color 0.12s, background 0.12s; }
  .sk-card:hover { border-color:#222 !important; background:#141414 !important; }
  .act-btn { border-radius:8px; padding:5px 13px; font-size:11px; font-weight:700;
             cursor:pointer; font-family:inherit; transition:all 0.12s; border:1px solid; }
  .act-btn.accept  { background:rgba(34,197,94,0.07); color:#22c55e; border-color:rgba(34,197,94,0.2); }
  .act-btn.accept:hover  { background:rgba(34,197,94,0.14); border-color:#22c55e; }
  .act-btn.reject  { background:rgba(239,68,68,0.07); color:#ef4444; border-color:rgba(239,68,68,0.2); }
  .act-btn.reject:hover  { background:rgba(239,68,68,0.14); border-color:#ef4444; }
  .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:28px; }
  .wallet-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:28px; }
  @media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2,1fr); } }
  @media (max-width: 500px) { .stat-grid { grid-template-columns: 1fr; } .wallet-grid { grid-template-columns: 1fr; } }
  @media (max-width: 340px) {
    .stat-grid { gap: 6px; margin-bottom: 14px; }
    .wallet-grid { gap: 6px; margin-bottom: 14px; }
    .greeting-row { margin-bottom: 14px; }
    .act-btn { padding: 4px 8px; font-size: 10px; }
  }
  .greeting-row { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; gap:16px; flex-wrap:wrap; }
`;

export default function SeekerHome() {
  const session  = useSession();
  const { t, language } = useLanguage();
  const [wallet,  setWallet]  = useState<WalletDto | null>(null);
  const [apps,    setApps]    = useState<ApplicationDto[]>([]);
  const [txns,    setTxns]    = useState<PaymentDto[]>([]);
  const [updates, setUpdates] = useState<FeatureAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getWallet(token).catch(() => null),
      getMyApplications(token).catch(() => [] as ApplicationDto[]),
      getWalletTransactions(token).catch(() => [] as PaymentDto[]),
      getAnnouncements().catch(() => [] as FeatureAnnouncement[]),
    ]).then(([w, a, t, u]) => { setWallet(w); setApps(a); setTxns(t); setUpdates(u); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOffer = async (appId: string, status: "ACCEPTED" | "REJECTED") => {
    const token = localStorage.getItem("access_token")!;
    setRespondingId(appId);
    try {
      const updated = await updateApplicationStatus(appId, { status }, token);
      setApps(prev => prev.map(a => a.id === appId ? { ...a, ...updated } : a));
    } catch (e: any) {
      alert(apiError(e, "Failed to respond"));
    } finally { setRespondingId(null); }
  };

  if (loading) return <PageLoader />;

  const active     = apps.filter(a => a.status === "ACCEPTED");
  const pending    = apps.filter(a => a.status === "PENDING");
  const hireNow    = pending.filter(a => a.appliedVia === "HIRE_NOW");
  const earned     = txns.filter(t => t.status === "RELEASED").reduce((s, t) => s + t.amountRwf, 0);
  const recent     = [...apps].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const greeting = t(`dashboard_home.${greetingKey}`);

  const dateLocaleMap: Record<string, string> = {
    rw: "rw-RW",
    kinyy: "rw-RW",
    sw: "sw-TZ",
    fr: "fr-FR",
    en: "en-US",
  };
  const currentLocale = dateLocaleMap[language] || "en-RW";

  return (
    <div>
      <style>{CSS}</style>

      {/* Greeting */}
      <div className="greeting-row">
        <div>
          <p style={{ margin:"0 0 4px", fontSize:22, fontWeight:900, color:"#e8e8e8", letterSpacing:"-0.5px" }}>
            {greeting}, {(session?.name?.split(" ")[0] ?? t("dashboard_home.there")) || "there"} 👋
          </p>
          <p style={{ margin:0, fontSize:13, color:"#444" }}>
            {t("dashboard_home.greeting_sub")}
          </p>
        </div>
        {session?.badgeId && (
          <a 
            href={session.badgeUrl || "#"} 
            target="_blank" 
            rel="noreferrer"
            style={{ 
              background: "linear-gradient(135deg, #f97316 0%, #ea6a0a 100%)", 
              padding: "8px 16px", 
              borderRadius: "12px", 
              display: "flex", 
              alignItems: "center", 
              gap: "12px",
              boxShadow: "0 4px 14px rgba(249, 115, 22, 0.2)",
              textDecoration: "none",
              cursor: "pointer"
            }}
            title="Click to view/download badge"
          >
            {session.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.photoUrl} alt="Badge Photo" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.3)" }} />
            )}
            <div>
              <p style={{ margin: 0, fontSize: 10, textTransform: "uppercase", fontWeight: 800, color: "rgba(255,255,255,0.8)", letterSpacing: "1px" }}>{t("dashboard_home.worker_badge")}</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "1px" }}>{session.badgeId}</p>
            </div>
          </a>
        )}
      </div>

      {/* Pending admin approval */}
      {session?.role === "WORKER" && session?.approved === false && (
        <div style={{
          marginBottom: 24, padding: "16px 20px", borderRadius: 14,
          background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.3)",
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          <Clock size={22} color="#f97316" />
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 800, color: "#f4f4f4" }}>
              {session.approvalEligible
                ? t("dashboard_home.profile_under_review")
                : t("dashboard_home.complete_profile")}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#9a9a9a" }}>
              {session.approvalEligible
                ? t("dashboard_home.admin_approval_desc")
                : t("dashboard_home.profile_completion_desc")}
            </p>
          </div>
          <div style={{ minWidth: 120 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9a9a9a", marginBottom: 4 }}>
              <span>{t("dashboard_home.profile")}</span><span>{session.profileCompletion ?? 0}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "#222", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${session.profileCompletion ?? 0}%`,
                background: (session.profileCompletion ?? 0) >= 80 ? "#22c55e" : "#f97316",
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stat-grid">
        <StatCard label={t("dashboard_home.wallet_balance")}   value={<Balance amount={wallet?.balance ?? 0} />} sub={t("dashboard_home.available_balance")}   accent="#f97316" />
        <StatCard label={t("dashboard_home.active_jobs")}      value={String(active.length)}     sub={t("dashboard_home.currently_hired")}     accent="#22c55e" />
        <StatCard label={t("dashboard_home.direct_offers")}    value={String(hireNow.length)}    sub={t("dashboard_home.awaiting_reply")} accent="#60a5fa" />
        <StatCard label={t("dashboard_home.total_earned")}     value={fmt(earned)}               sub={t("dashboard_home.released_payments")}   accent="#a78bfa" />
      </div>

      {/* Direct Hire-Now Offers */}
      {hireNow.length > 0 && (
        <>
          <SectionHead title={t("dashboard_home.direct_offers_title")} action={
            <a href="/seeker/applications" style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, fontWeight:700, color:"#60a5fa", textDecoration:"none" }}>
              {t("dashboard_home.view_all")} <ArrowRight size={12} />
            </a>
          } />
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:28 }}>
            {hireNow.slice(0, 3).map(app => (
              <div key={app.id} className="sk-card" style={{
                background:"linear-gradient(135deg,#0d1a2d 0%,#131313 100%)",
                border:"1px solid #1e3a5f", borderRadius:14,
                padding:"16px 18px", display:"flex", alignItems:"center", gap:14,
              }}>
                <div style={{ width:42, height:42, borderRadius:11, flexShrink:0, background:"rgba(96,165,250,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Zap size={18} color="#60a5fa" />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#e8e8e8" }}>{app.jobTitle}</p>
                    <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:"#60a5fa", background:"rgba(96,165,250,0.1)" }}>{t("dashboard_home.direct_offer_label")}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4, flexWrap:"wrap" }}>
                    <MapPin size={10} color="#2a4a6a" />
                    <span style={{ fontSize:11, color:"#3a5a7a" }}>{app.jobDistrict}</span>
                    <Dot />
                    <span style={{ fontSize:11, color:"#3a5a7a" }}>{app.jobCategory}</span>
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <p style={{ margin:"0 0 8px", fontWeight:800, fontSize:14, color:"#f97316" }}>{fmt(applicationNetHourly(app))}/{rateUnit({ rateType: app.jobRateType }).short}</p>
                  <div style={{ display:"flex", gap:6 }}>
                    <button className="act-btn accept" disabled={respondingId === app.id}
                      onClick={() => handleOffer(app.id, "ACCEPTED")}>{t("dashboard_home.accept")}</button>
                    <button className="act-btn reject" disabled={respondingId === app.id}
                      onClick={() => handleOffer(app.id, "REJECTED")}>{t("dashboard_home.reject")}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Wallet snapshot */}
      <div className="wallet-grid">
        <div style={{ background:"linear-gradient(135deg,#141414,#111)", border:"1px solid #1c1c1c", borderRadius:14, padding:"20px 22px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-30, right:-30, width:100, height:100, borderRadius:999, background:"rgba(249,115,22,0.04)" }} />
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <Wallet size={15} color="#f97316" />
            <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.07em" }}>{t("dashboard_home.my_wallet")}</p>
          </div>
          <p style={{ margin:"0 0 4px", fontSize:28, fontWeight:900, color:"#fff", letterSpacing:"-1px" }}><Balance amount={wallet?.balance ?? 0} toggle /></p>
          <p style={{ margin:"0 0 16px", fontSize:11, color:"#333" }}>
            {fmt(wallet?.totalHeld ?? 0)} {t("dashboard_home.in_escrow")} · {fmt(wallet?.totalReleased ?? 0)} {t("dashboard_home.released")}
          </p>
          <a href="/seeker/earnings" style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, fontWeight:700, color:"#f97316", textDecoration:"none", background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.15)", borderRadius:8, padding:"7px 14px" }}>
            {t("dashboard_home.manage_wallet")} <ArrowRight size={11} />
          </a>
        </div>
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"20px 22px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <TrendingUp size={15} color="#22c55e" />
            <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.07em" }}>{t("dashboard_home.quick_stats")}</p>
          </div>
          {[
            { label: t("dashboard_home.total_applications"), value: apps.length },
            { label: t("settings_page.account.verified") || "Accepted",           value: active.length },
            { label: t("dashboard_home.pending_replies"),    value: pending.length },
            { label: t("dashboard_home.payments_released"),  value: txns.filter(t => t.status === "RELEASED").length },
          ].map(({ label, value }) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #191919" }}>
              <span style={{ fontSize:12, color:"#444" }}>{label}</span>
              <span style={{ fontSize:12, fontWeight:700, color:"#d0d0d0" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <SectionHead title={t("dashboard_home.recent_applications")} action={
        <a href="/seeker/applications" style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, fontWeight:700, color:"#f97316", textDecoration:"none" }}>
          {t("dashboard_home.see_all")} <ArrowRight size={12} />
        </a>
      } />

      {apps.length === 0 ? (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"36px 24px", textAlign:"center" }}>
          <Briefcase size={28} color="#2a2a2a" style={{ marginBottom:12 }} />
          <p style={{ margin:"0 0 6px", color:"#555", fontSize:14, fontWeight:600 }}>{t("dashboard_home.no_applications")}</p>
          <p style={{ margin:"0 0 16px", color:"#333", fontSize:12 }}>{t("dashboard_home.no_applications_desc")}</p>
          <a href="/jobs" style={{ display:"inline-block", background:"#f97316", color:"#fff", textDecoration:"none", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:700 }}>{t("dashboard_home.browse_jobs")}</a>
        </div>
      ) : (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, overflow:"hidden" }}>
          {recent.map((app, i) => {
            const STATUS_COLOR: Record<string,string> = { ACCEPTED:"#22c55e", REJECTED:"#ef4444", PENDING:"#f59e0b", WITHDRAWN:"#555" };
            const STATUS_LABEL: Record<string,string> = {
              ACCEPTED: t("settings_page.account.verified") || "Accepted",
              REJECTED: t("common.general.rejected") || "Rejected",
              PENDING: t("common.general.pending") || "Pending",
              WITHDRAWN: t("common.general.withdrawn") || "Withdrawn"
            };
            const color = STATUS_COLOR[app.status] ?? "#555";
            return (
              <div key={app.id} style={{
                display:"flex", alignItems:"center", gap:12, padding:"14px 18px",
                borderBottom: i < recent.length - 1 ? "1px solid #181818" : "none",
              }}>
                <div style={{ width:36, height:36, borderRadius:9, flexShrink:0, background:`${color}11`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {app.status === "ACCEPTED" ? <CheckCircle size={16} color={color} />
                    : app.status === "REJECTED" ? <X size={16} color={color} />
                    : <Clock size={16} color={color} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:600, color:"#d0d0d0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{app.jobTitle}</p>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                    <span style={{ fontSize:11, color:"#3a3a3a" }}>{app.jobCategory}</span>
                    <Dot />
                    <span style={{ fontSize:11, color:"#3a3a3a" }}>{new Date(app.createdAt).toLocaleDateString(currentLocale)}</span>
                    {app.appliedVia === "HIRE_NOW" && (
                      <><Dot /><span style={{ fontSize:11, color:"#a78bfa", fontWeight:600 }}>{t("dashboard_home.direct_offer_label")}</span></>
                    )}
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <p style={{ margin:"0 0 3px", fontSize:13, fontWeight:800, color:"#f97316" }}>{fmt(applicationNetHourly(app))}/{rateUnit({ rateType: app.jobRateType }).short}</p>
                  <span style={{ fontSize:10, fontWeight:700, borderRadius:99, padding:"2px 8px", color, background:`${color}18` }}>
                    {STATUS_LABEL[app.status] ?? app.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Worker updates - latest platform features / announcements */}
      {updates.length > 0 && (
        <>
          <div style={{ marginTop: 28 }}>
            <SectionHead title={t("dashboard_home.updates_title") || "What's new"} action={
              <a href="/blog?category=PRODUCT_UPDATE" style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, fontWeight:700, color:"#f97316", textDecoration:"none" }}>
                {t("dashboard_home.see_all")} <ArrowRight size={12} />
              </a>
            } />
          </div>
          <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, overflow:"hidden" }}>
            {updates.slice(0, 3).map((u, i, arr) => {
              const inner = (
                <>
                  <div style={{ width:36, height:36, borderRadius:9, flexShrink:0, background:"rgba(249,115,22,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Sparkles size={16} color="#f97316" />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, color:"#d0d0d0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.title}</p>
                    {u.description && (
                      <p style={{ margin:"3px 0 0", fontSize:11, color:"#3a3a3a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.description}</p>
                    )}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:11, color:"#333" }}>{new Date(u.createdAt).toLocaleDateString(currentLocale)}</span>
                    {u.url && <ArrowRight size={13} color="#f97316" />}
                  </div>
                </>
              );
              const rowStyle: React.CSSProperties = {
                display:"flex", alignItems:"center", gap:12, padding:"14px 18px",
                borderBottom: i < arr.length - 1 ? "1px solid #181818" : "none",
                textDecoration:"none",
              };
              return u.url
                ? <a key={u.id} href={u.url} style={rowStyle} className="sk-card">{inner}</a>
                : <div key={u.id} style={rowStyle}>{inner}</div>;
            })}
          </div>
        </>
      )}
    </div>
  );
}
