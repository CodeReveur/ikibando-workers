"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Z } from "@/lib/z-layers";

/**
 * In-app modal for collecting a short reason (complaint, decline note, …).
 *
 * Replaces window.prompt(), which renders as a bare browser dialog titled
 * "www.mpahmapu.com says" - unstyled, untranslatable, unable to explain
 * consequences, and blocked outright by some mobile browsers.
 */
export function ReasonModal({
  open, title, description, placeholder, confirmLabel, cancelLabel,
  required = false, danger = false, busy = false, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** When true the confirm button stays disabled until something is typed. */
  required?: boolean;
  danger?: boolean;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      // Focus after paint so the caret lands in the box, like a native prompt.
      const id = setTimeout(() => ref.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      // Ctrl/Cmd+Enter submits, matching the chat composer elsewhere in the app.
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && (!required || value.trim())) onConfirm(value.trim());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, value, required, onConfirm, onCancel]);

  if (!open) return null;
  const blocked = busy || (required && !value.trim());

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: Z.modalNested, background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(3px)", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440, background: "#141414",
          border: "1px solid #2a2a2a", borderRadius: 16, overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          fontFamily: "Inter, DM Sans, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px 0" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>{title}</h3>
            {description && (
              <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "#8a8a8a", lineHeight: 1.5 }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onCancel} aria-label="Close"
            style={{ background: "none", border: "none", color: "#666", cursor: "pointer", display: "flex", padding: 2 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "14px 18px 0" }}>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={4}
            style={{
              width: "100%", resize: "vertical", background: "#0f0f0f",
              border: "1px solid #2a2a2a", borderRadius: 10, padding: "11px 12px",
              fontSize: 13.5, color: "#f0f0f0", outline: "none", fontFamily: "inherit",
              lineHeight: 1.5,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 18px 18px" }}>
          <button
            onClick={onCancel} disabled={busy}
            style={{
              background: "transparent", border: "1px solid #2f2f2f", color: "#aaa",
              borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}
          >
            {cancelLabel || "Cancel"}
          </button>
          <button
            onClick={() => onConfirm(value.trim())} disabled={blocked}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: blocked ? "#3a3a3a" : danger ? "#ef4444" : "#f97316",
              border: "none", color: "#fff", borderRadius: 10, padding: "9px 18px",
              fontSize: 13, fontWeight: 700, cursor: blocked ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: blocked ? 0.7 : 1,
            }}
          >
            {busy && <Loader2 size={14} style={{ animation: "rmspin 1s linear infinite" }} />}
            {confirmLabel}
          </button>
        </div>
        <style>{`@keyframes rmspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
