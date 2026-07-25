"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Clock, ChevronRight, ChevronDown, ChevronUp,
  Plus, Check, X, Edit2, Trash2, Users, AlertCircle,
  MapPin, Loader2, ExternalLink,
} from "lucide-react";
import {
  getMyJobs, getJobApplications, updateApplicationStatus,
  cancelJob, updateJob, daysAgo, apiError,
  type JobDto, type ApplicationDto, type JobUpdatePayload,
} from "@/lib/api";
import { RWANDA_PROVINCES } from "@/lib/constants";
import { PostJobModal } from "@/components/jobs/post-job-modal";
import { ST, fmt } from "@/lib/dashboard-data";
import { StatCard, SectionHead, Dot, PageLoader } from "@/components/dashboard/ui";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useLanguage } from "@/lib/language-context";
import { rateUnit } from "@/lib/rate-unit";
import { categoryLabel } from "@/lib/browse-taxonomy";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const CSS = `
  .owner-stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:28px; }
  .offer-row { background:#131313; padding:18px 20px; display:flex; align-items:center; gap:14px; cursor:pointer; transition:all 0.12s; border-bottom:1px solid #1c1c1c; }
  .offer-row:hover  { border-color:#222 !important; background:#141414 !important; }
  .app-row:hover    { background:#161616 !important; }
  .act-btn          { border:1px solid #222; border-radius:8px; padding:5px 14px; font-size:11px;
                      font-weight:700; cursor:pointer; font-family:inherit; transition:all 0.12s; }
  .act-btn.accept   { background:rgba(34,197,94,0.07); color:#22c55e; border-color:rgba(34,197,94,0.2); }
  .act-btn.accept:hover { background:rgba(34,197,94,0.14); border-color:#22c55e; }
  .act-btn.reject   { background:rgba(239,68,68,0.07); color:#ef4444; border-color:rgba(239,68,68,0.2); }
  .act-btn.reject:hover { background:rgba(239,68,68,0.14); border-color:#ef4444; }

  @media (max-width: 900px) {
    .owner-stats-grid { grid-template-columns:repeat(2,1fr); }
  }
  @media (max-width: 640px) {
    .offer-row { flex-direction: column; align-items: stretch !important; gap: 12px; }
    .offer-rate-box { text-align: left !important; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #1c1c1c; padding-top: 10px; }
    .offer-actions-box { justify-content: flex-end; }
  }
  @media (max-width: 480px) {
    .owner-stats-grid { grid-template-columns:1fr; }
  }
`;

type JobWithApps = JobDto & { apps?: ApplicationDto[]; expanded?: boolean; loadingApps?: boolean };

