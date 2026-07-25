"use client";

import { ChevronDown, X, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoProvinces, geoDistricts, geoSectors } from "@/lib/rwanda-geo";
import { COUNTRIES } from "@/lib/countries";

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

/**
 * A search-as-you-type version of {@link SelectField} - same props, so it drops in
 * anywhere a SelectField is used. The trigger shows the current pick; opening it reveals
 * a text box that filters the options as you type, plus a keyboard-navigable list.
 *
 * Meant for the long lists (categories, every province/district/sector in the country)
 * where a native <select> forces you to scroll or hunt. Short enums are better as a plain
 * SelectField, so this is applied selectively.
 */
export function ComboField({ label, value, onChange, options, labels, allLabel = "All", disabled, hideAll, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: string[];
  allLabel?: string;
  disabled?: boolean;
  hideAll?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // {value,label} pairs, with the leading "All" entry unless hidden.
  const items = useMemo(() => {
    const base = options.map((o, i) => ({ value: o, label: labels ? labels[i] : o }));
    return hideAll ? base : [{ value: "", label: allLabel }, ...base];
  }, [options, labels, allLabel, hideAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => it.label.toLowerCase().includes(q));
  }, [items, query]);

  const current = items.find(it => it.value === value);
  const shownLabel = current ? current.label : (hideAll ? "" : allLabel);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // When opening, clear the query and focus the search box.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const pick = (v: string) => { onChange(v); setOpen(false); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) pick(filtered[active].value); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <div ref={wrapRef} style={{ position: "relative" }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(o => !o)}
          style={{
            width: "100%", textAlign: "left", background: "#1c1c1c", border: "1px solid #2a2a2a",
            borderRadius: 10, padding: "9px 32px 9px 12px", fontSize: 13,
            color: value ? "#f0f0f0" : "#555",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1, outline: "none",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {shownLabel || " "}
        </button>
        <ChevronDown size={13} color="#555" style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none",
        }} />

        {open && (
          <div style={{
            position: "absolute", zIndex: 40, top: "calc(100% + 4px)", left: 0, right: 0,
            background: "#161616", border: "1px solid #2a2a2a", borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.55)", overflow: "hidden",
          }}>
            <div style={{ position: "relative", padding: 8, borderBottom: "1px solid #242424" }}>
              <Search size={13} color="#555" style={{
                position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none",
              }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onKey}
                placeholder={placeholder || "Type to search…"}
                style={{
                  width: "100%", background: "#1c1c1c", border: "1px solid #2a2a2a",
                  borderRadius: 8, padding: "7px 10px 7px 30px", fontSize: 13, color: "#f0f0f0", outline: "none",
                }}
              />
            </div>
            <div role="listbox" style={{ maxHeight: 240, overflowY: "auto", padding: 4 }}>
              {filtered.length === 0 && (
                <div style={{ padding: "10px 12px", fontSize: 12, color: "#666" }}>No matches</div>
              )}
              {filtered.map((it, i) => (
                <div
                  key={it.value || "__all__"}
                  role="option"
                  aria-selected={it.value === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(it.value)}
                  style={{
                    padding: "8px 10px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                    color: it.value === value ? "#f97316" : "#e6e6e6",
                    fontWeight: it.value === value ? 700 : 400,
                    background: i === active ? "rgba(249,115,22,0.12)" : "transparent",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}
                >
                  {it.label}
                </div>
              ))}
            </div>
          </div>
        )}
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
  country: string;
  province: string;
  district: string;
  sector: string;
}

export const EMPTY_AREA: AreaValue = { country: "", province: "", district: "", sector: "" };

export function areaIsSet(a: AreaValue): boolean {
  // A country of "Rwanda" alone is not a real narrowing (it's the default place), so it doesn't
  // count as a set filter on its own; any other country, or any Rwanda sub-level, does.
  return Boolean((a.country && a.country !== "Rwanda") || a.province || a.district || a.sector);
}

/** The narrowest level set, for a filter chip: "Kanombe" beats "Kicukiro" beats "Kigali". */
export function areaLabel(a: AreaValue): string {
  return a.sector || a.district || a.province || (a.country && a.country !== "Rwanda" ? a.country : "") || "";
}

/**
 * Province → District → Sector, from the bundled Rwanda administrative dataset.
 *
 * Both browse pages previously offered a hardcoded list of eight Kigali neighbourhood names
 * and compared the pick against the district field. Only one of those names is actually a
 * district, so the rest could never match a single row. Reading the real hierarchy means
 * every area in the country is selectable and the value matches what postings store.
 */
export function AreaFilter({ value, onChange, labels, showCountry }: {
  value: AreaValue;
  onChange: (v: AreaValue) => void;
  labels?: { country?: string; province?: string; district?: string; sector?: string };
  /** Show a searchable country picker. Rwanda keeps its province/district/sector cascade; any
   *  other country hides them (there is no sub-country dataset outside Rwanda). */
  showCountry?: boolean;
}) {
  const provinces = geoProvinces();
  const districts = value.province ? geoDistricts(value.province) : [];
  const sectors   = value.district ? geoSectors(value.province, value.district) : [];
  const isRwanda  = !value.country || value.country === "Rwanda";

  return (
    <>
      {showCountry && (
        <ComboField
          label={labels?.country ?? "Country"}
          value={value.country}
          allLabel="All countries"
          // Switching country clears the Rwanda cascade below.
          onChange={v => onChange({ country: v, province: "", district: "", sector: "" })}
          options={COUNTRIES}
        />
      )}
      {isRwanda && <>
      <ComboField
        label={labels?.province ?? "Province"}
        value={value.province}
        // Narrowing the province invalidates the district and sector below it.
        onChange={v => onChange({ ...value, province: v, district: "", sector: "" })}
        options={provinces}
      />
      <ComboField
        label={labels?.district ?? "District"}
        value={value.district}
        onChange={v => onChange({ ...value, district: v, sector: "" })}
        options={districts}
        disabled={!value.province}
      />
      <ComboField
        label={labels?.sector ?? "Sector"}
        value={value.sector}
        onChange={v => onChange({ ...value, sector: v })}
        options={sectors}
        disabled={!value.district}
      />
      </>}
    </>
  );
}
