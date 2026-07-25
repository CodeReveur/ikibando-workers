/**
 * The pay unit for a job. `ratePerHour` and `durationHours` are historically-named counts that are
 * actually expressed in the job's rate unit - a daily job stores the number of DAYS in
 * `durationHours` and the price per DAY in `ratePerHour`. Deriving the label from `rateType`
 * (falling back to `paymentMode`) is what keeps "7 days" from rendering as "7 hrs".
 */
const BY_RATE_TYPE: Record<string, { short: string; long: string }> = {
  PER_HOUR:  { short: "hr",  long: "hour"  },
  PER_DAY:   { short: "day", long: "day"   },
  PER_WEEK:  { short: "wk",  long: "week"  },
  PER_MONTH: { short: "mo",  long: "month" },
  PER_YEAR:  { short: "yr",  long: "year"  },
};

const MODE_TO_RATE_TYPE: Record<string, string> = {
  HOURLY: "PER_HOUR", CUSTOM_HOURS: "PER_HOUR",
  DAILY: "PER_DAY",   CUSTOM_DAYS: "PER_DAY",
  WEEKLY: "PER_WEEK",
  MONTHLY: "PER_MONTH", CUSTOM_MONTHS: "PER_MONTH",
  YEARLY: "PER_YEAR",
};

export interface RateUnit { short: string; long: string; }

/** Resolve a job's pay unit from its rateType, falling back to paymentMode, then hours. */
export function rateUnit(job: { rateType?: string | null; paymentMode?: string | null }): RateUnit {
  const rt = job.rateType || MODE_TO_RATE_TYPE[job.paymentMode || ""] || "PER_HOUR";
  return BY_RATE_TYPE[rt] || BY_RATE_TYPE.PER_HOUR;
}

/** "7 days" / "1 hour" - count plus the correctly-pluralised long unit. */
export function durationLabel(job: { durationHours?: number | null; rateType?: string | null; paymentMode?: string | null }): string {
  const n = job.durationHours && job.durationHours > 0 ? job.durationHours : 1;
  const u = rateUnit(job).long;
  return `${n} ${u}${n !== 1 ? "s" : ""}`;
}
