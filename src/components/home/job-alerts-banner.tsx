"use client";

import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { workerNetHourly, type JobDto } from "@/lib/api";
import { rateUnit } from "@/lib/rate-unit";
import { categoryLabel } from "@/lib/browse-taxonomy";
import { useLanguage } from "@/lib/language-context";

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

/**
 * Live "hiring now" ad banner for the hero. Shows up to 3 real, recently-posted jobs on desktop and
 * one on mobile, rotating through the list every few seconds so every open role gets its moment.
 * Built to read like a professional ad - it is meant to make a visitor want to look closer.
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

  // Many jobs -> a row of 3; otherwise a single ad. Mobile always shows one (CSS hides the rest).
  const count = jobs.length >= 3 ? 3 : 1;
  const cards = Array.from({ length: count }, (_, k) => jobs[(idx + k) % jobs.length]);

  return (
    <div style={{ marginBottom: 26 }}>
      <style>{`
        .jab-row { display:flex; gap:12px; justify-content:center; align-items:stretch; flex-wrap:nowrap; }
        .jab-card {
          flex:1 1 0; min-width:0; max-width:300px; text-align:left; text-decoration:none;
          background:linear-gradient(160deg,#1d1a17 0%,#181818 60%);
          border:1px solid rgba(249,115,22,0.28); border-radius:14px; padding:13px 15px;
          display:flex; flex-direction:column; gap:7px; position:relative; overflow:hidden;
          box-shadow:0 6px 22px rgba(0,0,0,0.35); animation:jabIn .5s ease both;
          transition:transform .15s ease, border-color .15s ease, box-shadow .15s ease;
        }
        .jab-card:hover { transform:translateY(-3px); border-color:#f97316;
          box-shadow:0 10px 28px rgba(249,115,22,0.18); }
        .jab-card::before { content:""; position:absolute; inset:0 auto 0 0; width:3px;
          background:linear-gradient(#f97316,#ea580c); }
        @keyframes jabIn { from{opacity:0;} to{opacity:1;} }
        @keyframes jabDot { 0%,100%{opacity:1; transform:scale(1);} 50%{opacity:.35; transform:scale(.7);} }
        @media (max-width:720px){ .jab-hide-mobile{ display:none !important; } .jab-card{ max-width:none; } }
      `}</style>

      <div className="jab-row">
        {cards.map((j, i) => {
          const net  = workerNetHourly(j);
          const unit = rateUnit(j).short;
          const emp  = j.employerName || t("home.hero.alert_default_employer") || "An employer";
          return (
            <a
              key={j.id + "-" + i}
              href={`/jobs/${j.id}`}
              className={"jab-card" + (i > 0 ? " jab-hide-mobile" : "")}
            >
              {/* live tag */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 999, background: "#22c55e",
                  animation: "jabDot 1.4s ease-in-out infinite", flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "#f97316",
                }}>
                  {t("home.hero.alert_tag") || "Hiring now"}
                </span>
              </div>

              {/* who is hiring */}
              <p style={{ margin: 0, fontSize: 11, color: "#8a8a8a", lineHeight: 1.35,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {(t("home.hero.alert_hiring", { employer: emp }) || `${emp} is hiring on MpahMapu`)}
              </p>

              {/* job title */}
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: "#fff", lineHeight: 1.25,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {j.title}
              </p>

              {/* category + amount */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316",
                  background: "rgba(249,115,22,0.12)", borderRadius: 999, padding: "2px 8px" }}>
                  {categoryLabel(j.category, t)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#f0f0f0", whiteSpace: "nowrap" }}>
                  {fmt(net)}<span style={{ fontSize: 10, fontWeight: 500, color: "#777" }}> / {unit}</span>
                </span>
              </div>

              {/* CTA */}
              <span style={{
                marginTop: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                background: "#f97316", color: "#fff", borderRadius: 9, padding: "8px 12px",
                fontSize: 12, fontWeight: 800,
              }}>
                {t("home.hero.alert_cta") || "View & apply"} <ArrowRight size={13} />
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
