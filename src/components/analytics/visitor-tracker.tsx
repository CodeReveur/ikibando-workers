"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8088";
const SESSION_KEY = "mp_visitor_id";

/** Stable anonymous per-browser id, so the backend can count unique visitors. */
function visitorId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/**
 * Fire-and-forget visitor beacon. Sends one event to `/api/track` on every route change so the
 * admin panel can report traffic, devices, IPs and locations. Failures are swallowed — tracking
 * must never affect the visitor's experience.
 */
export function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload = {
      sessionId: visitorId(),
      path: window.location.pathname + window.location.search,
      title: document.title,
      referrer: document.referrer || undefined,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    const token =
      typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null;

    // fetch+keepalive lets us attach the auth token (to associate signed-in users); if that
    // throws synchronously we fall back to a plain sendBeacon.
    try {
      fetch(`${BASE}/api/track`, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {
      try {
        navigator.sendBeacon?.(
          `${BASE}/api/track`,
          new Blob([JSON.stringify(payload)], { type: "application/json" }),
        );
      } catch {
        /* ignore */
      }
    }
  }, [pathname]);

  return null;
}
