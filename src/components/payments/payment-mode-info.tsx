"use client";

import { useLanguage } from "@/lib/language-context";
import type { PaymentMode } from "@/lib/api";

const UNIT_OF: Record<PaymentMode, "hour" | "day" | "week" | "month" | "year"> = {
  HOURLY: "hour", CUSTOM_HOURS: "hour",
  DAILY: "day", CUSTOM_DAYS: "day",
  WEEKLY: "week", MONTHLY: "month", CUSTOM_MONTHS: "month", YEARLY: "year",
};

/**
 * A localized, plain-language summary of a job's installment payment schedule, shown on public and
 * dashboard job details so a worker knows how they'll be paid before applying — e.g. "Paid every
 * 2 days · 4 payments". Safe to render for any job.
 */
export function PaymentModeInfo({
  paymentMode, paymentPeriods, paymentInterval, durationUnits, directRelease, style,
}: {
  paymentMode?: PaymentMode | null;
  paymentPeriods?: number | null;
  paymentInterval?: number | null;
  durationUnits?: number | null;
  directRelease?: boolean | null;
  style?: React.CSSProperties;
}) {
  const { t } = useLanguage();
  if (!paymentMode) return null;

  const periods = Math.max(1, paymentPeriods || 1);
  const interval = Math.max(1, paymentInterval || 1);
  const unitKey = UNIT_OF[paymentMode] || "day";
  const unitPl = (n: number) => t("post_job.units." + (n !== 1 ? unitKey + "s" : unitKey))
            || `${unitKey}${n !== 1 ? "s" : ""}`;
  const unit = unitPl(interval);

  const summary = t("job_payment.summary", {
    interval: String(interval), unit, count: String(periods),
  }) || `Paid every ${interval} ${unit} · ${periods} payment${periods !== 1 ? "s" : ""}`;

  const durationText = durationUnits && durationUnits > 0
    ? (t("job_payment.over", { duration: String(durationUnits), unit: unitPl(durationUnits) })
        || `over ${durationUnits} ${unitPl(durationUnits)}`)
    : null;

  const releaseNote = directRelease
    ? (t("job_payment.instant_release") || "Released instantly on each period")
    : (t("job_payment.approval_release") || "Employer approves each payment");

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
      fontSize: 12.5, color: "#9a9a9a", ...style,
    }}>
      <span style={{ fontWeight: 700, color: "#c9c9c9" }}>{t("job_payment.label") || "Payment"}:</span>
      <span>{summary}{durationText ? ` · ${durationText}` : ""}</span>
      <span style={{
        fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 9px",
        color: directRelease ? "#22c55e" : "#eab308",
        background: directRelease ? "rgba(34,197,94,0.12)" : "rgba(234,179,8,0.12)",
        border: `1px solid ${directRelease ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.3)"}`,
      }}>{releaseNote}</span>
    </div>
  );
}
