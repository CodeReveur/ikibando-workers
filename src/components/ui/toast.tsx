"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────────────────── */

type ToastType = "error" | "success" | "info";

interface ToastAction { label: string; href: string; }
interface ToastItem {
  id:      string;
  message: string;
  type:    ToastType;
  title?:  string;
  action?: ToastAction;
  leaving: boolean;
}

export interface ToastOptions { title?: string; action?: ToastAction; }

export interface ToastCtx {
  toast:   (message: string, type?: ToastType, opts?: ToastOptions) => void;
  error:   (message: string, opts?: ToastOptions) => void;
  success: (message: string, opts?: ToastOptions) => void;
}

/* ── Context & hook ─────────────────────────────────────────────────────────── */

const Ctx = createContext<ToastCtx>({ toast: () => {}, error: () => {}, success: () => {} });

export function useToast(): ToastCtx { return useContext(Ctx); }

/* ── Provider ────────────────────────────────────────────────────────────────── */

const AUTO_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320);
  }, []);

  const add = useCallback((message: string, type: ToastType = "info", opts?: ToastOptions) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(prev => [...prev, {
      id, message, type, leaving: false,
      title:  opts?.title,
      action: opts?.action,
    }]);
    setTimeout(() => dismiss(id), AUTO_MS);
  }, [dismiss]);

  const ctx: ToastCtx = {
    toast:   add,
    error:   (msg, opts) => add(msg, "error",   { title: "Error",   ...opts }),
    success: (msg, opts) => add(msg, "success", { title: "Success", ...opts }),
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <ToastPortal toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

/* ── Rendering ───────────────────────────────────────────────────────────────── */

const ACCENT: Record<ToastType, string> = {
  error:   "#ef4444",
  success: "#22c55e",
  info:    "#3b82f6",
};

function ToastPortal({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <>
      <style>{`
        @keyframes t-in    { from{transform:translateX(calc(100% + 24px));opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes t-out   { from{transform:translateX(0);opacity:1} to{transform:translateX(calc(100% + 24px));opacity:0} }
        @keyframes t-shake { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-7px)} 30%{transform:translateX(6px)} 45%{transform:translateX(-5px)} 60%{transform:translateX(4px)} 75%{transform:translateX(-2px)} }
      `}</style>
      <div
        aria-live="polite"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 99999,
          display: "flex", flexDirection: "column", gap: 10,
          maxWidth: 360, width: "calc(100vw - 48px)",
          pointerEvents: "none",
          fontFamily: "Inter, DM Sans, system-ui, sans-serif",
        }}
      >
        {toasts.map(t => <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />)}
      </div>
    </>
  );
}

function ToastCard({ toast: t, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [shaking, setShaking] = useState(false);
  const shook = useRef(false);

  useEffect(() => {
    if (t.type === "error" && !shook.current) {
      shook.current = true;
      const a = setTimeout(() => setShaking(true), 120);
      const b = setTimeout(() => setShaking(false), 720);
      return () => { clearTimeout(a); clearTimeout(b); };
    }
  }, [t.type]);

  const color = ACCENT[t.type];
  const Icon  = t.type === "error" ? XCircle : t.type === "success" ? CheckCircle : Info;

  return (
    <div style={{ animation: t.leaving ? "t-out 0.3s ease forwards" : "t-in 0.35s ease forwards" }}>
      <div
        role="alert"
        style={{
          animation:   shaking ? "t-shake 0.6s ease" : undefined,
          pointerEvents: "all",
          background:  "#1a1a1a",
          border:      `1px solid ${color}55`,
          borderLeft:  `4px solid ${color}`,
          borderRadius: 12,
          padding:     "14px 16px",
          display:     "flex",
          alignItems:  "flex-start",
          gap:         12,
          boxShadow:   "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: 1 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {t.title && (
            <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, color: "#fff" }}>
              {t.title}
            </p>
          )}
          <p style={{ margin: 0, fontSize: 12, color: "#999", lineHeight: 1.55, wordBreak: "break-word" }}>
            {t.message}
          </p>
          {t.action && (
            <a
              href={t.action.href}
              style={{ display: "inline-block", marginTop: 6, fontSize: 11, color: "#f97316", fontWeight: 600, textDecoration: "underline" }}
            >
              {t.action.label} →
            </a>
          )}
        </div>

        <button
          onClick={() => onDismiss(t.id)}
          style={{
            flexShrink: 0, background: "none", border: "none",
            cursor: "pointer", color: "#555", padding: 2,
            display: "flex", alignItems: "center",
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
