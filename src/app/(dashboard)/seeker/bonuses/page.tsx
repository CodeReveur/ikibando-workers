"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Star, Award, TrendingUp, Shield, Copy, Users, Gift } from "lucide-react";
import { fmt } from "@/lib/dashboard-data";
import { SectionHead } from "@/components/dashboard/ui";
import { useLanguage } from "@/lib/language-context";
import { getBonuses, getMyReferral, type BonusSummary, type ReferralSummary } from "@/lib/api";

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
  const [bonus, setBonus]       = useState<BonusSummary | null>(null);
  const [referral, setReferral] = useState<ReferralSummary | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    Promise.allSettled([getBonuses(token), getMyReferral(token)])
      .then(([b, r]) => {
        if (b.status === "fulfilled") setBonus(b.value);
        if (r.status === "fulfilled") setReferral(r.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const total   = bonus?.total ?? 0;
  const items   = bonus?.items ?? [];
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

  const WAYS = [
    { icon: Users,       label: t("seeker_bonuses.refer_friend") || "Refer a friend",   desc: t("seeker_bonuses.refer_friend_desc") || "They complete their first job", reward: fmt(reward), color: "#60a5fa" },
    { icon: CheckCircle, label: t("seeker_bonuses.first_job") || "First job done",    desc: t("seeker_bonuses.first_job_desc") || "Complete your debut job",       reward: t("seeker_bonuses.coming_soon") || "Coming soon", color: "#22c55e" },
    { icon: Star,        label: t("seeker_bonuses.streak") || "5-star streak",     desc: t("seeker_bonuses.streak_desc") || "Keep a 5.0 rating for 10 jobs", reward: t("seeker_bonuses.coming_soon") || "Coming soon", color: "#f59e0b" },
    { icon: Award,       label: t("seeker_bonuses.club") || "10 jobs club",      desc: t("seeker_bonuses.club_desc") || "Complete 10 jobs",              reward: t("seeker_bonuses.coming_soon") || "Coming soon", color: "#a78bfa" },
    { icon: TrendingUp,  label: t("seeker_bonuses.top_worker") || "Top worker",        desc: t("seeker_bonuses.top_worker_desc") || "Rank in the top 10%",           reward: t("seeker_bonuses.coming_soon") || "Coming soon", color: "#f97316" },
    { icon: Shield,      label: t("seeker_bonuses.verified_pro") || "Verified pro",      desc: t("seeker_bonuses.verified_pro_desc") || "Pass identity verification",    reward: t("seeker_bonuses.coming_soon") || "Coming soon", color: "#fb923c" },
  ];

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString(currentLocale, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div>
      <style>{`
        .bonus-hero { display: flex; alignItems: center; gap: 20px; }
        .ref-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 16px; }
        .copy-link-box { display: flex; gap: 8px; }
        .ways-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
        @media (max-width: 900px) {
          .ways-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 500px) {
          .bonus-hero { flex-direction: column; align-items: stretch !important; text-align: center; }
          .bonus-hero > a { width: 100%; text-align: center; }
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
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#5a4000", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("seeker_bonuses.bonus_earned")}</p>
          <p style={{ margin: "0 0 4px", fontSize: 38, fontWeight: 900, color: "#f97316", letterSpacing: "-1.5px" }}>
            {loading ? "…" : fmt(total)}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#4a3500" }}>
            {loading ? t("seeker_bonuses.loading_bonus")
              : t("seeker_bonuses.credited_desc")
                ?.replace("{count}", String(bonus?.count ?? 0))
                ?.replace("{plural}", (bonus?.count ?? 0) === 1 ? "" : "es") || `Credited to your wallet · ${bonus?.count ?? 0} bonuses`}
          </p>
        </div>
        <a href="/seeker/earnings" style={{
          background: "#f97316", color: "#fff", textDecoration: "none",
          borderRadius: 10, padding: "11px 24px", fontSize: 13, fontWeight: 700,
          fontFamily: "inherit", flexShrink: 0,
        }}>{t("seeker_bonuses.withdraw")}</a>
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
          }}>{loading ? "Loading…" : code || "—"}</div>
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

      {/* Bonus history */}
      <SectionHead title={t("seeker_bonuses.bonus_history") || "Bonus history"} />
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
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: "rgba(34,197,94,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Gift size={17} color="#22c55e" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e0e0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.note}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>{fmtDate(b.createdAt)}</p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: b.status === "SUCCESS" ? "#22c55e" : "#666" }}>+{fmt(b.amountRwf)}</p>
                {b.status !== "SUCCESS" && (
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#666", textTransform: "uppercase" }}>{b.status === "PENDING" ? (t("seeker_jobs.status_pending") || "PENDING") : b.status}</p>
                )}
              </div>
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
