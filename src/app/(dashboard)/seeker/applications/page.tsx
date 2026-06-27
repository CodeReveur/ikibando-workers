"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText, Check, X, Clock, MapPin, Zap,
  ChevronRight, Loader2, AlertCircle,
} from "lucide-react";
import {
  getMyApplications, withdrawApplication, updateApplicationStatus, apiError,
  type ApplicationDto,
} from "@/lib/api";
import { ST, fmt } from "@/lib/dashboard-data";
import { StatCard, SectionHead, Dot, PageLoader } from "@/components/dashboard/ui";

const CSS = `
  .app-row { transition:background 0.1s; }
  .app-row:hover { background:#161616 !important; }
  .act-btn { border-radius:8px; padding:5px 13px; font-size:11px; font-weight:700;
             cursor:pointer; font-family:inherit; transition:all 0.12s; border:1px solid; }
  .act-btn.accept { background:rgba(34,197,94,0.07); color:#22c55e; border-color:rgba(34,197,94,0.2); }
  .act-btn.accept:hover { background:rgba(34,197,94,0.14); border-color:#22c55e; }
  .act-btn.reject { background:rgba(239,68,68,0.07); color:#ef4444; border-color:rgba(239,68,68,0.2); }
  .act-btn.reject:hover { background:rgba(239,68,68,0.14); border-color:#ef4444; }
  .act-btn.withdraw { background:rgba(239,68,68,0.05); color:#ef4444; border-color:rgba(239,68,68,0.15); }
  .act-btn.withdraw:hover { background:rgba(239,68,68,0.12); border-color:#ef4444; }
  @keyframes spin { to { transform:rotate(360deg); } }
`;

type TabKey = "offers" | "active" | "applied" | "all";

