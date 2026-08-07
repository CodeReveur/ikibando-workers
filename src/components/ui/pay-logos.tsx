"use client";

import { useEffect, useState } from "react";
import { getMobileProviders, PAY_COUNTRIES, type MobileMethod, type MobileProviders } from "@/lib/api";

// Provider logos for the payment-method selector. Real brand marks live in /public.
export function MastercardMark({ size = 22 }: { size?: number }) {
  const r = size * 0.34;
  return (
    <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`} aria-label="Mastercard">
      <circle cx={size * 0.4} cy={size * 0.31} r={r} fill="#EB001B" />
      <circle cx={size * 0.6} cy={size * 0.31} r={r} fill="#F79E1B" fillOpacity={0.9} />
    </svg>
  );
}

export type PayMethodValue = "MTN_MOMO" | "AIRTEL_MONEY" | "VISA" | "MASTERCARD";

/** Rich info for the selected method, so a caller can route a PawaPay operator when it's not XentriPay. */
export interface SelectedMethod extends MobileMethod { country: string; currency: string; }

/** The collection-payload fields (provider/operator/country) for a selected method, for any flow. */
export function payFieldsOf(m: SelectedMethod | null | undefined):
  { paymentProvider?: "XENTRIPAY" | "PAWAPAY"; providerCode?: string; country?: string } {
  return m ? { paymentProvider: m.provider, providerCode: m.code, country: m.country } : {};
}

/**
 * The real brand logo in /public for a method, resolved from its operator code (then label).
 * Order matters: VODACOM_MPESA_COD carries both "VODACOM" and "MPESA", so Vodacom is checked first.
 * Logos mirror PawaPay's own operator set (mtn, airtel, orange, moov, vodacom, mpesa, free, zamtel).
 */
function brandLogo(m: MobileMethod): string | null {
  const s = `${m.code} ${m.label}`.toUpperCase();
  if (s.includes("VODACOM")) return "/vodacom.png";
  if (s.includes("MPESA") || s.includes("M-PESA")) return "/mpesa.png";
  if (s.includes("MTN"))     return "/mtn.png";
  if (s.includes("AIRTEL"))  return "/airtel.png";
  if (s.includes("ORANGE"))  return "/orange.png";
  if (s.includes("MOOV"))    return "/moov.png";
  if (s.includes("ZAMTEL"))  return "/zamtel.png";
  if (s.includes("FREE"))    return "/free.png";
  return null;
}

/** A small brand logo/chip for a method, chosen from its operator code/kind. */
function MethodLogo({ m }: { m: MobileMethod }) {
  if (m.kind === "CARD") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <img src="/visa.png" alt="Visa" style={{ height: 14, width: "auto", objectFit: "contain" }} /><MastercardMark size={22} />
    </span>
  );
  const logo = brandLogo(m);
  if (logo) return <img src={logo} alt={m.label} style={{ height: 24, width: "auto", maxWidth: "100%", objectFit: "contain" }} />;
  return <span style={{ fontSize: 12, fontWeight: 800, color: "#111" }}>{m.label}</span>;
}

/** Map a selected method to the legacy PayMethodValue the XentriPay flow understands (null for PawaPay). */
export function toPayMethodValue(m: MobileMethod): PayMethodValue | null {
  if (m.provider !== "XENTRIPAY") return null;
  if (m.code === "AIRTEL") return "AIRTEL_MONEY";
  if (m.kind === "CARD") return "VISA";
  return "MTN_MOMO";
}

/**
 * A never-null legacy PayMethodValue for ANY method, including PawaPay operators. This is the value
 * stored on the row's `method` column and used for the Rwanda XentriPay failover; the real routing
 * uses the SelectedMethod's provider/code/country carried by `onMethod`.
 */
export function legacyMethodOf(m: MobileMethod): PayMethodValue {
  if (m.kind === "CARD") return "VISA";
  if (m.label.toLowerCase().includes("airtel") || m.code.includes("AIRTEL")) return "AIRTEL_MONEY";
  return "MTN_MOMO";
}

const FLAG = (iso2: string) =>
  iso2.length === 2 ? String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1f1a5 + c.charCodeAt(0))) : "";

/**
 * Country-aware payment-method selector. Auto-detects the visitor's country and lets them change it
 * (a Rwandan can pay with Ugandan mobile money, and a wrong geo-IP guess stays fixable), then shows
 * the operators available there with their real brand logos. Backward compatible: {@code onChange}
 * still fires the legacy PayMethodValue for XentriPay methods; use {@code onMethod} to also receive
 * the full method (country + PawaPay operator code) for routing.
 */
export function PayMethodSelector({ value, onChange, onMethod }: {
  value: PayMethodValue;
  onChange: (value: PayMethodValue) => void;
  onMethod?: (m: SelectedMethod) => void;
}) {
  const [cfg, setCfg] = useState<MobileProviders | null>(null);
  const [country, setCountry] = useState<string>("");
  const [selCode, setSelCode] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMobileProviders(country || undefined)
      .then(c => { if (!alive) return; setCfg(c); if (!country) setCountry(c.country); })
      .catch(() => {});
    return () => { alive = false; };
  }, [country]);

  const select = (m: MobileMethod) => {
    setSelCode(m.code);
    // Always set a valid legacy method (used for the row's method column + Rwanda failover); the
    // full method - including the PawaPay operator + country - flows through onMethod for routing.
    onChange(legacyMethodOf(m));
    if (onMethod && cfg) onMethod({ ...m, country: cfg.country, currency: cfg.currency });
  };

  const methods = cfg?.methods ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Country picker: auto-detected, changeable. No text label or code/currency pill - the flag
          and the country name in the control already say what it is. */}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>
          {FLAG(country || "RW")}
        </span>
        <select
          value={country}
          onChange={e => { setCountry(e.target.value); setSelCode(null); }}
          aria-label="Payment country"
          style={{
            width: "100%", background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10,
            padding: "9px 12px 9px 34px", fontSize: 13, color: "#eee", outline: "none", fontFamily: "inherit",
            appearance: "none",
          }}
        >
          {PAY_COUNTRIES.map(c => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
        </select>
      </div>

      {/* Method tiles for the selected country. */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {methods.map(m => {
          const legacy = toPayMethodValue(m);
          const active = legacy ? (legacy === value || (legacy === "VISA" && (value === "VISA" || value === "MASTERCARD")))
                                : selCode === m.code;
          return (
            <button
              key={m.code}
              type="button"
              onClick={() => select(m)}
              aria-pressed={active}
              style={{
                flex: "1 1 90px", minWidth: 0,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                background: active ? "rgba(249,115,22,0.08)" : "#141414",
                border: active ? "1px solid #f97316" : "1px solid #2a2a2a",
                borderRadius: 12, padding: "12px 8px", cursor: "pointer",
                fontFamily: "inherit", transition: "border-color 0.12s, background 0.12s",
              }}
            >
              <span style={{
                background: "#fff", borderRadius: 10, height: 42, width: "100%", maxWidth: 66,
                display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", padding: "0 8px",
              }}>
                <MethodLogo m={m} />
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.2, textAlign: "center", color: active ? "#f97316" : "#aaa" }}>
                {m.label}
              </span>
            </button>
          );
        })}
        {methods.length === 0 && (
          <span style={{ fontSize: 12, color: "#666", padding: "8px 0" }}>Loading payment methods…</span>
        )}
      </div>
    </div>
  );
}