/* ── main component ─────────────────────────────────────────────────────── */
export default function OwnerOffers() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const dateLocaleMap: Record<string, string> = {
    rw: "rw-RW",
    kinyy: "rw-RW",
    sw: "sw-TZ",
    fr: "fr-FR",
    en: "en-US",
  };
  const currentLocale = dateLocaleMap[language] || "en-RW";
  const [jobs,      setJobs]      = useState<JobWithApps[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [postOpen,  setPostOpen]  = useState(false);
  const [editJob,   setEditJob]   = useState<JobDto | null>(null);
  const [actionMap, setActionMap] = useState<Record<string, "loading" | "done">>({});
  const [noteFor,   setNoteFor]   = useState<string | null>(null);
  const [noteText,  setNoteText]  = useState("");
  const [pendingAction, setPendingAction] = useState<{ appId: string; status: "ACCEPTED" | "REJECTED" } | null>(null);

  const load = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    setLoading(true);
    getMyJobs(token)
      .then(j => setJobs(j.map(job => ({ ...job, expanded: false, apps: undefined, loadingApps: false }))))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (jobId: string) => {
    const token = localStorage.getItem("access_token")!;
    setJobs(prev => prev.map(j => {
      if (j.id !== jobId) return j;
      if (j.apps !== undefined) return { ...j, expanded: !j.expanded };
      return { ...j, expanded: true, loadingApps: true };
    }));
    const job = jobs.find(j => j.id === jobId);
    if (job?.apps === undefined) {
      try {
        const apps = await getJobApplications(jobId, token);
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, apps, loadingApps: false } : j));
      } catch {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, apps: [], loadingApps: false } : j));
      }
    }
  };

  const handleStatus = async (appId: string, status: "ACCEPTED" | "REJECTED", note?: string) => {
    const token = localStorage.getItem("access_token")!;
    setActionMap(m => ({ ...m, [appId]: "loading" }));
    try {
      const updated = await updateApplicationStatus(appId, { status, responseNote: note }, token);
      setJobs(prev => prev.map(j => ({
        ...j,
        apps: j.apps?.map(a => a.id === appId ? { ...a, ...updated } : a),
      })));
      setActionMap(m => ({ ...m, [appId]: "done" }));
    } catch {
      setActionMap(m => { const n = { ...m }; delete n[appId]; return n; });
    }
    setNoteFor(null);
    setNoteText("");
    setPendingAction(null);
  };

  const initiateAction = (appId: string, status: "ACCEPTED" | "REJECTED") => {
    setPendingAction({ appId, status });
    setNoteFor(appId);
    setNoteText("");
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm(t("owner_offers.confirm_cancel_job") || "Cancel this job? This cannot be undone.")) return;
    const token = localStorage.getItem("access_token")!;
    try {
      await cancelJob(jobId, token);
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (e: any) {
      alert(apiError(e, t("owner_offers.cancel_job_fail") || "Failed to cancel job"));
    }
  };

  const open   = jobs.filter(j => j.status === "OPEN").length;
  const filled = jobs.filter(j => j.status === "FILLED").length;
  const total  = jobs.length;

  return (
    <div>
      <style>{CSS}</style>

      {/* Stats */}
      <div className="owner-stats-grid">
        <StatCard label={t("owner_offers.total_offers") || "Total Offers"}  value={String(total)}           sub={t("owner_offers.all_time") || "All time"}         accent="#f97316" />
        <StatCard label={t("owner_offers.open") || "Open"}                  value={String(open)}            sub={t("owner_offers.accepting_apps") || "Accepting apps"}   accent="#60a5fa" />
        <StatCard label={t("owner_offers.filled") || "Filled"}              value={String(filled)}          sub={t("owner_offers.positions_hired") || "Positions hired"}  accent="#22c55e" />
        <StatCard label={t("owner_offers.active") || "Active"}              value={String(total - filled)}  sub={t("owner_offers.live_now") || "Live now"}         accent="#a78bfa" />
      </div>

      <SectionHead title={t("owner_offers.title") || "My Offers"} action={
        <button
          onClick={() => setPostOpen(true)}
          style={{
            display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:700,
            color:"#f97316", background:"rgba(249,115,22,0.08)", borderRadius:8,
            padding:"7px 14px", border:"1px solid rgba(249,115,22,0.2)", cursor:"pointer",
            fontFamily:"inherit",
          }}
        >
          <Plus size={13} /> {t("owner_offers.post_new") || "Post new offer"}
        </button>
      } />

      {loading && <PageLoader />}
      {!loading && jobs.length === 0 && (
        <div style={{ background:"#131313", border:"1px solid #1c1c1c", borderRadius:14, padding:"40px 24px", textAlign:"center" }}>
          <Send size={28} color="#2a2a2a" style={{ marginBottom:12 }} />
          <p style={{ margin:"0 0 6px", color:"#555", fontSize:14, fontWeight:600 }}>{t("owner_offers.no_offers") || "No offers yet"}</p>
          <p style={{ margin:"0 0 16px", color:"#333", fontSize:12 }}>{t("owner_offers.no_offers_desc") || "Post your first job to start receiving applications"}</p>
          <button onClick={() => setPostOpen(true)} style={{
            background:"#f97316", color:"#fff", border:"none", borderRadius:8,
            padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
          }}>{t("owner_offers.post_job_btn") || "Post a job"}</button>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {jobs.map(job => {
          const st     = ST[job.status.toLowerCase()] ?? ST.open;
          const posted = daysAgo(job.createdAt as unknown as string);
          const pendingApps = (job.apps ?? []).filter(a => a.status === "PENDING").length;
          const localizedStatus = t("seeker_jobs.status_" + job.status.toLowerCase()) || st.label;

          return (
            <div key={job.id} style={{ borderRadius:14, overflow:"hidden", border:"1px solid #1c1c1c" }}>
              {/* Job header row */}
              <div
                className="offer-row"
                onClick={() => toggleExpand(job.id as unknown as string)}
              >
                <div style={{ width:44, height:44, borderRadius:12, flexShrink:0, background:"rgba(249,115,22,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Send size={18} color="#f97316" />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#e8e8e8" }}>{job.title}</p>
                    <span style={{ fontSize:10, fontWeight:700, borderRadius:99, padding:"2px 8px", color:st.color, background:st.bg }}>{localizedStatus}</span>
                    {(job.urgency as string) === "IMMEDIATE" && (
                      <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:"#ef4444", background:"rgba(239,68,68,0.08)" }}>{t("owner_offers.urgent") || "URGENT"}</span>
                    )}
                    {pendingApps > 0 && (
                      <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 8px", color:"#f97316", background:"rgba(249,115,22,0.1)", display:"flex", alignItems:"center", gap:3 }}>
                        <AlertCircle size={8} /> {t("owner_offers.pending_count", { count: pendingApps }) || `${pendingApps} pending`}
                      </span>
                    )}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:5, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, color:"#4a4a4a" }}>{categoryLabel(job.category, t)}</span>
                    <Dot />
                    <MapPin size={10} color="#333" />
                    <span style={{ fontSize:12, color:"#4a4a4a" }}>{job.district}</span>
                    <Dot />
                    <Users size={10} color="#333" />
                    <span style={{ fontSize:12, color:"#4a4a4a" }}>{job.headcount} {Number(job.headcount) !== 1 ? (t("owner_offers.slots_plural") || "slots") : (t("owner_offers.slots") || "slot")}</span>
                    <Dot />
                    <Clock size={10} color="#333" />
                    <span style={{ fontSize:12, color:"#4a4a4a" }}>{posted === 0 ? (t("owner_offers.today") || "Today") : (t("owner_offers.days_ago", { count: posted }) || `${posted}d ago`)}</span>
                  </div>
                </div>
                <div className="offer-rate-box" style={{ textAlign:"right", flexShrink:0 }}>
                  <p style={{ margin:0, fontWeight:800, fontSize:15, color:"#f97316" }}>{fmt(job.ratePerHour)}</p>
                  <p style={{ margin:0, fontSize:10, color:"#3a3a3a" }}>per {rateUnit(job).short}</p>
                </div>
                <div className="offer-actions-box" style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/owner/jobs/${job.id}`); }}
                    title={t("owner_offers.view_details") || "View Details"}
                    style={{ background:"rgba(96,165,250,0.07)", border:"1px solid rgba(96,165,250,0.15)", borderRadius:7, padding:"6px 8px", cursor:"pointer", color:"#60a5fa", display:"flex" }}
                  ><ExternalLink size={12} /></button>
                  {job.status === "OPEN" && (
                    <button
                      onClick={e => { e.stopPropagation(); setEditJob(job); }}
                      style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.15)", borderRadius:7, padding:"6px 8px", cursor:"pointer", color:"#f97316", display:"flex" }}
                    ><Edit2 size={12} /></button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(job.id as unknown as string); }}
                    style={{ background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.12)", borderRadius:7, padding:"6px 8px", cursor:"pointer", color:"#ef4444", display:"flex" }}
                  ><Trash2 size={12} /></button>
                  {job.expanded ? <ChevronUp size={15} color="#333" /> : <ChevronDown size={15} color="#333" />}
                </div>
              </div>

              {/* Applications panel */}
              {job.expanded && (
                <div style={{ background:"#0e0e0e", borderTop:"1px solid #1a1a1a" }}>
                  {job.loadingApps ? (
                    <div style={{ padding:"20px", display:"flex", alignItems:"center", gap:8, color:"#555", fontSize:12 }}>
                      <Loader2 size={14} style={{ animation:"spin 0.7s linear infinite" }} /> {t("common.general.loading") || "Loading applications…"}
                      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                  ) : (job.apps ?? []).length === 0 ? (
                    <p style={{ margin:0, padding:"18px 20px", fontSize:12, color:"#333" }}>{t("owner_offers.no_applications") || "No applications yet for this offer."}</p>
                  ) : (
                    <div>
                      <div style={{ padding:"10px 20px 6px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <p style={{ margin:0, fontSize:11, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.08em" }}>
                          {t("owner_offers.applications_title", { count: (job.apps ?? []).length }) || `Applications (${(job.apps ?? []).length})`}
                        </p>
                        <div style={{ display:"flex", gap:12, fontSize:11, color:"#333" }}>
                          <span style={{ color:"#f59e0b" }}>● {(job.apps ?? []).filter(a => a.status === "PENDING").length} {t("seeker_jobs.status_pending") || "Pending"}</span>
                          <span style={{ color:"#22c55e" }}>● {(job.apps ?? []).filter(a => a.status === "ACCEPTED").length} {t("seeker_jobs.status_accepted") || "Accepted"}</span>
                          <span style={{ color:"#ef4444" }}>● {(job.apps ?? []).filter(a => a.status === "REJECTED").length} {t("common.general.rejected") || "Rejected"}</span>
                        </div>
                      </div>
                      {(job.apps ?? []).map(app => {
                        const ast = ST[app.status.toLowerCase()] ?? ST.pending;
                        const isActing = actionMap[app.id as unknown as string] === "loading";
                        const isDone   = actionMap[app.id as unknown as string] === "done";
                        const isShowingNote = noteFor === (app.id as unknown as string);
                        const localizedAppStatus = t("seeker_jobs.status_" + app.status.toLowerCase()) || ast.label;

                        return (
                          <div key={app.id as unknown as string}>
                            <div className="app-row" style={{
                              padding:"14px 20px", borderTop:"1px solid #161616",
                              display:"flex", alignItems:"flex-start", gap:12, transition:"background 0.1s",
                            }}>
                              {/* Avatar */}
                              <div style={{ width:36, height:36, borderRadius:999, flexShrink:0, background:"rgba(249,115,22,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:"#f97316" }}>
                                {app.workerName[0]}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                  <p style={{ margin:0, fontWeight:700, fontSize:13, color:"#d0d0d0" }}>{app.workerName}</p>
                                  <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:ast.color, background:ast.bg }}>{localizedAppStatus}</span>
                                  {app.appliedVia === "HIRE_NOW" && (
                                    <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", color:"#a78bfa", background:"rgba(167,139,250,0.1)" }}>{t("owner_offers.hire_now_label") || "Hire Now"}</span>
                                  )}
                                </div>
                                {app.bestFit && (
                                  <p style={{ margin:"4px 0 0", fontSize:11, color:"#3e3e3e", lineHeight:1.5, fontStyle:"italic" }}>"{app.bestFit}"</p>
                                )}
                                {app.responseNote && (
                                  <p style={{ margin:"4px 0 0", fontSize:11, color:"#2a5a2a" }}>{t("owner_offers.note_from_employer") || "Note:"} {app.responseNote}</p>
                                )}
                                <p style={{ margin:"4px 0 0", fontSize:10, color:"#2a2a2a" }}>
                                  {t("owner_offers.applied_date", { date: new Date(app.createdAt).toLocaleDateString(currentLocale) }) || `Applied ${new Date(app.createdAt).toLocaleDateString(currentLocale)}`}
                                  {app.workerDistrict ? ` · ${app.workerDistrict}` : ""}
                                </p>
                              </div>
                              {/* Actions */}
                              {app.status === "PENDING" && !isActing && !isDone && !isShowingNote && (
                                <div style={{ display:"flex", gap:7, flexShrink:0 }}>
                                  <button className="act-btn accept" onClick={() => initiateAction(app.id as unknown as string, "ACCEPTED")}>
                                    <Check size={10} style={{ marginRight:4 }} />{t("owner_offers.accept") || "Accept"}
                                  </button>
                                  <button className="act-btn reject" onClick={() => initiateAction(app.id as unknown as string, "REJECTED")}>
                                    <X size={10} style={{ marginRight:4 }} />{t("owner_offers.reject") || "Reject"}
                                  </button>
                                </div>
                              )}
                              {isActing && <Loader2 size={14} color="#555" style={{ animation:"spin 0.7s linear infinite", flexShrink:0, marginTop:8 }} />}
                            </div>
                            {/* Note / comment field */}
                            {isShowingNote && (
                              <div style={{ padding:"10px 20px 14px 68px", background:"#0b0b0b", borderTop:"1px solid #141414" }}>
                                <p style={{ margin:"0 0 6px", fontSize:11, color: pendingAction?.status === "ACCEPTED" ? "#22c55e" : "#ef4444", fontWeight:700 }}>
                                  {pendingAction?.status === "ACCEPTED"
                                    ? (t("owner_offers.confirm_accept_title") || "Accept worker - add a note (optional)")
                                    : (t("owner_offers.confirm_reject_title") || "Reject worker - add a note (optional)")}
                                </p>
                                <input
                                  autoFocus
                                  value={noteText}
                                  onChange={e => setNoteText(e.target.value)}
                                  placeholder={pendingAction?.status === "ACCEPTED" ? "e.g. Please arrive by 8AM" : "e.g. Position already filled"}
                                  style={{ width:"100%", background:"#131313", border:"1px solid #222", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#d0d0d0", fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                                />
                                <div style={{ display:"flex", gap:8, marginTop:8 }}>
                                  <button
                                    className={`act-btn ${pendingAction?.status === "ACCEPTED" ? "accept" : "reject"}`}
                                    onClick={() => pendingAction && handleStatus(pendingAction.appId, pendingAction.status, noteText || undefined)}
                                  >
                                    {t("owner_offers.confirm_btn") || "Confirm"}
                                  </button>
                                  <button className="act-btn" style={{ color:"#555", borderColor:"#222", background:"transparent" }}
                                    onClick={() => { setNoteFor(null); setPendingAction(null); setNoteText(""); }}>
                                    {t("owner_offers.cancel") || "Cancel"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {postOpen && <PostJobModal onClose={() => { setPostOpen(false); load(); }} />}
      {editJob && <EditJobModal job={editJob} onClose={() => { setEditJob(null); load(); }} />}
    </div>
  );
}

/* ── Edit job modal ─────────────────────────────────────────────────────── */
function EditJobModal({ job, onClose }: { job: JobDto; onClose: () => void }) {
  const { t } = useLanguage();
  const todayStr = new Date().toISOString().split("T")[0];
  const existingDate = job.startTime ? new Date(job.startTime).toISOString().split("T")[0] : "";
  const existingTime = job.startTime ? new Date(job.startTime).toTimeString().slice(0, 5) : "";

  const [form, setForm] = useState({
    date:          existingDate,
    time:          existingTime,
    durationHours: String(job.durationHours ?? ""),
    headcount:     String(job.headcount ?? ""),
    urgency:       job.urgency ?? "SCHEDULED",
    province:      job.province ?? "",
    district:      job.district ?? "",
    locationNotes: job.locationNotes ?? "",
    description:   job.description ?? "",
    requirements:  job.requirements ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const districts = RWANDA_PROVINCES.find(p => p.label === form.province)?.districts ?? [];

  // Live escrow preview
  const rate     = job.ratePerHour;
  const hours    = parseFloat(form.durationHours) || 0;
  const heads    = parseInt(form.headcount) || 1;
  const gross    = Math.round(rate * hours * heads);
  const fee      = Math.round(gross * 0.25);
  const workerNet = gross - fee;
  const oldGross = Math.round(rate * (job.durationHours ?? 0) * (job.headcount ?? 1));
  const diff     = gross - oldGross;

  const save = async () => {
    const token = localStorage.getItem("access_token")!;
    setSaving(true); setErr("");
    try {
      const startTime = form.date && form.time
        ? new Date(`${form.date}T${form.time}:00`).toISOString() : undefined;
      const payload: JobUpdatePayload = {
        ...(startTime                         ? { startTime }                         : {}),
        ...(form.durationHours                ? { durationHours: parseFloat(form.durationHours) } : {}),
        ...(form.headcount                    ? { headcount: parseInt(form.headcount) } : {}),
        ...(form.urgency                      ? { urgency: form.urgency as any }      : {}),
        ...(form.province                     ? { province: form.province }           : {}),
        ...(form.district                     ? { district: form.district }           : {}),
        ...(form.locationNotes !== undefined  ? { locationNotes: form.locationNotes } : {}),
        ...(form.description  !== undefined   ? { description: form.description }     : {}),
        ...(form.requirements !== undefined   ? { requirements: form.requirements }   : {}),
      };
      await updateJob(job.id as unknown as string, payload, token);
      onClose();
    } catch (e: any) {
      setErr(apiError(e, t("owner_offers.error_save") || "Failed to update job"));
    } finally {
      setSaving(false);
    }
  };

  const inp: React.CSSProperties = { width:"100%", background:"#131313", border:"1px solid #222", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#d0d0d0", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:5 };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:500, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"32px 20px", overflowY:"auto" }}>
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:18, width:"100%", maxWidth:520, padding:"28px 28px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#fff" }}>{t("owner_offers.edit_job_modal") || "Edit Job"}</p>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#555" }}><X size={18} /></button>
        </div>
        <p style={{ margin:"0 0 20px", fontSize:12, color:"#444" }}>
          {job.title} · {t("owner_offers.rate_locked", { rate: rate.toLocaleString(), type: job.rateType?.replace("PER_","").toLowerCase() }) || `Rate locked at RWF ${rate.toLocaleString()}/${job.rateType?.replace("PER_","").toLowerCase()}`}
        </p>

        {/* Timing */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <div><label style={lbl}>{t("owner_offers.start_date") || "Start Date"}</label><input type="date" min={todayStr} value={form.date} onChange={set("date")} style={inp} /></div>
          <div><label style={lbl}>{t("owner_offers.start_time") || "Start Time"}</label><input type="time" value={form.time} onChange={set("time")} style={inp} /></div>
        </div>

        {/* Duration + Workers */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <div>
            <label style={lbl}>{t("owner_offers.duration_hours") || "Duration (hours)"}</label>
            <input type="number" min="0.5" step="0.5" value={form.durationHours} onChange={set("durationHours")} style={inp} />
          </div>
          <div>
            <label style={lbl}>{t("owner_offers.workers_needed") || "Workers needed"}</label>
            <input type="number" min="1" max="200" value={form.headcount} onChange={set("headcount")} style={inp} />
          </div>
        </div>

        {/* Urgency */}
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>{t("owner_offers.urgency") || "Urgency"}</label>
          <select value={form.urgency} onChange={set("urgency")} style={{ ...inp }}>
            <option value="SCHEDULED">{t("owner_offers.urgency_scheduled") || "Scheduled"}</option>
            <option value="SAME_DAY">{t("owner_offers.urgency_sameday") || "Same day"}</option>
            <option value="IMMEDIATE">{t("owner_offers.urgency_immediate") || "Immediate"}</option>
          </select>
        </div>

        {/* Location */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <div>
            <label style={lbl}>{t("owner_offers.province") || "Province"}</label>
            <select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value, district: "" }))} style={{ ...inp }}>
              <option value="">{t("owner_offers.select_default") || "Select…"}</option>
              {RWANDA_PROVINCES.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>{t("owner_offers.district") || "District"}</label>
            <select value={form.district} onChange={set("district")} style={{ ...inp }} disabled={!form.province}>
              <option value="">{t("owner_offers.select_default") || "Select…"}</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>{t("owner_offers.location_notes") || "Location notes"}</label>
          <input type="text" placeholder="e.g. Gate B, 2nd floor…" value={form.locationNotes} onChange={set("locationNotes")} style={inp} />
        </div>

        {/* Description + Requirements */}
        <div style={{ marginBottom:10 }}>
          <label style={lbl}>{t("owner_offers.description") || "Description"}</label>
          <RichTextEditor value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
        </div>
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>{t("owner_offers.requirements") || "Requirements"}</label>
          <RichTextEditor value={form.requirements} onChange={v => setForm(f => ({ ...f, requirements: v }))} />
        </div>

        {/* Escrow preview */}
        {gross > 0 && (
          <div style={{ background:"#131313", border:"1px solid #1e1e1e", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:"#555" }}>
                {t("owner_offers.gross", { heads, hours, rate: rate.toLocaleString() }) || `Gross (${heads} × ${hours}h × RWF ${rate.toLocaleString()})`}
              </span>
              <span style={{ fontSize:11, color:"#888" }}>RWF {gross.toLocaleString()}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:"#555" }}>{t("owner_offers.platform_fee") || "Platform fee (25% from worker)"}</span>
              <span style={{ fontSize:11, color:"#ef4444" }}>−RWF {fee.toLocaleString()}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:"#555" }}>{t("owner_offers.workers_receive") || "Workers receive"}</span>
              <span style={{ fontSize:11, color:"#22c55e" }}>RWF {workerNet.toLocaleString()}</span>
            </div>
            {diff !== 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", borderTop:"1px solid #1e1e1e", paddingTop:6, marginTop:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#aaa" }}>{t("owner_offers.escrow_change") || "Escrow change"}</span>
                <span style={{ fontSize:11, fontWeight:700, color: diff > 0 ? "#f97316" : "#22c55e" }}>
                  {diff > 0 ? "+" : ""}RWF {diff.toLocaleString()} {diff > 0 ? (t("owner_offers.will_be_frozen") || "will be frozen") : (t("owner_offers.will_be_refunded") || "will be refunded")}
                </span>
              </div>
            )}
          </div>
        )}

        {err && <p style={{ margin:"0 0 12px", fontSize:12, color:"#ef4444" }}>{err}</p>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={save} disabled={saving}
            style={{ flex:1, background:"#f97316", color:"#fff", border:"none", borderRadius:9, padding:"11px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            {saving ? (t("owner_offers.saving") || "Saving…") : (t("owner_offers.save_changes") || "Save changes")}
          </button>
          <button onClick={onClose}
            style={{ flex:1, background:"transparent", color:"#555", border:"1px solid #222", borderRadius:9, padding:"11px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            {t("owner_offers.cancel") || "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
