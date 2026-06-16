"use client";

import Footer from "@/components/layout/footer";
import { useState, useMemo } from "react";
import { WORKERS as ALL_WORKERS, JOBS as ALL_JOBS } from "@/lib/data";
import {
  UtensilsCrossed, Sparkles, Shield, Car, Zap, Wrench, Leaf,
  Camera, Package, Home, HardHat, Search, SlidersHorizontal,
  MapPin, Star, Briefcase, Users, X, ChevronDown,
  User, Building2,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
type Tab = "workers" | "jobs";
type SortWorker = "rating" | "jobs" | "name";
type SortJob = "amount_asc" | "amount_desc" | "newest";

// ── data ───────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { icon: UtensilsCrossed, label: "Waiters" },
  { icon: Sparkles,        label: "Cleaners" },
  { icon: Shield,          label: "Security" },
  { icon: Car,             label: "Drivers" },
  { icon: Zap,             label: "Electricians" },
  { icon: Wrench,          label: "Plumbers" },
  { icon: Leaf,            label: "Gardeners" },
  { icon: Camera,          label: "Photographers" },
  { icon: Package,         label: "Movers" },
  { icon: Home,            label: "Domestic Help" },
  { icon: HardHat,         label: "Construction" },
];

const LOCATIONS = ["Kacyiru", "Nyamirambo", "Kimihurura", "Remera", "Gisozi", "Kicukiro", "Gikondo", "Kanombe", "Kigali-wide"];

const WORKERS = ALL_WORKERS;
const JOBS    = ALL_JOBS;

const TYPE_ICON: Record<string, React.ElementType> = { individual: User, team: Users, company: Building2 };
const TYPE_COLOR: Record<string, string> = { individual: "#3b82f6", team: "#a855f7", company: "#f97316" };
const typeLabel = (w: typeof WORKERS[0]) =>
  w.type === "individual" ? "Individual"
  : w.type === "team" ? `Team · ${w.teamSize ?? 2}`
  : `Company · ${w.teamSize ?? 0}`;

// ── styles ─────────────────────────────────────────────────────────────────
const CSS = `
  * { box-sizing: border-box; }
  .browse-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  @media (min-width: 560px) {
    .browse-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 760px) {
    .browse-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .bcard { transition: border-color 0.15s; cursor: pointer; }
  .bcard:hover { border-color: #f97316 !important; }
  .chip { transition: background 0.12s, color 0.12s, border-color 0.12s; cursor: pointer; }
  .filter-panel {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  @media (min-width: 600px) {
    .filter-panel { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 760px) {
    .filter-panel { grid-template-columns: repeat(4, 1fr); }
  }
  select { appearance: none; -webkit-appearance: none; }
  ::-webkit-scrollbar { display: none; }
`;

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

// ── sub-components ─────────────────────────────────────────────────────────
function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)",
      borderRadius: 999, padding: "3px 10px 3px 12px", fontSize: 11, fontWeight: 600, color: "#f97316",
    }}>
      {label}
      <button onClick={onRemove} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", color: "#f97316" }}>
        <X size={11} />
      </button>
    </span>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: "100%", background: "#1c1c1c", border: "1px solid #2a2a2a",
            borderRadius: 10, padding: "9px 32px 9px 12px", fontSize: 13,
            color: value ? "#f0f0f0" : "#555", cursor: "pointer",
          }}
        >
          <option value="">All</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────
