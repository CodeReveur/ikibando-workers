import { Provinces, Districts, Sectors, Cells, Villages } from "rwanda";

/**
 * Resilient wrapper around the `rwanda` admin-division dataset.
 *
 * The raw package is case- and whitespace-sensitive: `Sectors({ district: "kicukiro" })` or a value
 * with a stray trailing space returns nothing, which is why the Sector/Cell/Village dropdowns
 * sometimes came up empty (values from drafts, edited jobs, or the "City of Kigali" label didn't
 * match the package's canonical spelling). These helpers map each level back to the dataset's exact
 * name (case-insensitive, trimmed) before looking up the next level, and never throw.
 */

// Accept both the app's display labels ("City of Kigali") and the package's own province names.
const PROVINCE_ALIASES: Record<string, string> = {
  "city of kigali": "Kigali", "kigali city": "Kigali", "kigali": "Kigali",
  "northern province": "North", "north": "North",
  "southern province": "South", "south": "South",
  "eastern province": "East", "east": "East",
  "western province": "West", "west": "West",
};

function safe<T>(fn: () => T[] | undefined | null): T[] {
  try { return fn() ?? []; } catch { return []; }
}

/** The exact dataset entry matching `value` case-insensitively, or "" if none. */
function canon(list: string[], value?: string | null): string {
  if (!value) return "";
  const t = value.trim().toLowerCase();
  return list.find(x => x.trim().toLowerCase() === t) ?? "";
}

export function geoProvinces(): string[] {
  return safe(() => Provinces());
}

/** Resolve any province label/name to the package's canonical province ("Kigali", "North", …). */
export function pkgProvince(province?: string | null): string {
  if (!province) return "";
  const key = province.trim().toLowerCase();
  if (PROVINCE_ALIASES[key]) return PROVINCE_ALIASES[key];
  return canon(geoProvinces(), province);
}

export function geoDistricts(province?: string | null): string[] {
  const p = pkgProvince(province);
  if (!p) return [];
  return safe(() => Districts({ provinces: p }));
}

export function geoSectors(province?: string | null, district?: string | null): string[] {
  const p = pkgProvince(province);
  const d = canon(geoDistricts(province), district);
  if (!p || !d) return [];
  // The package's Sectors() is buggy: it returns every sector of the whole PROVINCE, not just the
  // district's (it iterates all districts). That polluted the dropdown with sectors from other
  // districts, and picking one left Cells/Villages empty. Cells() is correct, so a sector truly
  // belongs to this district iff it has cells here - filter on that (and dedupe).
  const all = safe(() => Sectors({ province: p, district: d }));
  const belongs = all.filter(s => safe(() => Cells({ province: p, district: d, sector: s })).length > 0);
  return [...new Set(belongs)];
}

export function geoCells(province?: string | null, district?: string | null, sector?: string | null): string[] {
  const p = pkgProvince(province);
  const d = canon(geoDistricts(province), district);
  const s = canon(geoSectors(province, district), sector);
  if (!p || !d || !s) return [];
  return safe(() => Cells({ province: p, district: d, sector: s }));
}

export function geoVillages(
  province?: string | null, district?: string | null, sector?: string | null, cell?: string | null,
): string[] {
  const p = pkgProvince(province);
  const d = canon(geoDistricts(province), district);
  const s = canon(geoSectors(province, district), sector);
  const c = canon(geoCells(province, district, sector), cell);
  if (!p || !d || !s || !c) return [];
  return safe(() => Villages({ province: p, district: d, sector: s, cell: c }));
}
