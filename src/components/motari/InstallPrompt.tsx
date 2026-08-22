"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { Download, Share, X } from "lucide-react";

/** The Chrome install event, which TypeScript's DOM lib does not describe. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "motari_install_dismissed";
const DISMISS_DAYS = 7;

/** Already running as an installed app? Then there is nothing to offer. */
function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Phones and tablets only: a touch device without a fine pointer. */
function isHandheld(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const touch = navigator.maxTouchPoints > 0;
  const mobileUa = /android|iphone|ipad|ipod|mobile|tablet|silk|kindle/i.test(navigator.userAgent);
  return (coarse && touch) || mobileUa;
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  // iPadOS reports itself as a Mac, so the touch count is what gives it away.
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch { return false; }
}

/**
 * Offers to install the Motari app on the home screen. Chrome hands us the
 * install event, so the card can install in one tap; iOS never does, so there
 * the card explains the Share → Add to Home Screen route instead. Phones and
 * tablets only, and never again for a week once dismissed.
 */
export function InstallPrompt({ appName }: { appName?: string }) {
  const { t } = useLanguage();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (isInstalled() || !isHandheld() || dismissedRecently()) return;

    const onPrompt = (e: Event) => {
      // Keep the event so the card, not the browser, decides when to ask.
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS has no event: show the card on its own after a moment, so it lands
    // once the map is up rather than over a blank screen.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) iosTimer = setTimeout(() => setShowIos(true), 2500);

    // The app is registered as installable only once the worker is live.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  if (gone || (!event && !showIos)) return null;

  const close = () => {
    setGone(true);
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
  };

  const install = async () => {
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
    } catch { /* the browser refused: the card just closes */ }
    setGone(true);
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
  };

  const name = appName || t("common.buttons.ask_motari") || "Ask Motari";

  return (
    <div style={{
      position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 1500,
      background: "rgba(0,0,0,0.96)", backdropFilter: "blur(12px)",
      border: "1px solid #7c3a10", borderRadius: 14, padding: "12px 13px",
      boxShadow: "0 16px 48px rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", gap: 11,
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: 9, background: "#f97316", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Download size={17} color="#000" />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.35 }}>
          {t("motari.install.title") || "Install"} {name}
        </div>
        <div style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          color: "#888", marginTop: 2, lineHeight: 1.5,
        }}>
          {event
            ? (t("motari.install.hint") || "Keep it on your home screen")
            : (t("motari.install.ios_hint") || "Share, then Add to Home Screen")}
        </div>
      </div>

      {event ? (
        <button onClick={install} style={{
          borderRadius: 9, padding: "9px 15px", fontSize: 9.5, fontWeight: 900,
          letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer",
          fontFamily: "inherit", border: "none", background: "#f97316", color: "#000", flexShrink: 0,
        }}>
          {t("motari.install.cta") || "Install"}
        </button>
      ) : (
        <Share size={16} color="#f97316" style={{ flexShrink: 0 }} />
      )}

      <button onClick={close} aria-label="Close" style={{
        background: "none", border: "none", color: "#666", cursor: "pointer", padding: 2, flexShrink: 0,
      }}>
        <X size={14} />
      </button>
    </div>
  );
}
