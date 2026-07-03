"use client";

import { useState, useEffect } from "react";
import { Zap, CheckCircle, Star, Award, TrendingUp, Shield, Copy, Users, Gift } from "lucide-react";
import { useSession } from "@/components/dashboard/session-ctx";
import { fmt } from "@/lib/dashboard-data";
import { SectionHead } from "@/components/dashboard/ui";
import { getBonuses, type BonusSummary } from "@/lib/api";

export default function SeekerBonuses() {
  const session = useSession();
  const [copied, setCopied]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [bonus, setBonus]     = useState<BonusSummary | null>(null);

  const refCode = (session?.name?.split(" ")[0]?.toUpperCase() ?? "USER") + "2024";

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    getBonuses(token)
      .then(setBonus)
      .catch(() => setBonus({ total: 0, count: 0, items: [] }))
      .finally(() => setLoading(false));
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(refCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const total = bonus?.total ?? 0;
  const items = bonus?.items ?? [];

  // How workers earn bonuses. These are program descriptions, not fake balances.
  const WAYS = [
    { icon: Users,       label: "Refer a friend",   desc: "They complete their first job", reward: "RWF 1,000", color: "#60a5fa" },
    { icon: CheckCircle, label: "First job done",    desc: "Complete your debut job",       reward: "RWF 500",   color: "#22c55e" },
    { icon: Star,        label: "5-star streak",     desc: "Keep a 5.0 rating for 10 jobs", reward: "RWF 2,000", color: "#f59e0b" },
    { icon: Award,       label: "10 jobs club",      desc: "Complete 10 jobs",              reward: "RWF 3,000", color: "#a78bfa" },
    { icon: TrendingUp,  label: "Top worker",        desc: "Rank in the top 10%",           reward: "RWF 5,000", color: "#f97316" },
    { icon: Shield,      label: "Verified pro",      desc: "Pass identity verification",    reward: "RWF 1,000", color: "#fb923c" },
  ];

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div>
      {/* Bonus balance hero */}
      <div style={{
        background: "linear-gradient(135deg,#120e00 0%,#111 100%)",
        border: "1px solid #221800", borderRadius: 18, padding: "26px 28px",
        marginBottom: 14, display: "flex", alignItems: "center", gap: 20,
      }}>
        <div style={{
          width: 62, height: 62, borderRadius: 18, background: "rgba(249,115,22,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Gift size={28} color="#f97316" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#5a4000", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Bonus earned</p>
          <p style={{ margin: "0 0 4px", fontSize: 38, fontWeight: 900, color: "#f97316", letterSpacing: "-1.5px" }}>
            {loading ? "…" : fmt(total)}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#4a3500" }}>
            {loading ? "Loading your bonuses…"
              : `Credited to your wallet · ${bonus?.count ?? 0} bonus${(bonus?.count ?? 0) === 1 ? "" : "es"}`}
          </p>
        </div>
        <a href="/seeker/earnings" style={{
          background: "#f97316", color: "#fff", textDecoration: "none",
          borderRadius: 10, padding: "11px 24px", fontSize: 13, fontWeight: 700,
          fontFamily: "inherit", flexShrink: 0,
        }}>Withdraw</a>
      </div>

      {/* Bonus history */}
      <SectionHead title="Bonus history" />
      <div style={{ background: "#131313", border: "1px solid #1c1c1c", borderRadius: 14, marginBottom: 14, overflow: "hidden" }}>
        {loading ? (
          <p style={{ margin: 0, padding: "22px", fontSize: 13, color: "#4a4a4a" }}>Loading…</p>
        ) : items.length === 0 ? (
          <div style={{ padding: "28px 22px", textAlign: "center" }}>
            <Gift size={26} color="#2e2e2e" style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13, color: "#4a4a4a" }}>No bonuses yet.</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#333" }}>Complete jobs and refer friends to start earning.</p>
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
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#666", textTransform: "uppercase" }}>{b.status}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Referral */}
      <div style={{ background: "#131313", border: "1px solid #1c1c1c", borderRadius: 14, padding: "20px 22px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Users size={15} color="#60a5fa" />
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#e0e0e0" }}>Referral program</p>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#4a4a4a", lineHeight: 1.7 }}>
          Earn <strong style={{ color: "#f97316" }}>RWF 1,000</strong> for every friend who joins with your code and completes their first job.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 9,
            padding: "10px 14px", fontSize: 13, color: "#888", fontFamily: "monospace",
          }}>{refCode}</div>
          <button onClick={copy} style={{
            background: copied ? "rgba(34,197,94,0.1)" : "#1a1a1a",
            border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "#222"}`, borderRadius: 9,
            padding: "10px 14px", cursor: "pointer",
            color: copied ? "#22c55e" : "#666",
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            transition: "all 0.15s",
          }}>
            <Copy size={13} /> {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Ways to earn */}
      <SectionHead title="Ways to earn bonuses" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
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
