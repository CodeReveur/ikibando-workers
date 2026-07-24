"use client";

import { useState } from "react";
import { HandCoins, X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

const USD_PRESETS = [1, 5, 10, 50, 100, 500];
const ACCENT = "#f97316";

/**
 * A small "would you love to support with a donation?" add-on for the payment sections. Presets are
 * in USD ($1…$500) and a custom USD amount; both convert to RWF via the admin exchange rate and are
 * reported to the parent (which adds the RWF to the charged total). Presets apply on click; the
 * custom field applies on blur (focus released), as requested.
 */
export function DonationAddon({ usdToRwf, valueRwf, onChange }: {
  usdToRwf: number;
  valueRwf: number;
  onChange: (rwf: number) => void;
}) {
  const { t } = useLanguage();
  const [selUsd, setSelUsd] = useState<number | null>(null);
  const [custom, setCustom] = useState("");

  const rate = usdToRwf > 0 ? usdToRwf : 1300;

  const pick = (usd: number) => { setSelUsd(usd); setCustom(""); onChange(Math.round(usd * rate)); };
  const applyCustom = () => {
    const usd = parseFloat(custom.replace(/[^0-9.]/g, "")) || 0;
    setSelUsd(null);
    onChange(usd > 0 ? Math.round(usd * rate) : 0);
  };
  const clear = () => { setSelUsd(null); setCustom(""); onChange(0); };

  return (
    <div style={{
      marginTop: 12, padding: 12, borderRadius: 12,
      border: "1px solid rgba(249,115,22,0.28)", background: "rgba(249,115,22,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#e6e6e6" }}>
        <HandCoins size={15} color={ACCENT} />
        {t("donate.addon_prompt")}
        <a href="/donate" target="_blank" rel="noopener" style={{ color: ACCENT, fontSize: 12, marginLeft: "auto", textDecoration: "none" }}>
          {t("donate.learn")}
        </a>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
        {USD_PRESETS.map(u => {
          const active = selUsd === u && !custom;
          return (
            <button key={u} type="button" onClick={() => pick(u)} style={{
              flex: "1 0 auto", minWidth: 54, padding: "7px 10px", borderRadius: 9, cursor: "pointer",
              fontSize: 13, fontWeight: 700,
              background: active ? "rgba(249,115,22,0.16)" : "#1c1c1c",
              border: `1px solid ${active ? ACCENT : "#2a2a2a"}`,
              color: active ? ACCENT : "#ccc",
            }}>${u}</button>
          );
        })}
      </div>

      <input
        value={custom}
        onChange={e => setCustom(e.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={applyCustom}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyCustom(); } }}
        inputMode="decimal"
        placeholder={t("donate.custom_usd")}
        style={{
          width: "100%", marginTop: 8, background: "#0f0f0f", border: "1px solid #2a2a2a",
          borderRadius: 9, padding: "9px 11px", fontSize: 13, color: "#f0f0f0", outline: "none",
        }}
      />

      {valueRwf > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, fontSize: 12.5, color: "#22c55e" }}>
          + {valueRwf.toLocaleString()} RWF {t("donate.addon_added")}
          <button type="button" onClick={clear} title={t("donate.remove")} style={{
            marginLeft: "auto", background: "none", border: "none", color: "#888", cursor: "pointer", display: "flex", padding: 0,
          }}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
