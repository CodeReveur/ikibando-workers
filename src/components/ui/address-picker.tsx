"use client";

import { useMemo } from "react";
import { geoProvinces, geoDistricts, geoSectors, geoCells, geoVillages } from "@/lib/rwanda-geo";
import { COUNTRIES } from "@/lib/countries";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Address } from "@/lib/api";

/**
 * Structured address input. For Rwanda it renders cascading, search-as-you-type dropdowns
 * (Province → District → Sector → Cell → Village) sourced from the `rwanda` dataset; each level
 * only lists options valid for the parent selection. For any other country it renders universal
 * free-text fields. The country picker lists every country in the world (searchable).
 *
 * No maps or GPS - location is captured purely as structured data.
 */

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
        <SearchableSelect
          ariaLabel="Country"
          value={a.country}
          options={COUNTRIES}
          placeholder="Select country…"
          onChange={onCountry}
        />
      </div>

      {isRwanda ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Province</label>
            <SearchableSelect
              ariaLabel="Province"
              value={a.province ?? ""}
              options={provinces}
              placeholder="Select province…"
              onChange={(v) => update({ province: v, district: "", sector: "", cell: "", village: "" })}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>District</label>
            <SearchableSelect
              ariaLabel="District"
              value={a.district ?? ""}
              options={districts}
              disabled={!a.province}
              placeholder="Select district…"
              onChange={(v) => update({ district: v, sector: "", cell: "", village: "" })}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Sector</label>
            <SearchableSelect
              ariaLabel="Sector"
              value={a.sector ?? ""}
              options={sectors}
              disabled={!a.district}
              placeholder="Select sector…"
              onChange={(v) => update({ sector: v, cell: "", village: "" })}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Cell</label>
            <SearchableSelect
              ariaLabel="Cell"
              value={a.cell ?? ""}
              options={cells}
              disabled={!a.sector}
              placeholder="Select cell…"
              onChange={(v) => update({ cell: v, village: "" })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>Village</label>
            <SearchableSelect
              ariaLabel="Village"
              value={a.village ?? ""}
              options={villages}
              disabled={!a.cell}
              placeholder="Select village…"
              onChange={(v) => update({ village: v })}
            />
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