export default function SeekerApplications() {
  const [apps,      setApps]      = useState<ApplicationDto[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<TabKey>("offers");
  const [actionMap, setActionMap] = useState<Record<string, "loading" | "done">>({});
  const [noteFor,   setNoteFor]   = useState<string | null>(null);
  const [noteText,  setNoteText]  = useState("");
  const [pendingAct, setPendingAct] = useState<{ appId: string; act: "ACCEPTED" | "REJECTED" } | null>(null);

  const load = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    setLoading(true);
    getMyApplications(token)
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const hireNowPending  = apps.filter(a => a.appliedVia === "HIRE_NOW" && a.status === "PENDING");
  const selfPending     = apps.filter(a => a.appliedVia !== "HIRE_NOW" && a.status === "PENDING");
  const accepted        = apps.filter(a => a.status === "ACCEPTED");

  const displayed = (() => {
    if (tab === "offers")  return hireNowPending;
    if (tab === "active")  return accepted;
    if (tab === "applied") return selfPending;
    return [...apps].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  })();

  const doRespond = async (appId: string, status: "ACCEPTED" | "REJECTED", note?: string) => {
    const token = localStorage.getItem("access_token")!;
    setActionMap(m => ({ ...m, [appId]: "loading" }));
    try {
      const updated = await updateApplicationStatus(appId, { status, responseNote: note }, token);
      setApps(prev => prev.map(a => a.id === appId ? { ...a, ...updated } : a));
      setActionMap(m => ({ ...m, [appId]: "done" }));
    } catch (e: any) {
      alert(apiError(e, "Failed to respond"));
      setActionMap(m => { const n = { ...m }; delete n[appId]; return n; });
    }
    setNoteFor(null); setNoteText(""); setPendingAct(null);
  };

  const doWithdraw = async (appId: string) => {
    if (!confirm("Withdraw this application?")) return;
    const token = localStorage.getItem("access_token")!;
    setActionMap(m => ({ ...m, [appId]: "loading" }));
    try {
      await withdrawApplication(appId, token);
      setApps(prev => prev.filter(a => a.id !== appId));
    } catch (e: any) {
      alert(apiError(e, "Failed to withdraw"));
      setActionMap(m => { const n = { ...m }; delete n[appId]; return n; });
    }
  };

  const inp: React.CSSProperties = {
    width:"100%", background:"#131313", border:"1px solid #222", borderRadius:8,
    padding:"9px 12px", fontSize:12, color:"#d0d0d0", fontFamily:"inherit",
    outline:"none", boxSizing:"border-box",
  };

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key:"offers",  label:"Direct Offers",   count:hireNowPending.length },
    { key:"active",  label:"Active",          count:accepted.length },
    { key:"applied", label:"Applied",         count:selfPending.length },
    { key:"all",     label:"All",             count:apps.length },
  ];

  return (
    <div>
      <style>{CSS}</style>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        <StatCard label="Total Applied"    value={String(apps.length)}           sub="All time"         accent="#f97316" />
        <StatCard label="Active Jobs"      value={String(accepted.length)}       sub="Currently hired"  accent="#22c55e" />
        <StatCard label="Direct Offers"    value={String(hireNowPending.length)} sub="Need response"    accent="#60a5fa" />
        <StatCard label="Pending Replies"  value={String(selfPending.length)}    sub="Waiting on employer" accent="#f59e0b" />
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:18, background:"#0f0f0f", borderRadius:10, padding:4, width:"fit-content", flexWrap:"wrap" }}>
        {TABS.map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding:"7px 18px", borderRadius:7, fontSize:12, fontWeight:700, border:"none",
            cursor:"pointer", fontFamily:"inherit", transition:"all 0.12s",
            background: tab === key ? "#1c1c1c" : "transparent",
            color: tab === key ? "#f97316" : "#444",
            boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
          }}>
            {label} {count > 0 && (
              <span style={{ marginLeft:4, fontSize:10, fontWeight:900, borderRadius:99, padding:"1px 6px", background: tab === key ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)", color: tab === key ? "#f97316" : "#555" }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <PageLoader />}

      {!loading && displayed.length === 0 && (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"40px 24px", textAlign:"center" }}>
          <FileText size={28} color="#2a2a2a" style={{ marginBottom:12 }} />
          <p style={{ margin:"0 0 6px", color:"#555", fontSize:14, fontWeight:600 }}>
            {tab === "offers"  ? "No direct offers yet"
             : tab === "active"  ? "No active jobs yet"
             : tab === "applied" ? "No pending applications"
             : "No applications yet"}
          </p>
          <p style={{ margin:"0 0 16px", color:"#333", fontSize:12 }}>
            {tab === "offers" ? "Employers can send you a direct offer from your profile" : <><a href="/jobs" style={{ color:"#f97316" }}>Browse open jobs</a> to apply</>}
          </p>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:0, borderRadius:14, overflow:"hidden", border: displayed.length > 0 ? "1px solid #1c1c1c" : "none", background: displayed.length > 0 ? "#131313" : "transparent" }}>
        {displayed.map((app, i) => {
          const st       = ST[app.status.toLowerCase()] ?? ST.pending;
          const isActing = actionMap[app.id] === "loading";
          const isDone   = actionMap[app.id] === "done";
          const showNote = noteFor === app.id;

          return (
            <div key={app.id}>
              <div className="app-row" style={{
                padding:"16px 18px", borderTop: i > 0 ? "1px solid #191919" : "none",
                display:"flex", alignItems:"flex-start", gap:14,
              }}>
                {/* Icon */}
                <div style={{
                  width:42, height:42, borderRadius:11, flexShrink:0,
                  background: app.appliedVia === "HIRE_NOW" ? "rgba(96,165,250,0.08)" : st.bg,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  {app.appliedVia === "HIRE_NOW"
                    ? <Zap size={18} color="#60a5fa" />
                    : app.status === "ACCEPTED" ? <Check size={18} color="#22c55e" />
                    : app.status === "REJECTED" ? <X size={18} color="#ef4444" />
                    : <Clock size={18} color="#f59e0b" />}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#e8e8e8" }}>{app.jobTitle}</p>
                    <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:st.color, background:st.bg }}>{st.label}</span>
                    {app.appliedVia === "HIRE_NOW" && (
                      <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:"#60a5fa", background:"rgba(96,165,250,0.1)" }}>Direct Offer</span>
                    )}
                    {app.status === "PENDING" && app.appliedVia === "HIRE_NOW" && (
                      <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:"#f97316", background:"rgba(249,115,22,0.1)", display:"inline-flex", alignItems:"center", gap:3 }}>
                        <AlertCircle size={8} /> Needs response
                      </span>
                    )}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:5, flexWrap:"wrap" }}>
                    <span style={{ fontSize:11, color:"#3a3a3a" }}>{app.jobCategory}</span>
                    <Dot />
                    <MapPin size={9} color="#2a2a2a" />
                    <span style={{ fontSize:11, color:"#3a3a3a" }}>{app.jobDistrict}</span>
                    <Dot />
                    <Clock size={9} color="#2a2a2a" />
                    <span style={{ fontSize:11, color:"#3a3a3a" }}>{new Date(app.createdAt).toLocaleDateString()}</span>
                  </div>
                  {app.bestFit && (
                    <p style={{ margin:"5px 0 0", fontSize:11, color:"#3e3e3e", fontStyle:"italic" }}>"{app.bestFit}"</p>
                  )}
                  {app.responseNote && (
                    <p style={{ margin:"5px 0 0", fontSize:11, color: app.status === "ACCEPTED" ? "#22c55e" : "#ef4444", fontStyle:"italic" }}>
                      Employer: "{app.responseNote}"
                    </p>
                  )}
                  {app.respondedAt && (
                    <p style={{ margin:"3px 0 0", fontSize:10, color:"#2a2a2a" }}>
                      Responded {new Date(app.respondedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Actions + rate */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, flexShrink:0 }}>
                  <p style={{ margin:0, fontWeight:800, fontSize:14, color:"#f97316" }}>{fmt(app.jobRatePerHour)}<span style={{ fontSize:10, color:"#3a3a3a" }}>/hr</span></p>

                  {isActing && <Loader2 size={14} color="#555" style={{ animation:"spin 0.7s linear infinite" }} />}

                  {!isActing && !isDone && !showNote && app.status === "PENDING" && app.appliedVia === "HIRE_NOW" && (
                    <div style={{ display:"flex", gap:6 }}>
                      <button className="act-btn accept" onClick={() => { setPendingAct({ appId:app.id, act:"ACCEPTED" }); setNoteFor(app.id); setNoteText(""); }}>
                        <Check size={10} style={{ marginRight:3 }} />Accept
                      </button>
                      <button className="act-btn reject" onClick={() => doRespond(app.id, "REJECTED")}>
                        <X size={10} style={{ marginRight:3 }} />Reject
                      </button>
                    </div>
                  )}

                  {!isActing && !isDone && !showNote && app.status === "PENDING" && app.appliedVia !== "HIRE_NOW" && (
                    <button className="act-btn withdraw" onClick={() => doWithdraw(app.id)}>Withdraw</button>
                  )}

                  {isDone && (
                    <span style={{ fontSize:11, color:"#22c55e", fontWeight:700 }}>Done ✓</span>
                  )}

                  {!isActing && !isDone && (
                    <a href={`/seeker/jobs/${app.jobId}`} style={{ fontSize:11, color:"#60a5fa", fontWeight:700, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4 }}>
                      Track <ChevronRight size={11} />
                    </a>
                  )}
                </div>
              </div>

              {/* Note input for HIRE_NOW accept */}
              {showNote && (
                <div style={{ padding:"10px 18px 14px 74px", background:"#0b0b0b", borderTop:"1px solid #141414" }}>
                  <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#22c55e" }}>
                    Accept offer — add a message (optional)
                  </p>
                  <input
                    autoFocus
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="e.g. Looking forward to it! I'll be there on time."
                    style={inp}
                  />
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button className="act-btn accept"
                      onClick={() => pendingAct && doRespond(pendingAct.appId, pendingAct.act, noteText || undefined)}>
                      Confirm Acceptance
                    </button>
                    <button className="act-btn" style={{ color:"#555", borderColor:"#222", background:"transparent" }}
                      onClick={() => { setNoteFor(null); setPendingAct(null); setNoteText(""); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