export default function BrowsePage() {
  const [tab, setTab] = useState<Tab>("workers");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // shared
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  // workers
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [filterMinRating, setFilterMinRating] = useState("");
  const [sortWorker, setSortWorker] = useState<SortWorker>("rating");

  // jobs
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [sortJob, setSortJob] = useState<SortJob>("newest");

  // active filter chips
  const activeFilters = [
    filterCategory  && { label: filterCategory,                  clear: () => setFilterCategory("") },
    filterLocation  && { label: filterLocation,                  clear: () => setFilterLocation("") },
    filterAvailable && tab === "workers" && { label: "Available now", clear: () => setFilterAvailable(false) },
    filterMinRating && tab === "workers" && { label: `★ ${filterMinRating}+`, clear: () => setFilterMinRating("") },
    filterMinAmount && tab === "jobs"    && { label: `Min RWF ${Number(filterMinAmount).toLocaleString()}`, clear: () => setFilterMinAmount("") },
    filterMaxAmount && tab === "jobs"    && { label: `Max RWF ${Number(filterMaxAmount).toLocaleString()}`, clear: () => setFilterMaxAmount("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => {
    setFilterCategory(""); setFilterLocation(""); setFilterAvailable(false);
    setFilterMinRating(""); setFilterMinAmount(""); setFilterMaxAmount("");
  };

  // filtered workers
  const filteredWorkers = useMemo(() => {
    let list = WORKERS.filter(w => {
      if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.category.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && w.category !== filterCategory) return false;
      if (filterLocation && w.location !== filterLocation) return false;
      if (filterAvailable && !w.available) return false;
      if (filterMinRating && w.rating < Number(filterMinRating)) return false;
      return true;
    });
    if (sortWorker === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    if (sortWorker === "jobs")   list = [...list].sort((a, b) => b.jobs - a.jobs);
    if (sortWorker === "name")   list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [search, filterCategory, filterLocation, filterAvailable, filterMinRating, sortWorker]);

  // filtered jobs
  const filteredJobs = useMemo(() => {
    let list = JOBS.filter(j => {
      if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !j.category.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && j.category !== filterCategory) return false;
      if (filterLocation && j.location !== filterLocation) return false;
      if (filterMinAmount && j.amount < Number(filterMinAmount)) return false;
      if (filterMaxAmount && j.amount > Number(filterMaxAmount)) return false;
      return true;
    });
    if (sortJob === "amount_asc")  list = [...list].sort((a, b) => a.amount - b.amount);
    if (sortJob === "amount_desc") list = [...list].sort((a, b) => b.amount - a.amount);
    if (sortJob === "newest")      list = [...list].sort((a, b) => a.posted - b.posted);
    return list;
  }, [search, filterCategory, filterLocation, filterMinAmount, filterMaxAmount, sortJob]);

  const S: React.CSSProperties = { fontFamily: "Inter, DM Sans, system-ui, sans-serif" };

  return (
    <main style={{ ...S, background: "#111", minHeight: "100vh", color: "#f5f5f5" }}>
      <style>{CSS}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 20px 64px" }}>

        {/* PAGE TITLE */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.8px" }}>Browse</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>Find verified workers or available jobs across Kigali.</p>
        </div>

        {/* TAB SWITCH */}
        <div style={{
          display: "inline-flex", background: "#1c1c1c", border: "1px solid #272727",
          borderRadius: 999, padding: 4, marginBottom: 24, gap: 4,
        }}>
          {([["workers", Users, "Workers"], ["jobs", Briefcase, "Jobs"]] as const).map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                borderRadius: 999, padding: "8px 18px", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700, transition: "all 0.15s",
                background: tab === key ? "#f97316" : "transparent",
                color: tab === key ? "#fff" : "#666",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* SEARCH + FILTER TOGGLE */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={15} color="#555" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder={tab === "workers" ? "Search workers or categories…" : "Search jobs or categories…"}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", background: "#1c1c1c", border: "1px solid #272727",
                borderRadius: 999, padding: "10px 14px 10px 38px",
                fontSize: 13, color: "#f0f0f0", outline: "none",
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: showFilters ? "#f97316" : "#1c1c1c",
              border: `1px solid ${showFilters ? "#f97316" : "#272727"}`,
              borderRadius: 999, padding: "10px 16px",
              fontSize: 13, fontWeight: 600, color: showFilters ? "#fff" : "#aaa",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            <SlidersHorizontal size={14} />
            Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
          </button>
        </div>

        {/* FILTER PANEL */}
        {showFilters && (
          <div style={{
            background: "#171717", border: "1px solid #272727", borderRadius: 14,
            padding: "20px", marginBottom: 16,
          }}>
            <div className="filter-panel">
              <SelectField label="Category" value={filterCategory} onChange={setFilterCategory}
                options={CATEGORIES.map(c => c.label)} />
              <SelectField label="Location" value={filterLocation} onChange={setFilterLocation}
                options={LOCATIONS} />

              {tab === "workers" && <>
                <SelectField label="Min rating" value={filterMinRating} onChange={setFilterMinRating}
                  options={["4.0", "4.5", "4.7", "4.9"]} />
                <SelectField label="Sort by" value={sortWorker} onChange={v => setSortWorker(v as SortWorker)}
                  options={["rating", "jobs", "name"]} />
              </>}

              {tab === "jobs" && <>
                <SelectField label="Min pay (RWF)" value={filterMinAmount} onChange={setFilterMinAmount}
                  options={["5000", "8000", "10000", "15000"]} />
                <SelectField label="Max pay (RWF)" value={filterMaxAmount} onChange={setFilterMaxAmount}
                  options={["10000", "15000", "20000", "30000"]} />
                <SelectField label="Sort by" value={sortJob} onChange={v => setSortJob(v as SortJob)}
                  options={["newest", "amount_asc", "amount_desc"]} />
              </>}
            </div>

            {tab === "workers" && (
              <div style={{ marginTop: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#aaa" }}>
                  <div
                    onClick={() => setFilterAvailable(a => !a)}
                    style={{
                      width: 36, height: 20, borderRadius: 999, position: "relative", cursor: "pointer",
                      background: filterAvailable ? "#f97316" : "#2a2a2a", transition: "background 0.2s",
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 2, left: filterAvailable ? 18 : 2,
                      width: 16, height: 16, borderRadius: 999, background: "#fff",
                      transition: "left 0.2s",
                    }} />
                  </div>
                  Available now only
                </label>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE FILTER CHIPS */}
        {activeFilters.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, alignItems: "center" }}>
            {activeFilters.map(f => (
              <ActiveChip key={f.label} label={f.label} onRemove={f.clear} />
            ))}
            <button onClick={clearAll} style={{
              background: "none", border: "none", fontSize: 11, color: "#555",
              cursor: "pointer", padding: "3px 8px", fontWeight: 600,
            }}>
              Clear all
            </button>
          </div>
        )}

        {/* RESULTS COUNT */}
        <p style={{ fontSize: 12, color: "#444", marginBottom: 14, fontWeight: 600 }}>
          {tab === "workers"
            ? `${filteredWorkers.length} worker${filteredWorkers.length !== 1 ? "s" : ""} found`
            : `${filteredJobs.length} job${filteredJobs.length !== 1 ? "s" : ""} found`}
        </p>

        {/* WORKERS GRID */}
        {tab === "workers" && (
          filteredWorkers.length === 0
            ? <Empty label="No workers match your filters." />
            : <div className="browse-grid">
                {filteredWorkers.map(w => {
                  const TIcon = TYPE_ICON[w.type] ?? User;
                  const tColor = TYPE_COLOR[w.type] ?? "#555";
                  return (
                    <a key={w.id} href={`/browse/${w.slug}`} className="bcard" style={{
                      textDecoration: "none",
                      background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
                      padding: "16px", display: "flex", flexDirection: "column", gap: 12,
                    }}>
                      {/* top row */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                            background: "rgba(249,115,22,0.12)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, fontWeight: 800, color: "#f97316",
                          }}>
                            {w.name[0]}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#f0f0f0" }}>{w.name}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#555", marginTop: 2 }}>{w.category}</p>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "3px 8px",
                          background: w.available ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                          color: w.available ? "#22c55e" : "#444",
                        }}>
                          {w.available ? "Available" : "Busy"}
                        </span>
                      </div>

                      {/* type badge */}
                      <span style={{
                        alignSelf: "flex-start",
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "3px 9px",
                        background: `${tColor}18`, border: `1px solid ${tColor}38`, color: tColor,
                      }}>
                        <TIcon size={10} />
                        {typeLabel(w)}
                      </span>

                      {/* location + rating */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <MapPin size={11} color="#555" />
                          <span style={{ fontSize: 11, color: "#555" }}>{w.location}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Star size={11} color="#f97316" fill="#f97316" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#f97316" }}>{w.rating}</span>
                          <span style={{ fontSize: 11, color: "#444" }}>· {w.jobs} jobs</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
        )}

        {/* JOBS GRID */}
        {tab === "jobs" && (
          filteredJobs.length === 0
            ? <Empty label="No jobs match your filters." />
            : <div className="browse-grid">
                {filteredJobs.map(j => (
                  <a key={j.id} href={`/jobs/${j.id}`} className="bcard" style={{
                    display: "flex", flexDirection: "column", gap: 12,
                    background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
                    padding: "16px", textDecoration: "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#f0f0f0", lineHeight: 1.3 }}>{j.title}</p>
                      <span style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "3px 8px", flexShrink: 0,
                        background: "rgba(249,115,22,0.1)", color: "#f97316",
                      }}>
                        {j.category}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <MapPin size={11} color="#555" />
                      <span style={{ fontSize: 11, color: "#555" }}>{j.location}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#f97316" }}>
                        {fmt(j.amount)}
                        <span style={{ fontSize: 11, fontWeight: 500, color: "#555" }}> / {j.period}</span>
                      </span>
                      <span style={{ fontSize: 11, color: "#444" }}>
                        {j.posted === 1 ? "Today" : `${j.posted}d ago`}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
        )}

      </div>

      <Footer />
    </main>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
      <p style={{ fontSize: 32, margin: "0 0 12px" }}>🔍</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#333" }}>Try adjusting your filters or search term.</p>
    </div>
  );
}