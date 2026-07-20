"use client";

import { ChevronDown, X } from "lucide-react";
import { geoProvinces, geoDistricts, geoSectors } from "@/lib/rwanda-geo";

/**
 * The filter controls shared by /jobs and /browse. Both pages previously carried their own
 * copies of these, and their own hardcoded location list.
 */

// ── primitives ─────────────────────────────────────────────────────────────

export function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)",
      borderRadius: 999, padding: "3px 10px 3px 12px", fontSize: 11, fontWeight: 600, color: "#f97316",
    }}>
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label}`} style={{
        background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", color: "#f97316",
      }}>
        <X size={11} />
      </button>
    </span>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      fontSize: 11, fontWeight: 700, color: "#666",
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      {children}
    </label>
  );
}

export function SelectField({ label, value, onChange, options, labels, allLabel = "All", disabled, hideAll }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: string[];
  allLabel?: string;
  disabled?: boolean;
  /** Drop the leading "All" entry. For fields like sort, where one option is always in force
   *  and an empty entry would just repeat whichever option is the default. */
  hideAll?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          style={{
            width: "100%", background: "#1c1c1c", border: "1px solid #2a2a2a",
            borderRadius: 10, padding: "9px 32px 9px 12px", fontSize: 13,
            color: value ? "#f0f0f0" : "#555",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1, outline: "none",
          }}
        >
          {!hideAll && <option value="">{allLabel}</option>}
          {options.map((o, i) => <option key={o} value={o}>{labels ? labels[i] : o}</option>)}
        </select>
        <ChevronDown size={13} color="#555" style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}

/** A free-typed numeric bound, for ranges where fixed brackets are too coarse. */
export function NumberField({ label, value, onChange, placeholder, min = 0, step = 1000 }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  step?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", background: "#1c1c1c", border: "1px solid #2a2a2a",
          borderRadius: 10, padding: "9px 12px", fontSize: 13,
          color: value ? "#f0f0f0" : "#555", outline: "none",
        }}
      />
    </div>
  );
}

export function ToggleField({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <div
        role="switch"
        aria-checked={value}
        aria-label={label}
        tabIndex={0}
        onClick={() => onChange(!value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(!value); } }}
        style={{
          width: 36, height: 20, borderRadius: 999, position: "relative", cursor: "pointer",
          background: value ? "#f97316" : "#2a2a2a", transition: "background 0.2s", marginTop: 6,
        }}
      >
        <div style={{
          position: "absolute", top: 2, left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: 999, background: "#fff", transition: "left 0.2s",
        }} />
      </div>
    </div>
  );
}

// ── location ───────────────────────────────────────────────────────────────

export interface AreaValue {
  province: string;
  district: string;
  sector: string;
}

export const EMPTY_AREA: AreaValue = { province: "", district: "", sector: "" };

export function areaIsSet(a: AreaValue): boolean {
  return Boolean(a.province || a.district || a.sector);
}

/** The narrowest level set, for a filter chip: "Kanombe" beats "Kicukiro" beats "Kigali". */
export function areaLabel(a: AreaValue): string {
  return a.sector || a.district || a.province || "";
}

/**
 * Province → District → Sector, from the bundled Rwanda administrative dataset.
 *
 * Both browse pages previously offered a hardcoded list of eight Kigali neighbourhood names
 * and compared the pick against the district field. Only one of those names is actually a
 * district, so the rest could never match a single row. Reading the real hierarchy means
 * every area in the country is selectable and the value matches what postings store.
 */
export function AreaFilter({ value, onChange, labels }: {
  value: AreaValue;
  onChange: (v: AreaValue) => void;
  labels?: { province?: string; district?: string; sector?: string };
}) {
  const provinces = geoProvinces();
  const districts = value.province ? geoDistricts(value.province) : [];
  const sectors   = value.district ? geoSectors(value.province, value.district) : [];

  return (
    <>
      <SelectField
        label={labels?.province ?? "Province"}
        value={value.province}
        // Narrowing the province invalidates the district and sector below it.
        onChange={v => onChange({ province: v, district: "", sector: "" })}
        options={provinces}
      />
      <SelectField
        label={labels?.district ?? "District"}
        value={value.district}
        onChange={v => onChange({ ...value, district: v, sector: "" })}
        options={districts}
        disabled={!value.province}
      />
      <SelectField
        label={labels?.sector ?? "Sector"}
        value={value.sector}
        onChange={v => onChange({ ...value, sector: v })}
        options={sectors}
        disabled={!value.district}
      />
    </>
  );
}
