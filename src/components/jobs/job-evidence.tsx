"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Video, Trash2, Loader2, ShieldCheck } from "lucide-react";
import {
  getJobEvidence, addJobEvidence, deleteJobEvidence, uploadFile, apiError,
  MAX_EVIDENCE_PHOTOS, MAX_EVIDENCE_VIDEO_SECONDS,
  type JobEvidenceDto,
} from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";

/** Read a local video's duration before we bother uploading it. */
function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(el.duration); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    el.src = url;
  });
}

/**
 * Proof of work for a job: up to 20 photos and one short video. Always optional - nothing here
 * gates completion or payment. `canUpload` is true for the worker on the job; everyone else
 * (employer, admin) sees the same evidence read-only.
 */
export function JobEvidence({ jobId, canUpload }: { jobId: string; canUpload: boolean }) {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<JobEvidenceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "PHOTO" | "VIDEO">(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";

  const load = useCallback(() => {
    if (!token) { setLoading(false); return; }
    getJobEvidence(jobId, token)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [jobId, token]);

  useEffect(() => { load(); }, [load]);

  const photos = items.filter(i => i.kind === "PHOTO");
  const videos = items.filter(i => i.kind === "VIDEO");

  const onPick = async (file: File, kind: "PHOTO" | "VIDEO") => {
    setBusy(kind);
    try {
      if (kind === "VIDEO") {
        // Check length locally - uploading then rejecting would waste the worker's data.
        const seconds = await videoDuration(file).catch(() => 0);
        if (seconds > MAX_EVIDENCE_VIDEO_SECONDS + 0.5) {
          toastError(t("job_evidence.video_too_long")
            || `Video must be ${MAX_EVIDENCE_VIDEO_SECONDS} seconds or shorter.`);
          return;
        }
      }
      const url = await uploadFile(file, token);
      const saved = await addJobEvidence(jobId, { kind, url }, token);
      setItems(prev => [...prev, saved]);
      success(t("job_evidence.added") || "Proof added");
    } catch (e) {
      toastError(apiError(e, t("job_evidence.failed") || "Couldn't add that. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async (id: string) => {
    try {
      await deleteJobEvidence(jobId, id, token);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      toastError(apiError(e, t("job_evidence.remove_failed") || "Couldn't remove that."));
    }
  };

  if (loading) return null;
  // Nothing to show and nothing to add → don't render an empty section.
  if (!canUpload && items.length === 0) return null;

  const photosLeft = MAX_EVIDENCE_PHOTOS - photos.length;

  return (
    <div style={{ background: "#131313", border: "1px solid #1c1c1c", borderRadius: 14, padding: "18px 20px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <ShieldCheck size={15} color="#22c55e" />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#ccc" }}>
          {t("job_evidence.title") || "Proof of work"}
        </p>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#444" }}>
          {photos.length}/{MAX_EVIDENCE_PHOTOS} {t("job_evidence.photos") || "photos"}
          {videos.length > 0 ? ` · 1 ${t("job_evidence.video") || "video"}` : ""}
        </span>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 11, color: "#555", lineHeight: 1.6 }}>
        {canUpload
          ? (t("job_evidence.worker_hint")
              || `Optional. Add up to ${MAX_EVIDENCE_PHOTOS} photos and one ${MAX_EVIDENCE_VIDEO_SECONDS}s video showing the work. It's visible to the employer and our team if anything is questioned.`)
          : (t("job_evidence.viewer_hint") || "Proof the worker attached for this job.")}
      </p>

      {items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, marginBottom: canUpload ? 14 : 0 }}>
          {videos.map(v => (
            <div key={v.id} style={{ position: "relative", gridColumn: "span 2", borderRadius: 10, overflow: "hidden", background: "#0d0d0d", border: "1px solid #222" }}>
              <video src={v.url} controls preload="metadata" style={{ width: "100%", height: "100%", maxHeight: 160, objectFit: "cover", display: "block" }} />
              {canUpload && <RemoveBtn onClick={() => onRemove(v.id)} />}
            </div>
          ))}
          {photos.map(p => (
            <div key={p.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: "#0d0d0d", border: "1px solid #222" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                <img src={p.url} alt={p.caption ?? "Proof"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </a>
              {canUpload && <RemoveBtn onClick={() => onRemove(p.id)} />}
            </div>
          ))}
        </div>
      )}

      {canUpload && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={photoInput} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f, "PHOTO"); e.target.value = ""; }} />
          <input ref={videoInput} type="file" accept="video/*" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f, "VIDEO"); e.target.value = ""; }} />

          <button
            onClick={() => photoInput.current?.click()}
            disabled={busy !== null || photosLeft <= 0}
            style={btnStyle(busy === "PHOTO" || photosLeft <= 0)}
          >
            {busy === "PHOTO" ? <Loader2 size={13} className="spin" /> : <Camera size={13} />}
            {photosLeft > 0
              ? `${t("job_evidence.add_photo") || "Add photo"} (${photosLeft})`
              : (t("job_evidence.photos_full") || "Photo limit reached")}
          </button>

          <button
            onClick={() => videoInput.current?.click()}
            disabled={busy !== null || videos.length >= 1}
            style={btnStyle(busy === "VIDEO" || videos.length >= 1)}
          >
            {busy === "VIDEO" ? <Loader2 size={13} className="spin" /> : <Video size={13} />}
            {videos.length >= 1
              ? (t("job_evidence.video_added") || "Video added")
              : `${t("job_evidence.add_video") || "Add video"} (${MAX_EVIDENCE_VIDEO_SECONDS}s)`}
          </button>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Remove" style={{
      position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 6,
      background: "rgba(0,0,0,0.65)", border: "1px solid #333", color: "#ef4444",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
    }}>
      <Trash2 size={11} />
    </button>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8,
    padding: "8px 14px", fontSize: 12, fontWeight: 600,
    color: disabled ? "#444" : "#ccc",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  };
}
