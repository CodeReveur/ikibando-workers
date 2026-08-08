"use client";

import type { BillingMode } from "@/lib/api";

const fmtRwf = (n: number) => `RWF ${n.toLocaleString()}`;

/**
 * The choice every employer makes when posting, hiring or offering: fund the wage on the platform,
 * or pay a flat fee and settle with the worker themselves.
 *
 * Shared by the post-job, hire and offer flows so the wording and the trade-off stay identical
 * wherever the decision is taken.
 */
export function BillingModeChoice({ value, onChange, escrowAmount, listingFee, t }: {
  value: BillingMode;
  onChange: (m: BillingMode) => void;
  /** What the platform-managed option would cost now (wage + service fee). */
  escrowAmount: number;
  /** The flat non-refundable publish fee. */
  listingFee: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Choice
        active={value === "ESCROW"}
        onClick={() => onChange("ESCROW")}
        title={t("post_job.billing.escrow_title") || "Pay the worker through MpahMapu"}
        desc={t("post_job.billing.escrow_desc")
          || "You deposit the wage now. We hold it, run the payment schedule and release it as the work is done."}
        price={escrowAmount > 0 ? `${fmtRwf(escrowAmount)} ${t("post_job.billing.now") || "now"}` : ""}
      />
      <Choice
        active={value === "LISTING"}
        onClick={() => onChange("LISTING")}
        title={t("post_job.billing.listing_title") || "Just find me workers"}
        desc={t("post_job.billing.listing_desc")
          || "One flat, non-refundable fee. You agree the pay with the worker and settle it yourselves, so there is no deposit and no payment steps on the platform."}
        price={`${fmtRwf(listingFee)} ${t("post_job.billing.once") || "once"}`}
      />
    </div>
  );
}

function Choice({ active, onClick, title, desc, price }: {
  active: boolean; onClick: () => void; title: string; desc: string; price: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "flex", flexDirection: "column", gap: 4, textAlign: "left", width: "100%",
        background: active ? "rgba(249,115,22,0.08)" : "#141414",
        border: `1px solid ${active ? "#f97316" : "#2a2a2a"}`,
        borderRadius: 12, padding: "12px 14px", cursor: "pointer",
        fontFamily: "inherit", transition: "border-color 0.12s, background 0.12s",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: active ? "#f97316" : "#e8e8e8" }}>{title}</span>
        {price && (
          <span style={{ fontSize: 12, fontWeight: 800, color: active ? "#f97316" : "#888", whiteSpace: "nowrap" }}>
            {price}
          </span>
        )}
      </span>
      <span style={{ fontSize: 11, color: "#777", lineHeight: 1.5 }}>{desc}</span>
    </button>
  );
}
