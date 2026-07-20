"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Briefcase, MapPin, Star, Clock, CheckCircle,
  Wallet, Zap, X,
} from "lucide-react";
import {
  getMyApplications, getWalletTransactions, applicationNetHourly,
  type ApplicationDto, type PaymentDto,
} from "@/lib/api";
import { ST, fmt } from "@/lib/dashboard-data";
import { StatCard, SectionHead, Dot, PageLoader } from "@/components/dashboard/ui";
import { useLanguage } from "@/lib/language-context";

const CSS = `
  .job-card { transition:border-color 0.12s, background 0.12s; }
  .job-card:hover { border-color:#222 !important; }
  .seeker-stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
  .seeker-tabs { display:flex; gap:4px; margin-bottom:18px; background:#0f0f0f; border-radius:10px; padding:4px; width:fit-content; }
  .seeker-summary-box { margin-top:20px; background:rgba(249,115,22,0.03); border:1px solid rgba(249,115,22,0.1); border-radius:12px; padding:14px 18px; display:flex; gap:24px; flex-wrap:wrap; }
  @media (max-width: 900px) {
    .seeker-stats-grid { grid-template-columns:repeat(2,1fr); }
  }
  @media (max-width: 500px) {
    .seeker-stats-grid { grid-template-columns:1fr; }
  }
  @media (max-width: 340px) {
    .seeker-stats-grid { gap:6px; margin-bottom:14px; }
    .seeker-tabs { flex-wrap:wrap; width:100%; justify-content:center; }
    .seeker-summary-box { padding:8px 12px; gap:12px; }
  }
`;

type TabKey = "active" | "completed" | "all";

