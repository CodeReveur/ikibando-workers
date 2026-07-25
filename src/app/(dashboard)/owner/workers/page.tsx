"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Check, X, Star, MessageSquare, Loader2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import {
  getMyJobs, getJobApplications, updateApplicationStatus, completeJob, apiError,
  type JobDto, type ApplicationDto,
} from "@/lib/api";
import { ST, fmt } from "@/lib/dashboard-data";
import { ratingLabel } from "@/lib/rating";
import { StatCard, SectionHead, Dot, PageLoader } from "@/components/dashboard/ui";
import { useLanguage } from "@/lib/language-context";
import { rateUnit } from "@/lib/rate-unit";

const CSS = `
  .wkr-card { transition:border-color 0.12s, background 0.12s; }
  .wkr-card:hover { border-color:#222 !important; background:#141414 !important; }
  .act-btn { border-radius:8px; padding:5px 13px; font-size:11px; font-weight:700;
             cursor:pointer; font-family:inherit; transition:all 0.12s; border:1px solid; }
  .act-btn.accept  { background:rgba(34,197,94,0.07); color:#22c55e; border-color:rgba(34,197,94,0.2); }
  .act-btn.accept:hover  { background:rgba(34,197,94,0.14); border-color:#22c55e; }
  .act-btn.reject  { background:rgba(239,68,68,0.07); color:#ef4444; border-color:rgba(239,68,68,0.2); }
  .act-btn.reject:hover  { background:rgba(239,68,68,0.14); border-color:#ef4444; }
  .act-btn.release { background:rgba(249,115,22,0.08); color:#f97316; border-color:rgba(249,115,22,0.2); }
  .act-btn.release:hover { background:rgba(249,115,22,0.14); border-color:#f97316; }
  .owner-stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
  .tabs-container { display:flex; gap:4px; margin-bottom:18px; background:#0f0f0f; border-radius:10px; padding:4px; width:fit-content; }
  .job-header-row { padding:14px 18px; border-bottom:1px solid #191919; display:flex; align-items:center; gap:10px; }
  @keyframes spin { to { transform:rotate(360deg); } }

  @media (max-width: 900px) {
    .owner-stats-grid { grid-template-columns:repeat(2,1fr); }
  }
  @media (max-width: 640px) {
    .job-header-row { flex-direction:column; align-items:stretch !important; gap:12px; }
    .job-header-row button { align-self:flex-start; }
  }
  @media (max-width: 480px) {
    .owner-stats-grid { grid-template-columns:1fr; }
    .tabs-container { width:100%; overflow-x:auto; }
  }
`;

type TabKey = "pending" | "hired" | "all";

interface JobGroup {
  job: JobDto;
  apps: ApplicationDto[];
  loadingApps: boolean;
  expanded: boolean;
}

