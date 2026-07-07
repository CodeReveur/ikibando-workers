"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";
import { BazaBotChat } from "./bazabot";

/**
 * Floating BazaBot launcher, mounted globally so any visitor (logged-in or not)
 * can ask for help. Hidden on the dashboard, which has its own in-page help chat.
 */
export function BazaBotWidget() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open]);

  // The dashboard already embeds BazaBot on its help pages.
  if (pathname?.startsWith("/owner") || pathname?.startsWith("/seeker")) return null;

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1000, fontFamily: "Inter, system-ui, sans-serif" }}>
      {open && (
        <div
          style={{
            position: "absolute", bottom: 72, right: 0,
            width: "min(380px, calc(100vw - 32px))",
            height: "min(560px, calc(100vh - 120px))",
            display: "flex",
            animation: "bb-pop 0.18s ease-out",
          }}
        >
          <BazaBotChat role="public" onClose={() => setOpen(false)} style={{ flex: 1, height: "100%", borderRadius: 16 }} />
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close chat" : "Chat with BazaBot"}
        style={{
          width: 56, height: 56, borderRadius: 99, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #fb8c3c, #f97316)",
          boxShadow: "0 8px 24px rgba(249,115,22,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", marginLeft: "auto", transition: "transform 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.06)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? <X size={24} /> : <Bot size={26} />}
      </button>

      <style>{`@keyframes bb-pop { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