export default function SeekerJobs() {
  const { t, language } = useLanguage();
  const [apps,    setApps]    = useState<ApplicationDto[]>([]);
  const [txns,    setTxns]    = useState<PaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<TabKey>("all");

  const load = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getMyApplications(token).catch(() => [] as ApplicationDto[]),
      getWalletTransactions(token).catch(() => [] as PaymentDto[]),
    ]).then(([a, t]) => { setApps(a); setTxns(t); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const paymentByJob = Object.fromEntries(txns.map(p => [p.jobId, p]));

  const accepted  = apps.filter(a => a.status === "ACCEPTED");
  const active    = accepted.filter(a => paymentByJob[a.jobId]?.status !== "RELEASED");
  const completed = accepted.filter(a => paymentByJob[a.jobId]?.status === "RELEASED");
  const hireNow   = accepted.filter(a => a.appliedVia === "HIRE_NOW");

  const totalEarned = txns.filter(t => t.status === "RELEASED").reduce((s, t) => s + t.amountRwf, 0);
  const inEscrow    = txns.filter(t => t.status === "PENDING" || t.status === "HELD").reduce((s, t) => s + t.amountRwf, 0);

  const displayed = (() => {
    if (tab === "active")    return active;
    if (tab === "completed") return completed;
    return accepted;
  })();

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key:"all",       label: `${t("seeker_jobs.tab_all") || "All"} (${accepted.length})`,        count:accepted.length },
    { key:"active",    label: `${t("seeker_jobs.tab_active") || "Active"} (${active.length})`,       count:active.length },
    { key:"completed", label: `${t("seeker_jobs.tab_completed") || "Completed"} (${completed.length})`, count:completed.length },
  ];

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

      {/* Stats */}
      <div className="seeker-stats-grid">
        <StatCard label={t("seeker_jobs.active_jobs")}    value={String(active.length)}    sub={t("seeker_jobs.in_progress")}       accent="#22c55e" />
        <StatCard label={t("seeker_jobs.completed")}      value={String(completed.length)} sub={t("seeker_jobs.paid_out")}          accent="#60a5fa" />
        <StatCard label={t("seeker_jobs.via_hire_now")}   value={String(hireNow.length)}   sub={t("seeker_jobs.direct_hires")}      accent="#a78bfa" />
        <StatCard label={t("seeker_jobs.total_earned")}   value={fmt(totalEarned)}         sub={t("seeker_jobs.released_earnings")} accent="#f97316" />
      </div>

      {/* Tabs */}
      <div className="seeker-tabs">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding:"7px 18px", borderRadius:7, fontSize:12, fontWeight:700, border:"none",
            cursor:"pointer", fontFamily:"inherit", transition:"all 0.12s",
            background: tab === key ? "#1c1c1c" : "transparent",
            color: tab === key ? "#f97316" : "#444",
            boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
          }}>
            {label}
          </button>
        ))}
        {/* Applications live under Jobs now (one sidebar entry for the whole
            journey: you apply, then you work). */}
        <a href="/seeker/applications" style={{
          padding: "7px 18px", borderRadius: 7, fontSize: 12, fontWeight: 700,
          textDecoration: "none", color: "#444", transition: "all 0.12s",
        }}>
          {t("common.nav.applications") || "Applications"}
        </a>
      </div>

      {loading && <PageLoader />}

      {!loading && displayed.length === 0 && (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"40px 24px", textAlign:"center" }}>
          <Briefcase size={28} color="#2a2a2a" style={{ marginBottom:12 }} />
          <p style={{ margin:"0 0 6px", color:"#555", fontSize:14, fontWeight:600 }}>
            {tab === "active" ? t("seeker_jobs.no_active") : tab === "completed" ? t("seeker_jobs.no_completed") : t("seeker_jobs.no_hired")}
          </p>
          <p style={{ margin:"0 0 16px", color:"#333", fontSize:12 }}>
            {tab !== "completed" && <a href="/jobs" style={{ color:"#f97316" }}>{t("seeker_jobs.browse_open_jobs_desc")}</a>}
          </p>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {displayed.map(app => {
          const pmt        = paymentByJob[app.jobId];
          const isReleased = pmt?.status === "RELEASED";
          const isEscrow   = pmt?.status === "HELD" || pmt?.status === "PENDING";
          const feedback   = pmt?.notes?.includes("Feedback:") ? pmt.notes.split("Feedback:")[1]?.trim() : null;

          return (
            <div key={app.id} className="job-card" style={{
              background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, overflow:"hidden",
            }}>
              {/* Header */}
              <div style={{ padding:"18px 20px", display:"flex", alignItems:"flex-start", gap:14 }}>
                <div style={{
                  width:46, height:46, borderRadius:12, flexShrink:0,
                  background: isReleased ? "rgba(34,197,94,0.08)" : isEscrow ? "rgba(249,115,22,0.08)" : "rgba(96,165,250,0.08)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  {isReleased
                    ? <CheckCircle size={20} color="#22c55e" />
                    : app.appliedVia === "HIRE_NOW"
                    ? <Zap size={20} color="#a78bfa" />
                    : <Briefcase size={20} color="#f97316" />}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#e8e8e8" }}>{app.jobTitle}</p>

                    {isReleased && (
                      <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:"#22c55e", background:"rgba(34,197,94,0.1)" }}>{t("seeker_jobs.status_completed")}</span>
                    )}
                    {isEscrow && (
                      <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:"#f59e0b", background:"rgba(245,158,11,0.1)" }}>{t("seeker_jobs.status_in_progress")}</span>
                    )}
                    {!pmt && (
                      <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:"#60a5fa", background:"rgba(96,165,250,0.1)" }}>{t("seeker_jobs.status_hired")}</span>
                    )}
                    {app.appliedVia === "HIRE_NOW" && (
                      <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:"#a78bfa", background:"rgba(167,139,250,0.1)" }}>{t("seeker_jobs.status_direct_hire")}</span>
                    )}
                  </div>

                  <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:5, flexWrap:"wrap" }}>
                    <MapPin size={10} color="#2a2a2a" />
                    <span style={{ fontSize:12, color:"#3a3a3a" }}>{app.jobDistrict}</span>
                    <Dot />
                    <span style={{ fontSize:12, color:"#3a3a3a" }}>{app.jobCategory}</span>
                    <Dot />
                    <Clock size={10} color="#2a2a2a" />
                    <span style={{ fontSize:12, color:"#3a3a3a" }}>{new Date(app.createdAt).toLocaleDateString(currentLocale)}</span>
                  </div>

                  {app.responseNote && (
                    <p style={{ margin:"6px 0 0", fontSize:11, color:"#22c55e", fontStyle:"italic" }}>
                      {t("seeker_jobs.note_from_employer")} "{app.responseNote}"
                    </p>
                  )}
                </div>

                {/* Rate + earnings + track link */}
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <p style={{ margin:0, fontWeight:800, fontSize:15, color:"#f97316" }}>
                    {fmt(applicationNetHourly(app))}<span style={{ fontSize:10, color:"#3a3a3a" }}>/hr</span>
                  </p>
                  {pmt && (
                    <p style={{ margin:"4px 0 0", fontSize:12, fontWeight:700, color: isReleased ? "#22c55e" : "#f59e0b" }}>
                      {isReleased ? "+" : ""}{fmt(pmt.amountRwf)}
                    </p>
                  )}
                  <a href={`/seeker/jobs/${app.jobId}`}
                    style={{ display:"inline-flex", alignItems:"center", gap:3, marginTop:6, fontSize:10, fontWeight:700, color:"#60a5fa", textDecoration:"none" }}>
                    {t("seeker_jobs.track_link")} →
                  </a>
                </div>
              </div>

              {/* Payment status bar */}
              {pmt && (
                <div style={{ borderTop:"1px solid #191919", padding:"10px 20px", background:"rgba(0,0,0,0.2)", display:"flex", alignItems:"center", gap:10 }}>
                  <Wallet size={12} color={isReleased ? "#22c55e" : "#f59e0b"} />
                  <p style={{ margin:0, fontSize:11, color: isReleased ? "#22c55e" : "#555" }}>
                    {isReleased
                      ? `${fmt(pmt.amountRwf)} ${t("seeker_jobs.released_to_wallet")}${pmt.releasedAt ? ` ${t("seeker_jobs.released_to_wallet_on")} ${new Date(pmt.releasedAt).toLocaleDateString(currentLocale)}` : ""}`
                      : `${fmt(pmt.amountRwf)} ${t("seeker_jobs.held_in_escrow")}`}
                  </p>
                </div>
              )}

              {/* Employer feedback */}
              {isReleased && feedback && (
                <div style={{ borderTop:"1px solid #191919", padding:"14px 20px", background:"rgba(34,197,94,0.02)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <Star size={13} color="#f59e0b" fill="#f59e0b" />
                    <span style={{ fontSize:11, fontWeight:700, color:"#444" }}>{t("seeker_jobs.feedback_label")}</span>
                  </div>
                  <p style={{ margin:0, fontSize:12, color:"#4a4a4a", fontStyle:"italic", lineHeight:1.6 }}>"{feedback}"</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Earnings summary */}
      {accepted.length > 0 && (
        <div className="seeker-summary-box">
          <div>
            <p style={{ margin:"0 0 2px", fontSize:10, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.07em" }}>{t("seeker_jobs.total_released")}</p>
            <p style={{ margin:0, fontSize:18, fontWeight:900, color:"#22c55e" }}>{fmt(totalEarned)}</p>
          </div>
          <div>
            <p style={{ margin:"0 0 2px", fontSize:10, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.07em" }}>{t("seeker_jobs.in_escrow")}</p>
            <p style={{ margin:0, fontSize:18, fontWeight:900, color:"#f59e0b" }}>{fmt(inEscrow)}</p>
          </div>
          <div>
            <p style={{ margin:"0 0 2px", fontSize:10, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.07em" }}>{t("seeker_jobs.jobs_total")}</p>
            <p style={{ margin:0, fontSize:18, fontWeight:900, color:"#e0e0e0" }}>{accepted.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
