"use client";

import { useMemo } from "react";
import { geoProvinces, geoDistricts, geoSectors, geoCells, geoVillages } from "@/lib/rwanda-geo";
import type { Address } from "@/lib/api";

/**
 * Structured address input. For Rwanda it renders cascading dropdowns
 * (Province → District → Sector → Cell → Village) sourced from the `rwanda`
 * dataset; each level only lists options valid for the parent selection.
 * For any other country it renders universal free-text fields.
 *
 * No maps or GPS — location is captured purely as structured data.
 */

// Common countries first, then the rest alphabetically.
const COUNTRIES = [
  "Rwanda",
  "Burundi", "DR Congo", "Kenya", "Tanzania", "Uganda",
  "Belgium", "Canada", "China", "Ethiopia", "France", "Germany", "Ghana",
  "India", "Italy", "Kuwait", "Netherlands", "Nigeria", "Qatar",
  "Saudi Arabia", "South Africa", "South Sudan", "Sweden", "Switzerland",
  "Turkey", "Uganda", "United Arab Emirates", "United Kingdom",
  "United States", "Zambia", "Zimbabwe", "Other",
];

const SELECT_CLASS =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const LABEL_CLASS =
  "block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide";

interface Props {
  value: Address | null | undefined;
  onChange: (address: Address) => void;
}

/** Build the human-readable one-line label stored alongside the parts. */
export function formatAddress(a: Address): string {
  const parts =
    a.country === "Rwanda"
      ? [a.village, a.cell, a.sector, a.district, a.province, "Rwanda"]
      : [a.street, a.city, a.state, a.country];
  return parts.filter(Boolean).join(", ");
}

export function AddressPicker({ value, onChange }: Props) {
  const a: Address = value ?? { country: "Rwanda" };
  const isRwanda = a.country === "Rwanda";

  const provinces = useMemo(() => geoProvinces(), []);
  const districts = useMemo(() => geoDistricts(a.province), [a.province]);
  const sectors = useMemo(
    () => geoSectors(a.province, a.district),
    [a.province, a.district]
  );
  const cells = useMemo(
    () => geoCells(a.province, a.district, a.sector),
    [a.province, a.district, a.sector]
  );
  const villages = useMemo(
    () => geoVillages(a.province, a.district, a.sector, a.cell),
    [a.province, a.district, a.sector, a.cell]
  );

  /** Apply a patch, clear now-invalid children, then recompute the label. */
  const update = (patch: Partial<Address>) => {
    const next: Address = { ...a, ...patch };
    next.label = formatAddress(next);
    onChange(next);
  };

  const onCountry = (country: string) => {
    // Reset everything when the country changes.
    onChange({ country, label: country });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={LABEL_CLASS}>Country</label>
        <select
          className={SELECT_CLASS}
          value={a.country}
          onChange={(e) => onCountry(e.target.value)}
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {isRwanda ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Province</label>
            <select
              className={SELECT_CLASS}
              value={a.province ?? ""}
              onChange={(e) =>
                update({ province: e.target.value, district: "", sector: "", cell: "", village: "" })
              }
            >
              <option value="">Select province…</option>
              {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>District</label>
            <select
              className={SELECT_CLASS}
              value={a.district ?? ""}
              disabled={!a.province}
              onChange={(e) =>
                update({ district: e.target.value, sector: "", cell: "", village: "" })
              }
            >
              <option value="">Select district…</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Sector</label>
            <select
              className={SELECT_CLASS}
              value={a.sector ?? ""}
              disabled={!a.district}
              onChange={(e) => update({ sector: e.target.value, cell: "", village: "" })}
            >
              <option value="">Select sector…</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Cell</label>
            <select
              className={SELECT_CLASS}
              value={a.cell ?? ""}
              disabled={!a.sector}
              onChange={(e) => update({ cell: e.target.value, village: "" })}
            >
              <option value="">Select cell…</option>
              {cells.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>Village</label>
            <select
              className={SELECT_CLASS}
              value={a.village ?? ""}
              disabled={!a.cell}
              onChange={(e) => update({ village: e.target.value })}
            >
              <option value="">Select village…</option>
              {villages.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLASS}>State / Region / Province</label>
            <input
              type="text"
              className={SELECT_CLASS}
              placeholder="e.g. California"
              value={a.state ?? ""}
              onChange={(e) => update({ state: e.target.value })}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>City / Town</label>
            <input
              type="text"
              className={SELECT_CLASS}
              placeholder="e.g. Los Angeles"
              value={a.city ?? ""}
              onChange={(e) => update({ city: e.target.value })}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Street / Area</label>
            <input
              type="text"
              className={SELECT_CLASS}
              placeholder="Street address or neighbourhood"
              value={a.street ?? ""}
              onChange={(e) => update({ street: e.target.value })}
            />
          </div>
        </div>
      )}

      {a.label && (
        <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
          <span className="text-[#f97316]">📍</span>
          <span>{a.label}</span>
        </p>
      )}
    </div>
  );
}

/** True when the address has enough detail to be considered complete. */
export function isAddressComplete(a: Address | null | undefined): boolean {
  if (!a || !a.country) return false;
  if (a.country === "Rwanda") {
    return Boolean(a.province && a.district && a.sector && a.cell && a.village);
  }
  return Boolean(a.state || a.city || a.street);
}
