"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Star, Award, TrendingUp, Shield, Copy, Users, Gift } from "lucide-react";
import { fmt } from "@/lib/dashboard-data";
import { SectionHead } from "@/components/dashboard/ui";
import { useLanguage } from "@/lib/language-context";
import {
  getBonuses, getMyReferral, claimBonuses, getActiveBonusRules, apiError,
  type BonusSummary, type ReferralSummary, type BonusRule,
} from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export default function SeekerBonuses() {
  const { t, language } = useLanguage();
  const dateLocaleMap: Record<string, string> = {
    rw: "rw-RW",
    kinyy: "rw-RW",
    sw: "sw-TZ",
    fr: "fr-FR",
    en: "en-US",
  };
  const currentLocale = dateLocaleMap[language] || "en-RW";

  const [copied, setCopied]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [bonus, setBonus]       = useState<BonusSummary | null>(null);
  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [rules, setRules]       = useState<BonusRule[]>([]);
  const { success, error: toastError } = useToast();

  const doClaim = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    setClaiming(true);
    try {
      setBonus(await claimBonuses(token));
      success(t("seeker_bonuses.claimed") || "Bonus added to your wallet");
    } catch (e) {
      toastError(apiError(e, t("seeker_bonuses.claim_failed") || "Couldn't claim your bonus. Please try again."));
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    Promise.allSettled([getBonuses(token), getMyReferral(token), getActiveBonusRules(token)])
      .then(([b, r, p]) => {
        if (b.status === "fulfilled") setBonus(b.value);
        if (r.status === "fulfilled") setReferral(r.value);
        if (p.status === "fulfilled") setRules(p.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const total     = bonus?.total ?? 0;        // claimed - already wallet balance
  const claimable = bonus?.claimable ?? 0;    // still to claim
  const lifetime  = total + claimable;        // everything ever granted
  const items     = bonus?.items ?? [];
  const code    = referral?.code ?? "";
  const reward  = referral?.rewardPerReferral ?? 1000;
  const origin  = typeof window !== "undefined" ? window.location.origin : "https://mpahmapu.com";
  const link    = code ? `${origin}/signup?ref=${code}` : "";

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* Ways to earn = the promotions actually live right now, plus the referral programme.
     This used to be a hardcoded list where five of six said "Coming soon" forever; now a card
     only appears when an admin has switched that promotion on, so it's never an empty promise. */
  const TRIGGER_STYLE: Record<string, { icon: typeof Users; color: string }> = {
    FIRST_JOB:            { icon: CheckCircle, color: "#22c55e" },
    JOBS_MILESTONE:       { icon: Award,       color: "#a78bfa" },
    RATING_STREAK:        { icon: Star,        color: "#f59e0b" },
    IDENTITY_VERIFIED:    { icon: Shield,      color: "#fb923c" },
    NEWSLETTER_SUBSCRIBE: { icon: TrendingUp,  color: "#f97316" },
  };

  const WAYS = [
    {
      icon: Users,
      label: t("seeker_bonuses.refer_friend") || "Invite workers & employers",
      desc: t("seeker_bonuses.refer_friend_desc") || "Earn when an invited worker completes their first job, or an employer you invited has their first job released",
      reward: fmt(reward),
      color: "#60a5fa",
    },
    ...rules.map(r => ({
      icon: TRIGGER_STYLE[r.triggerType]?.icon ?? Gift,
      label: r.title,
      desc: r.description ?? "",
      reward: fmt(r.amountRwf),
      color: TRIGGER_STYLE[r.triggerType]?.color ?? "#f97316",
    })),
  ];

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString(currentLocale, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div>
      <style>{`
        .bonus-hero { display: flex; align-items: center; gap: 20px; }
        .claim-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #f97316;
          color: #fff;
          text-decoration: none;
          border-radius: 10px;
          padding: 11px 24px;
          font-size: 13px;
          font-weight: 700;
          font-family: inherit;
          flex-shrink: 0;
          box-sizing: border-box;
          transition: all 0.15s ease;
        }
        .claim-btn:hover {
          background: #ea580c;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(249,115,22,0.25);
        }
        .claim-btn:active {
          transform: translateY(0);
        }
        .ref-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 16px; }
        .copy-link-box { display: flex; gap: 8px; }
        .ways-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
        @media (max-width: 900px) {
          .ways-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 500px) {
          .bonus-hero { flex-direction: column; align-items: stretch !important; text-align: center; }
          .claim-btn { width: 100%; }
          .ways-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 340px) {
          .ref-stats { grid-template-columns: 1fr !important; }
          .copy-link-box { flex-direction: column; }
        }
      `}</style>

      {/* Bonus balance hero */}
      <div className="bonus-hero" style={{
        background: "linear-gradient(135deg,#120e00 0%,#111 100%)",
        border: "1px solid #221800", borderRadius: 18, padding: "26px 28px",
        marginBottom: 14,
      }}>
        <div style={{
          width: 62, height: 62, borderRadius: 18, background: "rgba(249,115,22,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          margin: "0 auto",
        }}>
          <Gift size={28} color="#f97316" />
        </div>
        {/* Headline is what's waiting to be claimed when there is any - a bonus isn't wallet
            money until claimed, so leading with the claimed total would be misleading. */}
        {/* This number always means one thing: what's claimable. Zero when there's nothing -
            money already claimed is just wallet balance and is reported on the history below. */}
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#5a4000", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {t("seeker_bonuses.ready_to_claim") || "Ready to claim"}
          </p>
          <p style={{ margin: "0 0 4px", fontSize: 38, fontWeight: 900, color: claimable > 0 ? "#f97316" : "#8a5a1a", letterSpacing: "-1.5px" }}>
            {loading ? "…" : fmt(claimable)}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#4a3500" }}>
            {loading ? t("seeker_bonuses.loading_bonus")
              : claimable > 0
                ? (t("seeker_bonuses.claim_desc") || "Claim it to add it to your wallet.")
                : (t("seeker_bonuses.nothing_to_claim") || "Nothing to claim right now.")}
          </p>
        </div>
        {claimable > 0 ? (
          <button onClick={doClaim} disabled={claiming} className="claim-btn"
                  style={{ border: "none", cursor: claiming ? "not-allowed" : "pointer", opacity: claiming ? 0.6 : 1 }}>
            {claiming
              ? (t("common.buttons.processing") || "Claiming…")
              : `${t("seeker_bonuses.claim") || "Claim"} ${fmt(claimable)}`}
          </button>
        ) : (
          // Nothing to claim → a quiet link, not an orange CTA that implies action.
          <a href="/seeker/earnings" className="claim-btn"
             style={{ background: "transparent", border: "1px solid #3a2a10", color: "#8a5a1a", boxShadow: "none" }}>
            {t("seeker_bonuses.view_wallet") || "View wallet"}
          </a>
        )}
      </div>

      {/* Referral program */}
      <div style={{ background: "#131313", border: "1px solid #1c1c1c", borderRadius: 14, padding: "20px 22px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Users size={15} color="#60a5fa" />
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#e0e0e0" }}>{t("seeker_bonuses.referral_program")}</p>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#4a4a4a", lineHeight: 1.7 }}>
          {t("seeker_bonuses.earn_reward_desc") ? (
            <span dangerouslySetInnerHTML={{
              __html: t("seeker_bonuses.earn_reward_desc")!.replace("{reward}", `<strong style="color: #f97316">${fmt(reward)}</strong>`)
            }} />
          ) : (
            <>Earn <strong style={{ color: "#f97316" }}>{fmt(reward)}</strong> for every friend who joins with your link and completes their first job.</>
          )}
        </p>

        {/* stats */}
        <div className="ref-stats">
          {[
            { label: t("seeker_bonuses.invited") || "Invited",  value: referral?.invited ?? 0 },
            { label: t("seeker_bonuses.rewarded") || "Rewarded", value: referral?.rewarded ?? 0 },
            { label: t("seeker_bonuses.earned") || "Earned",   value: fmt(referral?.totalEarned ?? 0) },
          ].map((s) => (
            <div key={s.label} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0e0e0" }}>{s.value}</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* code + copy link */}
        <div className="copy-link-box">
          <div style={{
            flex: 1, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 9,
            padding: "10px 14px", fontSize: 13, color: "#888", fontFamily: "monospace",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{loading ? "Loading…" : code || "-"}</div>
          <button onClick={copy} disabled={!link} style={{
            background: copied ? "rgba(34,197,94,0.1)" : "#1a1a1a",
            border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "#222"}`, borderRadius: 9,
            padding: "10px 14px", cursor: link ? "pointer" : "default",
            color: copied ? "#22c55e" : "#666",
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            transition: "all 0.15s", opacity: link ? 1 : 0.5,
          }}>
            <Copy size={13} /> {copied ? t("seeker_bonuses.link_copied") : t("seeker_bonuses.copy_link")}
          </button>
        </div>

        {/* invited friends */}
        {referral && referral.items.length > 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid #1c1c1c", paddingTop: 12 }}>
            {referral.items.map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, color: "#c0c0c0", fontWeight: 600 }}>{it.name}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 10, color: "#555" }}>{fmtDate(it.createdAt)}</p>
                </div>
                {it.status === "REWARDED"
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>+{fmt(it.rewardAmountRwf)}</span>
                  : <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>{t("seeker_jobs.status_pending") || "Pending"}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bonus history - the lifetime total lives here, not on the claim card. */}
      <SectionHead
        title={t("seeker_bonuses.bonus_history") || "Bonus history"}
        action={items.length > 0 ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>
            {fmt(lifetime)} {t("seeker_bonuses.total_earned") || "earned in total"}
          </span>
        ) : undefined}
      />
      <div style={{ background: "#131313", border: "1px solid #1c1c1c", borderRadius: 14, marginBottom: 14, overflow: "hidden" }}>
        {loading ? (
          <p style={{ margin: 0, padding: "22px", fontSize: 13, color: "#4a4a4a" }}>{t("common.general.loading") || "Loading…"}</p>
        ) : items.length === 0 ? (
          <div style={{ padding: "28px 22px", textAlign: "center" }}>
            <Gift size={26} color="#2e2e2e" style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13, color: "#4a4a4a" }}>{t("seeker_bonuses.no_bonuses")}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#333" }}>{t("seeker_bonuses.no_bonuses_desc")}</p>
          </div>
        ) : (
          items.map((b, i) => (
            <div key={b.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
              borderTop: i === 0 ? "none" : "1px solid #1a1a1a",
            }}>
              {(() => {
                const claimed = b.status === "SUCCESS";
                const accent  = claimed ? "#22c55e" : "#f97316";
                return (
                  <>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, background: `${accent}1a`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Gift size={17} color={accent} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e0e0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.note}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>{fmtDate(b.createdAt)}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: accent }}>+{fmt(b.amountRwf)}</p>
                      {/* Never leak a raw status code at a user. */}
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: claimed ? "#3d6b4a" : accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {claimed
                          ? (t("seeker_bonuses.status_claimed") || "Claimed")
                          : (t("seeker_bonuses.ready_to_claim") || "Ready to claim")}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          ))
        )}
      </div>

      {/* Ways to earn */}
      <SectionHead title={t("seeker_bonuses.ways_title") || "Ways to earn bonuses"} />
      <div className="ways-grid">
        {WAYS.map(({ icon: Icon, label, desc, reward, color }) => (
          <div key={label} style={{
            background: "#131313", border: "1px solid #1c1c1c",
            borderRadius: 14, padding: "18px 16px", textAlign: "center",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, margin: "0 auto 12px",
              background: `${color}18`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={22} color={color} />
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#d0d0d0" }}>{label}</p>
            <p style={{ margin: 0, fontSize: 10, color: "#3e3e3e" }}>{desc}</p>
            <p style={{ margin: "8px 0 0", fontSize: 11, fontWeight: 800, color }}>{reward}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
