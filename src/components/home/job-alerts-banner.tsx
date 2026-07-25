"use client";

import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { workerNetHourly, type JobDto } from "@/lib/api";
import { rateUnit } from "@/lib/rate-unit";
import { categoryLabel } from "@/lib/browse-taxonomy";
import { useLanguage } from "@/lib/language-context";

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

/**
 * Compact "hiring now" ad strip for the hero: small, left-aligned, professional. Surfaces real
 * recently-posted jobs so every visitor sees the platform is active. Up to 3 slim strips on desktop
 * (one per row), one on mobile, rotating through open jobs every 5s.
 */
export function JobAlertsBanner({ jobs }: { jobs: JobDto[] }) {
  const { t } = useLanguage();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (jobs.length <= 1) return;
    const id = setInterval(() => setIdx(i => (i + 1) % jobs.length), 5000);
    return () => clearInterval(id);
  }, [jobs.length]);

  if (jobs.length === 0) return null;

  const count = jobs.length >= 3 ? 3 : 1;
  const cards = Array.from({ length: count }, (_, k) => jobs[(idx + k) % jobs.length]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start",
      gap: 7, marginBottom: 16,
    }}>
      <style>{`
        .jab-ad {
          width:100%; max-width:430px; text-align:left; text-decoration:none; position:relative;
          display:flex; align-items:center; gap:10px; overflow:hidden;
          background:linear-gradient(120deg,#1e1a16 0%,#181818 55%);
          border:1px solid rgba(249,115,22,0.26); border-radius:12px; padding:7px 10px 7px 13px;
          box-shadow:0 4px 16px rgba(0,0,0,0.3); animation:jabIn .45s ease both;
          transition:transform .14s ease, border-color .14s ease, box-shadow .14s ease;
        }
        .jab-ad:hover { transform:translateY(-2px); border-color:#f97316;
          box-shadow:0 8px 22px rgba(249,115,22,0.16); }
        .jab-ad::before { content:""; position:absolute; inset:0 auto 0 0; width:3px;
          background:linear-gradient(#f97316,#ea580c); }
        @keyframes jabIn { from{opacity:0;} to{opacity:1;} }
        @keyframes jabDot { 0%,100%{opacity:1; transform:scale(1);} 50%{opacity:.3; transform:scale(.65);} }
        /* Outlined pill to match the nav "Hire now" button, with a periodic attention shake. */
        .jab-cta {
          flex-shrink:0; display:inline-flex; align-items:center; gap:5px;
          background:transparent; color:#f97316;
          border:1.5px solid rgba(249,115,22,0.5); border-radius:999px;
          padding:6px 14px; font-size:11.5px; font-weight:700; white-space:nowrap;
          transform-origin:center; animation:jabShake 3s ease-in-out infinite;
          transition:background .15s, border-color .15s, color .15s;
        }
        .jab-ad:hover .jab-cta { background:rgba(249,115,22,0.12); border-color:#f97316; color:#fb923c; }
        @keyframes jabShake {
          0%,80%,100% { transform:translateX(0) rotate(0) scale(1); }
          83% { transform:translateX(-2px) rotate(-4deg) scale(1.06); }
          86% { transform:translateX(2px)  rotate(4deg)  scale(1.06); }
          89% { transform:translateX(-2px) rotate(-3deg) scale(1.04); }
          92% { transform:translateX(2px)  rotate(3deg)  scale(1.04); }
          95% { transform:translateX(-1px) rotate(-1deg) scale(1.02); }
          98% { transform:translateX(0) rotate(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) { .jab-cta { animation:none; } }
        @media (max-width:720px){ .jab-hide-mobile{ display:none !important; } }
      `}</style>

      {cards.map((j, i) => {
        const net  = workerNetHourly(j);
        const unit = rateUnit(j).short;
        const emp  = j.employerName || t("home.hero.alert_default_employer") || "An employer";
        return (
          <a
            key={j.id + "-" + i}
            href={`/jobs/${j.id}`}
            className={"jab-ad" + (i > 0 ? " jab-hide-mobile" : "")}
          >
            {/* text block */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: 999, background: "#22c55e",
                  animation: "jabDot 1.4s ease-in-out infinite", flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "#f97316", whiteSpace: "nowrap",
                }}>
                  {t("home.hero.alert_tag") || "Hiring now"}
                </span>
                <span style={{
                  fontSize: 10, color: "#7a7a7a", overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  · {(t("home.hero.alert_hiring", { employer: emp }) || `${emp} is hiring on MpahMapu`)}
                </span>
              </div>
              <p style={{
                margin: 0, fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {j.title}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, color: "#f97316", background: "rgba(249,115,22,0.12)",
                  borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap",
                }}>
                  {categoryLabel(j.category, t)}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#e6e6e6", whiteSpace: "nowrap" }}>
                  {fmt(net)}<span style={{ fontSize: 9.5, fontWeight: 500, color: "#777" }}> / {unit}</span>
                </span>
              </div>
            </div>

            {/* CTA - outlined pill like "Hire now", with an attention shake every few seconds */}
            <span className="jab-cta">
              {t("home.hero.alert_cta") || "View & apply"} <ArrowRight size={12} />
            </span>
          </a>
        );
      })}
    </div>
  );
}