export default function OwnerWorkers() {
  const { t, language } = useLanguage();
  const dateLocaleMap: Record<string, string> = {
    rw: "rw-RW",
    kinyy: "rw-RW",
    sw: "sw-TZ",
    fr: "fr-FR",
    en: "en-US",
  };
  const currentLocale = dateLocaleMap[language] || "en-RW";
  const [groups,    setGroups]    = useState<JobGroup[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<TabKey>("all");
  const [actionMap, setActionMap] = useState<Record<string, "loading" | "done">>({});
  const [noteFor,   setNoteFor]   = useState<string | null>(null);
  const [noteText,  setNoteText]  = useState("");
  const [pendingAct, setPendingAct] = useState<{ appId: string; act: "ACCEPTED" | "REJECTED" } | null>(null);
  const [releaseFor, setReleaseFor]  = useState<string | null>(null);
  const [releaseFeedbackOption, setReleaseFeedbackOption] = useState("Excellent Work");
  const [releaseFeedbackText, setReleaseFeedbackText] = useState("");
  const [releaseCompletionNote, setReleaseCompletionNote] = useState("");
  const [releaseRating,   setReleaseRating]   = useState(5);
  const [releasing, setReleasing] = useState(false);

  const loadAll = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const jobs = await getMyJobs(token);
      const g = jobs.map(job => ({ job, apps: [] as ApplicationDto[], loadingApps: false, expanded: false }));
      setGroups(g);
      // Load all apps in parallel
      const results = await Promise.all(
        jobs.map(j => getJobApplications(j.id as unknown as string, token).catch(() => [] as ApplicationDto[]))
      );
      setGroups(jobs.map((job, i) => ({ job, apps: results[i], loadingApps: false, expanded: false })));
    } catch { setGroups([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const allApps    = groups.flatMap(g => g.apps);
  const pending    = allApps.filter(a => a.status === "PENDING");
  const accepted   = allApps.filter(a => a.status === "ACCEPTED");
  const hireNow    = allApps.filter(a => a.appliedVia === "HIRE_NOW");

  const doStatus = async (appId: string, status: "ACCEPTED" | "REJECTED", note?: string) => {
    const token = localStorage.getItem("access_token")!;
    setActionMap(m => ({ ...m, [appId]: "loading" }));
    try {
      const updated = await updateApplicationStatus(appId, { status, responseNote: note }, token);
      setGroups(prev => prev.map(g => ({
        ...g,
        apps: g.apps.map(a => a.id === appId ? { ...a, ...updated } : a),
      })));
      setActionMap(m => ({ ...m, [appId]: "done" }));
    } catch {
      setActionMap(m => { const n = { ...m }; delete n[appId]; return n; });
    }
    setNoteFor(null); setNoteText(""); setPendingAct(null);
  };

  const doRelease = async (jobId: string) => {
    const token = localStorage.getItem("access_token")!;
    setReleasing(true);
    try {
      const payload: any = {
        completionNotes: releaseCompletionNote,
        feedbackOption: releaseFeedbackOption,
        rating: releaseRating,
      };
      if (releaseFeedbackOption === "Other (requires text)") payload.feedbackText = releaseFeedbackText;

      await completeJob(jobId, payload, token);
      setGroups(prev => prev.map(g => g.job.id === jobId ? { ...g, job: { ...g.job, status: "COMPLETED" as any } } : g));
      setReleaseFor(null); setReleaseCompletionNote(""); setReleaseFeedbackOption("Excellent Work"); setReleaseFeedbackText(""); setReleaseRating(5);
    } catch (e: any) {
      alert(apiError(e, t("owner_workers.error_complete") || "Failed to complete job"));
    } finally { setReleasing(false); }
  };

  /* filter groups by tab */
  const displayGroups = groups.map(g => ({
    ...g,
    apps: g.apps.filter(a => {
      if (tab === "pending") return a.status === "PENDING";
      if (tab === "hired")   return a.status === "ACCEPTED";
      return true;
    }),
  })).filter(g => g.apps.length > 0);

  const inp: React.CSSProperties = { width:"100%", background:"#131313", border:"1px solid #222", borderRadius:8, padding:"9px 12px", fontSize:12, color:"#d0d0d0", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

  return (
    <div>
      <style>{CSS}</style>

      {/* Stats */}
      <div className="owner-stats-grid">
        <StatCard label={t("owner_workers.total_applied") || "Total Applied"}  value={String(allApps.length)} sub={t("owner_workers.all_apps") || "All applications"} accent="#f97316" />
        <StatCard label={t("owner_workers.pending_review") || "Pending Review"} value={String(pending.length)} sub={t("owner_workers.need_action") || "Need action"}       accent="#f59e0b" />
        <StatCard label={t("owner_workers.hired") || "Hired"}          value={String(accepted.length)} sub={t("owner_workers.accepted_workers") || "Accepted workers"} accent="#22c55e" />
        <StatCard label={t("owner_workers.via_hire_now") || "Via Hire Now"}   value={String(hireNow.length)} sub={t("owner_workers.direct_hires") || "Direct hires"}     accent="#a78bfa" />
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        {(["all","pending","hired"] as TabKey[]).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)} style={{
            padding:"7px 18px", borderRadius:7, fontSize:12, fontWeight:700, border:"none", cursor:"pointer",
            fontFamily:"inherit", transition:"all 0.12s",
            background: tab === tabKey ? "#1c1c1c" : "transparent",
            color: tab === tabKey ? "#f97316" : "#444",
            boxShadow: tab === tabKey ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
          }}>
            {tabKey === "pending" ? `${t("owner_workers.tab_pending") || "Pending"} (${pending.length})` : tabKey === "hired" ? `${t("owner_workers.tab_hired") || "Hired"} (${accepted.length})` : `${t("owner_workers.tab_all") || "All"} (${allApps.length})`}
          </button>
        ))}
      </div>

      {loading && <PageLoader />}

      {!loading && displayGroups.length === 0 && (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"36px", textAlign:"center" }}>
          <Users size={28} color="#2a2a2a" style={{ marginBottom:12 }} />
          <p style={{ margin:0, color:"#444", fontSize:13 }}>
            {tab === "pending" ? (t("owner_workers.no_pending_desc") || "No pending applications to review.") : tab === "hired" ? (t("owner_workers.no_hired_desc") || "No hired workers yet.") : (t("owner_workers.no_apps_desc") || "No applications found.")}
          </p>
          {tab === "pending" && (
            <p style={{ margin:"8px 0 0", color:"#333", fontSize:12 }}>Workers will appear here once they apply to your offers.</p>
          )}
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {displayGroups.map(({ job, apps }) => (
          <div key={job.id as unknown as string} style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, overflow:"hidden" }}>
            {/* Job header */}
            <div className="job-header-row">
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#e0e0e0" }}>{job.title}</p>
                <p style={{ margin:"2px 0 0", fontSize:11, color:"#3a3a3a" }}>
                  {job.district} · {fmt(job.ratePerHour)}/{rateUnit(job).short} · {job.headcount} {Number(job.headcount) !== 1 ? (t("owner_offers.slots_plural") || "slots") : (t("owner_offers.slots") || "slot")}
                  {(job.status as string) === "COMPLETED" && (
                    <span style={{ marginLeft:8, color:"#22c55e", fontWeight:700 }}>● {t("owner_workers.completed") || "Completed"}</span>
                  )}
                </p>
              </div>
              {tab === "hired" && (job.status as string) !== "COMPLETED" && apps.some(a => a.status === "ACCEPTED") && (
                <button className="act-btn release" disabled={!job.workerVerified} onClick={() => job.workerVerified ? setReleaseFor(job.id as unknown as string) : alert(t("owner_workers.wait_worker_verify_alert") || "Waiting for worker to verify completion")} style={{ opacity: job.workerVerified ? 1 : 0.5 }}>
                  {job.workerVerified ? (t("owner_workers.release_complete") || "Release & Complete") : (t("owner_workers.waiting_worker") || "Waiting for Worker")}
                </button>
              )}
            </div>

            {/* Workers */}
            <div>
              {apps.map(app => {
                const ast       = ST[app.status.toLowerCase()] ?? ST.pending;
                const isActing  = actionMap[app.id as unknown as string] === "loading";
                const isDone    = actionMap[app.id as unknown as string] === "done";
                const showNote  = noteFor === (app.id as unknown as string);
                const localizedAppStatus = t("seeker_jobs.status_" + app.status.toLowerCase()) || ast.label;

                return (
                  <div key={app.id as unknown as string}>
                    <div style={{ padding:"14px 18px", borderTop:"1px solid #161616", display:"flex", alignItems:"flex-start", gap:12 }}>
                      <div style={{ width:38, height:38, borderRadius:999, flexShrink:0, background:"rgba(249,115,22,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:"#f97316" }}>
                        {app.workerName[0]}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                          <p style={{ margin:0, fontWeight:700, fontSize:13, color:"#d0d0d0" }}>{app.workerName}</p>
                          <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:ast.color, background:ast.bg }}>{localizedAppStatus}</span>
                          {app.appliedVia === "HIRE_NOW" && (
                            <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:"#a78bfa", background:"rgba(167,139,250,0.1)" }}>{t("owner_offers.hire_now_label") || "Hire Now"}</span>
                          )}
                        </div>
                        {app.bestFit && (
                          <p style={{ margin:"4px 0 0", fontSize:11, color:"#3e3e3e", fontStyle:"italic" }}>"{app.bestFit}"</p>
                        )}
                        {app.responseNote && (
                          <p style={{ margin:"4px 0 0", fontSize:11, color:"#1d4a1d" }}>{t("owner_offers.note_from_employer") || "Note:"} {app.responseNote}</p>
                        )}
                        <p style={{ margin:"3px 0 0", fontSize:10, color:"#2a2a2a", display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
                          <span style={{ display:"inline-flex", alignItems:"center", gap:3, color:"#f97316", fontWeight:700 }}>
                            <Star size={9} color="#f97316" fill="#f97316" />{ratingLabel(app.workerRating, app.workerRatingCount)}
                          </span>
                          <span>· {t("owner_offers.applied_date", { date: new Date(app.createdAt).toLocaleDateString(currentLocale) }) || `Applied ${new Date(app.createdAt).toLocaleDateString(currentLocale)}`}
                          {app.workerDistrict ? ` · ${app.workerDistrict}` : ""}</span>
                        </p>
                      </div>
                      {app.status === "PENDING" && !isActing && !isDone && !showNote && (
                        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                          <button className="act-btn accept" onClick={() => { setPendingAct({ appId: app.id as unknown as string, act: "ACCEPTED" }); setNoteFor(app.id as unknown as string); setNoteText(""); }}>
                            <Check size={10} /> {t("owner_offers.accept") || "Accept"}
                          </button>
                          <button className="act-btn reject" onClick={() => { setPendingAct({ appId: app.id as unknown as string, act: "REJECTED" }); setNoteFor(app.id as unknown as string); setNoteText(""); }}>
                            <X size={10} /> {t("owner_offers.reject") || "Reject"}
                          </button>
                        </div>
                      )}
                      {isActing && <Loader2 size={14} color="#555" style={{ animation:"spin 0.7s linear infinite", flexShrink:0, marginTop:10 }} />}
                    </div>
                    {showNote && (
                      <div style={{ padding:"10px 18px 14px 68px", background:"#0b0b0b", borderTop:"1px solid #141414" }}>
                        <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color: pendingAct?.act === "ACCEPTED" ? "#22c55e" : "#ef4444" }}>
                          {pendingAct?.act === "ACCEPTED"
                            ? (t("owner_offers.confirm_accept_title") || "Accept worker - add a note (optional)")
                            : (t("owner_offers.confirm_reject_title") || "Reject worker - add a note (optional)")}
                        </p>
                        <input
                          autoFocus
                          style={inp}
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          placeholder={pendingAct?.act === "ACCEPTED" ? "e.g. Please arrive 30 min early" : "e.g. Position has been filled"}
                        />
                        <div style={{ display:"flex", gap:8, marginTop:8 }}>
                          <button className={`act-btn ${pendingAct?.act === "ACCEPTED" ? "accept" : "reject"}`}
                            onClick={() => pendingAct && doStatus(pendingAct.appId, pendingAct.act, noteText || undefined)}>
                            {t("owner_workers.confirm_btn") || "Confirm"}
                          </button>
                          <button className="act-btn" style={{ color:"#555", borderColor:"#222", background:"transparent" }}
                            onClick={() => { setNoteFor(null); setPendingAct(null); setNoteText(""); }}>
                            {t("owner_workers.cancel") || "Cancel"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Release modal */}
      {releaseFor && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#111", border:"1px solid #222", borderRadius:18, width:"100%", maxWidth:440, padding:"28px" }}>
            <p style={{ margin:"0 0 6px", fontSize:16, fontWeight:800, color:"#fff" }}>{t("owner_workers.release_payment_modal_title") || "Release Payment & Complete Job"}</p>
            <p style={{ margin:"0 0 20px", fontSize:12, color:"#444", lineHeight:1.6 }}>
              {t("owner_workers.release_payment_modal_desc") || "This will mark the job as complete and release the escrowed payment to the worker(s). Rate the work quality before releasing."}
            </p>

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a" }}>{t("owner_workers.rating_required") || "RATING (REQUIRED)"}</p>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setReleaseRating(star)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:24, color: star <= releaseRating ? "#f97316" : "#333", padding:0 }}>★</button>
              ))}
            </div>

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a" }}>{t("owner_workers.feedback_required") || "FEEDBACK (REQUIRED)"}</p>
            <select value={releaseFeedbackOption} onChange={e => setReleaseFeedbackOption(e.target.value)} style={{ ...inp, marginBottom: releaseFeedbackOption === "Other (requires text)" ? 10 : 18 }}>
              <option value="Excellent Work">{t("owner_workers.feedback_excellent") || "Excellent Work"}</option>
              <option value="Good Work">{t("owner_workers.feedback_good") || "Good Work"}</option>
              <option value="Needs Improvement">{t("owner_workers.feedback_improvement") || "Needs Improvement"}</option>
              <option value="Poor Work">{t("owner_workers.feedback_poor") || "Poor Work"}</option>
              <option value="Other (requires text)">{t("owner_workers.other_option") || "Other (requires text)"}</option>
            </select>
            {releaseFeedbackOption === "Other (requires text)" && (
              <textarea value={releaseFeedbackText} onChange={e => setReleaseFeedbackText(e.target.value)}
                rows={2} placeholder="Please describe..." style={{ ...inp, resize: "vertical", marginBottom: 18 }} />
            )}

            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#3a3a3a" }}>{t("owner_workers.completion_notes") || "COMPLETION NOTES (optional)"}</p>
            <textarea value={releaseCompletionNote} onChange={e => setReleaseCompletionNote(e.target.value)}
              rows={2} placeholder="How did the job go?" style={{ ...inp, resize: "vertical", marginBottom: 20 }} />

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => doRelease(releaseFor)} disabled={releasing} style={{ flex:1, background:"#f97316", color:"#fff", border:"none", borderRadius:9, padding:"11px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {releasing ? (t("owner_workers.releasing") || "Releasing…") : (t("owner_workers.release_btn") || "Release Payment")}
              </button>
              <button onClick={() => setReleaseFor(null)} style={{ flex:1, background:"transparent", color:"#555", border:"1px solid #222", borderRadius:9, padding:"11px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                {t("owner_workers.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
