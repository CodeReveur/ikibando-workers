"use client";

// Provider logos for the payment-method selector. Real brand marks:
//  - /mtn.png    → MoMo from MTN   (copied from brand assets)
//  - /airtel.png → Airtel Money    (copied from brand assets)
//  - /visa.png   → Visa            (copied from brand assets)
//  - Mastercard  → inline SVG (two overlapping circles) so we don't ship a raw asset
// Each logo sits on a small white chip so it reads cleanly on the dark UI.

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

// One tile per method. Visa & Mastercard share a single card tile (same gateway flow) — selecting
// it maps to VISA, and it stays highlighted for either card value.
const METHODS: { value: PayMethodValue; label: string; logo: React.ReactNode; match?: PayMethodValue[] }[] = [
  { value: "MTN_MOMO",     label: "MTN Mobile Money", logo: <img src="/mtn.png"    alt="MTN Mobile Money" style={{ height: 26, width: "auto", objectFit: "contain" }} /> },
  { value: "AIRTEL_MONEY", label: "Airtel Money",     logo: <img src="/airtel.png" alt="Airtel Money"     style={{ height: 26, width: "auto", objectFit: "contain", borderRadius: 4 }} /> },
  {
    value: "VISA", label: "Visa / Mastercard", match: ["VISA", "MASTERCARD"],
    logo: (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <img src="/visa.png" alt="Visa" style={{ height: 15, width: "auto", objectFit: "contain" }} />
        <MastercardMark size={24} />
      </span>
    ),
  },
];

/**
 * Horizontal row of selectable payment-method tiles. Each tile shows the provider's real logo
 * on a white chip; tapping a tile selects it (no radio buttons).
 */
export function PayMethodSelector({ value, onChange }: {
  value: PayMethodValue;
  onChange: (value: PayMethodValue) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {METHODS.map(m => {
        const active = m.match ? m.match.includes(value) : value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            aria-pressed={active}
            style={{
              flex: 1, minWidth: 0,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              background: active ? "rgba(249,115,22,0.08)" : "#141414",
              border: active ? "1px solid #f97316" : "1px solid #2a2a2a",
              borderRadius: 12, padding: "14px 8px", cursor: "pointer",
              fontFamily: "inherit", transition: "border-color 0.12s, background 0.12s",
            }}
          >
            <span style={{
              background: "#fff", borderRadius: 10, height: 46, width: "100%", maxWidth: 68,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxSizing: "border-box", padding: "0 8px",
            }}>
              {m.logo}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.25, textAlign: "center", color: active ? "#f97316" : "#aaa" }}>
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
