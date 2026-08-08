"use client";

import { useState, useEffect, useRef } from "react";
import { X, CheckCircle, Loader2, ChevronDown, ChevronUp, Paperclip, FileText } from "lucide-react";
import { applyForJob, uploadFile, workerNetHourly, apiError, type JobDto } from "@/lib/api";
import { saveRedirect } from "@/lib/auth-redirect";
import { useToast } from "@/components/ui/toast";
import { RichTextEditor, RichTextDisplay, htmlToPlainText } from "@/components/ui/rich-text-editor";
import { useLanguage } from "@/lib/language-context";
import { Z } from "@/lib/z-layers";

interface Props { job: JobDto; onClose: () => void; }

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: Z.modal, padding: 16,
  background: "rgba(0,0,0,0.75)",
  backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "Inter, DM Sans, system-ui, sans-serif",
};
const card: React.CSSProperties = {
  background: "#161616", border: "1px solid #222", borderRadius: 20,
  width: "100%", maxWidth: 440,
  maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden",
};
// Header and footer stay put; only the middle scrolls, so the scrollbar reads as intentional.
const modalHeader: React.CSSProperties = { padding: "24px 24px 16px", flexShrink: 0, borderBottom: "1px solid #222" };
const modalBody: React.CSSProperties = { padding: "16px 24px", overflowY: "auto", flex: 1 };
const modalFooter: React.CSSProperties = { padding: "14px 24px 20px", flexShrink: 0, borderTop: "1px solid #222" };

const fileName = (url: string) => {
  try { return decodeURIComponent(url.split("/").pop() || "file").split("?")[0]; }
  catch { return "file"; }
};
const isImage = (url: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);

