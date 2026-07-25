"use client";

import { useEffect } from "react";

/**
 * Console deterrent, the same approach big platforms use (e.g. Facebook's
 * "Stop!"): a loud warning against pasting code or poking the API from
 * DevTools, reprinted if the console is cleared. DevTools itself cannot be
 * blocked by any website - real protection lives server-side (auth, permission
 * checks, rate limits and the origin guard).
 */
export function ConsoleGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const warn = () => {
      try {
        console.log("%cSTOP!", "color:#ef4444;font-size:44px;font-weight:900;text-shadow:1px 1px 0 #000");
        console.log(
          "%cThis browser feature is intended for developers. If someone told you to copy and paste something here, it is a scam and could give them access to your MpahMapu account.",
          "color:#f97316;font-size:14px;font-weight:600");
        console.log(
          "%cAll API activity is authenticated, rate-limited and logged with your IP.",
          "color:#888;font-size:12px");
      } catch { /* consoles can be stubbed */ }
    };
    warn();
    const iv = setInterval(warn, 60000); // survives console.clear()
    return () => clearInterval(iv);
  }, []);
  return null;
}
