"use client";

// Provider logos for the payment-method selector. Real brand marks:
//  - /mtn.png    → MoMo from MTN   (copied from brand assets)
//  - /airtel.png → Airtel Money    (copied from brand assets)
//  - /visa.png   → Visa            (copied from brand assets)
//  - Mastercard  → inline SVG (two overlapping circles) so we don't ship a raw asset
// Each logo sits on a small white chip so it reads cleanly on the dark UI.

const chip: React.CSSProperties = {
  marginLeft: "auto", background: "#fff", borderRadius: 6,
  padding: "3px 7px", height: 26, boxSizing: "border-box",
  display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
};

export function MtnLogo() {
  return (
    <span style={chip}>
      <img src="/mtn.png" alt="MTN Mobile Money" style={{ height: 20, width: "auto", objectFit: "contain" }} />
    </span>
  );
}

export function AirtelLogo() {
  return (
    <span style={chip}>
      <img src="/airtel.png" alt="Airtel Money" style={{ height: 20, width: "auto", objectFit: "contain", borderRadius: 3 }} />
    </span>
  );
}

export function MastercardMark({ size = 22 }: { size?: number }) {
  const r = size * 0.34;
  return (
    <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`} aria-label="Mastercard">
      <circle cx={size * 0.4} cy={size * 0.31} r={r} fill="#EB001B" />
      <circle cx={size * 0.6} cy={size * 0.31} r={r} fill="#F79E1B" fillOpacity={0.9} />
    </svg>
  );
}

export function CardLogos() {
  return (
    <span style={chip}>
      <img src="/visa.png" alt="Visa" style={{ height: 13, width: "auto", objectFit: "contain" }} />
      <MastercardMark size={22} />
    </span>
  );
}
