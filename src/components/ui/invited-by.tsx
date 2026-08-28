"use client";

/**
 * "Joseph invites you."
 *
 * A referral link used to arrive silently: the code went into a hidden piece of
 * state and the page looked exactly like the one anybody else would see. That
 * throws away the only thing an invitation has going for it, which is that
 * somebody a person already trusts put their name to it.
 *
 * It draws nothing at all when there is no code, when the code belongs to
 * nobody, or while the answer is still coming back. A mistyped link should look
 * like an ordinary sign-up page, never like a claim of an invitation that was
 * never made.
 */

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { toGatewayUrl } from "@/lib/gateway";

/** Reads ?ref= once, so a page does not have to know about URLs to use this. */
export function useReferralCode(): string {
  const [code, setCode] = useState("");
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) setCode(ref.trim().toUpperCase());
    } catch {
      // No window, or a URL the browser will not parse: no invitation, then.
    }
  }, []);
  return code;
}

export function InvitedBy({ code, style }: { code: string; style?: React.CSSProperties }) {
  const { t } = useLanguage();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!code) { setName(""); return; }
    let alive = true;
    // Through the same-origin gateway, like every other call: the backend
    // address is not something a page should be spelling out.
    fetch(toGatewayUrl(`/api/referrals/who/${encodeURIComponent(code)}`))
      .then(r => r.json())
      .then(d => { if (alive) setName((d?.data?.name || "").trim()); })
      .catch(() => { /* silence is the right answer: no banner, ordinary page */ });
    return () => { alive = false; };
  }, [code]);

  if (!name) return null;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(249,115,22,0.08)",
        border: "1px solid rgba(249,115,22,0.25)",
        borderRadius: 12, padding: "11px 13px", marginBottom: 16,
        ...style,
      }}
    >
      <span style={{
        width: 28, height: 28, borderRadius: "50%", background: "#f97316", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <UserPlus size={14} color="#000" />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>
          {(t("referral.invites_you") || "{name} invites you").replace("{name}", name)}
        </div>
        <div style={{ color: "#9a9a9a", fontSize: 11.5, marginTop: 1 }}>
          {t("referral.invite_hint") || "Finish signing up and they will know you arrived."}
        </div>
      </div>
    </div>
  );
}
