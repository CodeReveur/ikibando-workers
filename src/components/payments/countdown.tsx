"use client";

import { useEffect, useState } from "react";

/** Live "1h 23m 45s" countdown to an ISO timestamp; renders "now" once elapsed. */
export function Countdown({ to, onElapsed }: { to: string; onElapsed?: () => void }) {
  const [left, setLeft] = useState(() => new Date(to).getTime() - Date.now());

  useEffect(() => {
    const tick = () => {
      const ms = new Date(to).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0 && onElapsed) onElapsed();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [to, onElapsed]);

  if (left <= 0) return <span>now</span>;
  const s = Math.floor(left / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const parts = h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{parts}</span>;
}
