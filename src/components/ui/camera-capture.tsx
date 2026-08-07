"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, Loader2 } from "lucide-react";
import { Z } from "@/lib/z-layers";

/**
 * A real in-app camera.
 *
 * `<input capture="user">` is only a hint: desktop browsers ignore it completely
 * and several mobile browsers still open the gallery. getUserMedia gives an actual
 * live preview on every platform (over HTTPS), and we grab the frame ourselves.
 * Falls back to reporting an error so the caller can offer the file picker.
 */
export function CameraCapture({
  open, onCapture, onClose, title = "Take your photo",
}: {
  open: boolean;
  onCapture: (file: File) => void;
  onClose: () => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const stop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    (async () => {
      setError(null);
      setReady(false);
      stop();
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera. Use 'Upload a photo' instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e: any) {
        const name = e?.name || "";
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in your browser, or upload a photo instead."
            : name === "NotFoundError"
              ? "No camera found on this device. Upload a photo instead."
              : "Couldn't start the camera. Upload a photo instead.",
        );
      }
    })();

    return () => { cancelled = true; stop(); };
  }, [open, facing]);

  if (!open) return null;

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror the front camera so the shot matches what the user sees.
    if (facing === "user") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" }));
      onClose();
    }, "image/jpeg", 0.9);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: Z.modalNested, background: "rgba(0,0,0,0.92)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 460, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{title}</span>
        <button onClick={onClose} aria-label="Close"
          style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", display: "flex" }}>
          <X size={22} />
        </button>
      </div>

      <div style={{
        position: "relative", width: "100%", maxWidth: 460, aspectRatio: "3/4",
        background: "#111", borderRadius: 16, overflow: "hidden", border: "1px solid #2a2a2a",
      }}>
        <video
          ref={videoRef} playsInline muted
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: facing === "user" ? "scaleX(-1)" : undefined,
          }}
        />
        {!ready && !error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", gap: 8 }}>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Starting camera…
          </div>
        )}
        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: "#f59e0b", fontSize: 13, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        {/* Face guide so people frame themselves correctly */}
        {ready && (
          <div style={{
            position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%)",
            width: "58%", aspectRatio: "3/4", border: "2px dashed rgba(255,255,255,0.5)",
            borderRadius: "50%", pointerEvents: "none",
          }} />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18 }}>
        <button onClick={() => setFacing(f => (f === "user" ? "environment" : "user"))}
          title="Switch camera"
          style={{ background: "#1c1c1c", border: "1px solid #333", color: "#ccc", borderRadius: 999, width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <RefreshCw size={18} />
        </button>
        <button onClick={shoot} disabled={!ready}
          style={{
            background: ready ? "#f97316" : "#333", border: "none", color: "#fff",
            borderRadius: 999, width: 70, height: 70, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: ready ? "pointer" : "not-allowed",
          }}>
          <Camera size={28} />
        </button>
        <span style={{ width: 46 }} />
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
