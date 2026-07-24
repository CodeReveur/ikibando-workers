"use client";

import { useEffect, useState } from "react";

const KEY = "wallet_balance_hidden";
const EVT = "wallet-balance-hidden-change";

/**
 * Per-user (per-device) preference for hiding wallet balances behind an eye toggle. Defaults to
 * HIDDEN (eye off) so a balance never shows on screen until the user opts in. State is shared
 * across every balance display on the page via a window event, so one toggle flips them all.
 */
export function useHideBalance(): { hidden: boolean; toggle: () => void } {
  // Start hidden on both server and first client render (avoids a flash of the real amount).
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const read = () => {
      const v = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      setHidden(v === null ? true : v === "1"); // absent = hidden (default off)
    };
    read();
    window.addEventListener(EVT, read);
    window.addEventListener("storage", read); // sync across tabs
    return () => {
      window.removeEventListener(EVT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const toggle = () => {
    const next = !hidden;
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch {}
    setHidden(next);
    window.dispatchEvent(new Event(EVT));
  };

  return { hidden, toggle };
}

/** The masked string shown in place of a hidden amount. */
export const MASKED = "••••••";
