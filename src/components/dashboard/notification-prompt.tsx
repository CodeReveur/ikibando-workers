"use client";

import { useEffect, useState } from "react";
import { Bell, X, Briefcase, MessageSquare, Wallet } from "lucide-react";
import { useSession } from "./session-ctx";
import { pushSupported } from "@/lib/push";
import { useLanguage } from "@/lib/language-context";

// "Not now" snoozes the ask for a few days so we never nag on every visit; a
// fresh browser session also gets at most one prompt (sessionStorage guard).
const SNOOZE_KEY = "notif_prompt_snooze_until";
const SEEN_KEY = "notif_prompt_seen";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Soft ask, shown once after a logged-in user's session is detected, offering to turn on browser
 * notifications. Clicking "Enable" triggers the browser's own permission prompt (where the user
 * clicks Allow) and subscribes this browser to push. Only shown when push is supported and the
 * permission is still undecided - never when already granted or blocked.
 */
export function NotificationPrompt() {
  const session = useSession();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    if (!pushSupported() || Notification.permission !== "default") return;
    if (sessionStorage.getItem(SEEN_KEY)) return;
    const snooze = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (snooze && Date.now() < snooze) return;

    const timer = setTimeout(() => {
      if (Notification.permission === "default") {
        setOpen(true);
        sessionStorage.setItem(SEEN_KEY, "1");
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [session]);

  const enable = async () => {
    setBusy(true);
    try {
      const token = localStorage.getItem("access_token") || "";
      const { enablePush } = await import("@/lib/push");
      await enablePush(token); // opens the browser's native permission prompt
    } catch {
      /* denied or unsupported - nothing more to do */
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setOpen(false);
  };

  if (!open) return null;

  const rows: { Icon: typeof Briefcase; text: string }[] = [
    { Icon: Briefcase, text: t("notif_prompt.perk_jobs") || "New jobs and application updates" },
    { Icon: MessageSquare, text: t("notif_prompt.perk_messages") || "Replies and messages from support" },
    { Icon: Wallet, text: t("notif_prompt.perk_payments") || "Payments, top-ups and withdrawals" },
  ];

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380, background: "#161616", border: "1px solid #272727",
          borderRadius: 18, padding: 24, position: "relative",
          fontFamily: "Inter, DM Sans, system-ui, sans-serif", color: "#f0f0f0",
        }}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#666", cursor: "pointer", padding: 4 }}
        >
          <X size={18} />
        </button>

        <div style={{
          width: 52, height: 52, borderRadius: 14, marginBottom: 16,
          background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Bell size={26} color="#f97316" />
        </div>

        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
          {t("notif_prompt.title") || "Turn on notifications"}
        </h2>
        <p style={{ margin: "6px 0 16px", fontSize: 13, color: "#888", lineHeight: 1.5 }}>
          {t("notif_prompt.subtitle") || "Get instant alerts even when this tab is closed. Click Enable, then Allow on your browser's prompt."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {rows.map(({ Icon, text }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon size={15} color="#f97316" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "#bbb" }}>{text}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={dismiss}
            style={{
              flex: 1, padding: "11px 16px", borderRadius: 10, border: "1px solid #2a2a2a",
              background: "transparent", color: "#aaa", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {t("notif_prompt.later") || "Not now"}
          </button>
          <button
            onClick={enable}
            disabled={busy}
            style={{
              flex: 2, padding: "11px 16px", borderRadius: 10, border: "none",
              background: "#f97316", color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? (t("notif_prompt.enabling") || "Enabling…") : (t("notif_prompt.enable") || "Enable notifications")}
          </button>
        </div>
      </div>
    </div>
  );
}
