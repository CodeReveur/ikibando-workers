"use client";

import { useState, useEffect } from "react";
import { Bot, X, HandCoins } from "lucide-react";
import { BazaBotChat } from "./bazabot";
import { DonationModal } from "@/components/donate/donation-modal";
import { useLanguage } from "@/lib/language-context";
import { Z } from "@/lib/z-layers";

/**
 * Floating BazaBot launcher, mounted globally so any visitor (logged-in or not)
 * can ask for help. Hidden on the dashboard, which has its own in-page help chat.
 */
export function BazaBotWidget() {
  const [open, setOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const { t } = useLanguage();

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open]);

  return (
    <>
    {/* bottom follows --fab-offset so a page with its own fixed bottom bar (the job detail
        apply ribbon) can lift these buttons clear of it instead of having them cover its CTA. */}
    <div style={{
      position: "fixed", right: 20, bottom: "var(--fab-offset, 20px)", zIndex: Z.floating,
      fontFamily: "Inter, system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12,
    }}>
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

      {/* Small money icon, stacked just above BazaBot - opens the donation flow. Hidden while chat is open. */}
      {!open && (
        <button
          onClick={() => setDonateOpen(true)}
          aria-label={t("donate.cta")}
          title={t("donate.cta")}
          style={{
            width: 44, height: 44, borderRadius: 99, border: "1px solid rgba(249,115,22,0.5)", cursor: "pointer",
            background: "#161616", color: "#f97316",
            boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
        >
          <HandCoins size={20} />
        </button>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close chat" : "Chat with BazaBot"}
        style={{
          width: 56, height: 56, borderRadius: 99, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #fb8c3c, #f97316)",
          boxShadow: "0 8px 24px rgba(249,115,22,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", transition: "transform 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.06)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? <X size={24} /> : <Bot size={26} />}
      </button>

      <style>{`@keyframes bb-pop { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>
    </div>

    {/* Outside the fixed launcher above: that wrapper has its own z-index, which makes it a
        stacking context, and a dialog nested inside one cannot rise above anything painted
        over the wrapper (the job page's apply bar did exactly that) no matter its z-index. */}
    <DonationModal open={donateOpen} onClose={() => setDonateOpen(false)} />
    </>
  );
}