export function ApplyModal({ job, onClose }: Props) {
  const { t } = useLanguage();
  const { error: toastError, success: toastSuccess } = useToast();
  const [bestFit, setBestFit]     = useState("");
  const [token, setToken]         = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [reqOpen, setReqOpen]     = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const DRAFT_KEY = `MpahMapu_draft_apply_${job.id}`;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!token) {
      saveRedirect();
      window.location.href = "/signin";
      return;
    }
    const remaining = 10 - attachments.length;
    if (remaining <= 0) {
      toastError(t("apply.errors.max_files") || "You can attach up to 10 files.");
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of list) {
        if (f.size > 30 * 1024 * 1024) {
          toastError((t("apply.errors.file_too_large") || "File is too large (max 30MB): ") + f.name);
          continue;
        }
        const url = await uploadFile(f, token);
        urls.push(url);
      }
      if (urls.length) setAttachments(prev => [...prev, ...urls]);
    } catch (e: any) {
      toastError(apiError(e, t("apply.errors.upload_failed") || "Failed to upload file. Please try again."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const rateLabel = (type: string) => {
    if (type === "PER_DAY") return " / " + (t("post_job.units.day") || "day");
    if (type === "PER_WEEK") return " / " + (t("post_job.units.week") || "wk");
    if (type === "PER_MONTH") return " / " + (t("post_job.units.month") || "mo");
    if (type === "PER_YEAR") return " / " + (t("post_job.units.year") || "yr");
    return " / " + (t("post_job.units.hour") || "hr");
  };

  useEffect(() => {
    try { setToken(localStorage.getItem("access_token")); } catch { /* ignore */ }
  }, []);

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setBestFit(JSON.parse(raw) ?? "");
    } catch {}
  }, []);

  // Save draft on change
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(bestFit)); } catch {}
  }, [bestFit]);

  async function handleSubmit() {
    if (!token) {
      saveRedirect();
      window.location.href = "/signin";
      return;
    }
    setSubmitting(true);
    try {
      await applyForJob(job.id, {
        bestFit: bestFit.trim() || undefined,
        attachments: attachments.length ? attachments : undefined,
      }, token);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setDone(true);
    } catch (e: any) {
      toastError(apiError(e, t("apply.errors.failed") || "Failed to submit application. Please try again."), { title: t("apply.errors.failed_title") || "Application Failed" });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...card, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 56, height: 56, borderRadius: 999, margin: "0 auto 16px", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle size={28} color="#22c55e" />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: "#fff" }}>
          {t("apply.success.title")}
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#555", lineHeight: 1.65 }}>
          {t("apply.success.desc", { title: job.title, name: job.employerName || "" })}
        </p>
        <button onClick={onClose} style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 700, color: "#aaa", cursor: "pointer", fontFamily: "inherit" }}>
          {t("apply.buttons.close") || "Close"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>

        {/* header (fixed) */}
        <div style={modalHeader}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {t("apply.header.title")}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.title}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#555" }}>{fmt(workerNetHourly(job))}{rateLabel(job.rateType)} · {job.district}</p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", flexShrink: 0 }}><X size={18} /></button>
          </div>
        </div>

        {/* scrollable body */}
        <div style={modalBody}>

        {!token && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14,
            background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 8, padding: "8px 12px",
          }}>
            <span style={{ fontSize: 12, color: "#ef4444" }}>
              <a
                href="/signin"
                style={{ color: "#f97316", fontWeight: 700 }}
                onClick={() => saveRedirect()}
              >
                {t("apply.errors.must_be_signed_in")}
              </a>
            </span>
          </div>
        )}

        {/* REQUIREMENTS (collapsed on top, view more) */}
        {job.requirements && (
          <div style={{
            marginBottom: 14, background: "#111", border: "1px solid #242424",
            borderRadius: 12, overflow: "hidden",
          }}>
            <button
              onClick={() => setReqOpen(o => !o)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 8, background: "none", border: "none", cursor: "pointer",
                padding: "11px 14px", fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t("apply.labels.requirements") || "Requirements"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#777" }}>
                {reqOpen ? (t("apply.buttons.view_less") || "View less") : (t("apply.buttons.view_more") || "View more")}
                {reqOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
            {reqOpen ? (
              <div style={{ padding: "0 14px 14px", borderTop: "1px solid #202020" }}>
                <div style={{ paddingTop: 12 }}>
                  <RichTextDisplay content={job.requirements} />
                </div>
              </div>
            ) : (
              <div style={{
                padding: "0 14px 11px", fontSize: 12, color: "#888", lineHeight: 1.55,
                overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}>
                {htmlToPlainText(job.requirements)}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              {t("apply.labels.best_fit")}
            </label>
            <RichTextEditor
              placeholder={t("apply.placeholders.best_fit") || "Describe your experience, skills, or availability that make you ideal for this role…"}
              value={bestFit}
              onChange={v => setBestFit(v)}
            />
          </div>

          {/* SUPPORTING DOCUMENTS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {t("apply.labels.attachments") || "Supporting documents"}
            </label>

            {attachments.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {attachments.map((url, i) => (
                  <div key={url + i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#111", border: "1px solid #242424", borderRadius: 8,
                    padding: "6px 8px",
                  }}>
                    {isImage(url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <span style={{ width: 34, height: 34, borderRadius: 6, background: "#1c1c1c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FileText size={16} color="#888" />
                      </span>
                    )}
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, minWidth: 0, fontSize: 12, color: "#bbb", textDecoration: "none",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{fileName(url)}</a>
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#666", flexShrink: 0, display: "flex" }}
                      aria-label={t("apply.buttons.remove") || "Remove"}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={e => handleFiles(e.target.files)}
            />
            {attachments.length < 10 && (
              <button
                type="button"
                disabled={uploading || !token}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  background: "#111", border: "1px dashed #333", borderRadius: 10,
                  padding: "10px", fontSize: 12, fontWeight: 700,
                  color: uploading ? "#555" : "#aaa",
                  cursor: uploading || !token ? "not-allowed" : "pointer", fontFamily: "inherit",
                }}
              >
                {uploading
                  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />{t("apply.buttons.uploading") || "Uploading…"}</>
                  : <><Paperclip size={14} />{t("apply.buttons.add_files") || "Add files"}</>}
              </button>
            )}
            <p style={{ margin: 0, fontSize: 10.5, color: "#555" }}>
              {t("apply.hints.attachments") || "Any file type. Up to 10 files, 30MB each."}
            </p>
          </div>
        </div>
        {/* end scrollable body */}
        </div>

        {/* footer (fixed) */}
        <div style={modalFooter}>
          <button
            disabled={!token || submitting}
            onClick={handleSubmit}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: token && !submitting ? "#f97316" : "#1c1c1c",
              border: token ? "none" : "1px solid #272727",
              borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700,
              color: token && !submitting ? "#fff" : "#444",
              cursor: token && !submitting ? "pointer" : "not-allowed", fontFamily: "inherit",
            }}
          >
            {submitting && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {submitting ? (t("apply.buttons.submitting") || "Submitting…") : (t("apply.buttons.submit") || "Submit application")}
          </button>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    </div>
  );
}
