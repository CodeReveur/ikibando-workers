"use client";

import Footer from "@/components/layout/footer";
import { useState, useMemo, useEffect } from "react";
import { getWorkers, getJobs, daysAgo, type WorkerProfileDto, type JobDto } from "@/lib/api";
import {
  UtensilsCrossed, Sparkles, Shield, Car, Zap, Wrench, Leaf,
  Camera, Package, Home, HardHat, Search, SlidersHorizontal,
  MapPin, Briefcase, Users, X, ChevronDown,
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
  const [workers, setWorkers] = useState<WorkerProfileDto[]>([]);
  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // shared
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  // workers
  const [sortWorker, setSortWorker] = useState<SortWorker>("name");

  // jobs
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [sortJob, setSortJob] = useState<SortJob>("newest");

  useEffect(() => {
    Promise.all([
      getWorkers({ size: 100 }).then(p => setWorkers(p.content)),
      getJobs({ size: 100 }).then(p => setJobs(p.content)),
    ]).catch(() => {}).finally(() => setLoadingData(false));
  }, []);

  // active filter chips
  const activeFilters = [
    filterCategory  && { label: filterCategory,  clear: () => setFilterCategory("") },
    filterLocation  && { label: filterLocation,  clear: () => setFilterLocation("") },
    filterMinAmount && tab === "jobs" && { label: `Min RWF ${Number(filterMinAmount).toLocaleString()}`, clear: () => setFilterMinAmount("") },
    filterMaxAmount && tab === "jobs" && { label: `Max RWF ${Number(filterMaxAmount).toLocaleString()}`, clear: () => setFilterMaxAmount("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => {
    setFilterCategory(""); setFilterLocation(""); setFilterMinAmount(""); setFilterMaxAmount("");
  };

  // filtered workers
  const filteredWorkers = useMemo(() => {
    let list = workers.filter((w: WorkerProfileDto) => {
      if (search && !w.name.toLowerCase().includes(search.toLowerCase())
        && !(w.experienceType ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && (w.experienceType ?? "").toLowerCase() !== filterCategory.toLowerCase()) return false;
      if (filterLocation && (w.district ?? "").toLowerCase() !== filterLocation.toLowerCase()) return false;
      return true;
    });
    if (sortWorker === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [workers, search, filterCategory, filterLocation, sortWorker]);

  // filtered jobs
  const filteredJobs = useMemo(() => {
    let list = jobs.filter((j: JobDto) => {
      if (search && !j.title.toLowerCase().includes(search.toLowerCase())
        && !j.category.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && j.category.toLowerCase() !== filterCategory.toLowerCase()) return false;
      if (filterLocation && j.district.toLowerCase() !== filterLocation.toLowerCase()) return false;
      if (filterMinAmount && j.ratePerHour < Number(filterMinAmount)) return false;
      if (filterMaxAmount && j.ratePerHour > Number(filterMaxAmount)) return false;
      return true;
    });
    if (sortJob === "amount_asc")  list = [...list].sort((a, b) => a.ratePerHour - b.ratePerHour);
    if (sortJob === "amount_desc") list = [...list].sort((a, b) => b.ratePerHour - a.ratePerHour);
    if (sortJob === "newest")      list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [jobs, search, filterCategory, filterLocation, filterMinAmount, filterMaxAmount, sortJob]);

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

              {tab === "workers" && (
                <SelectField label="Sort by" value={sortWorker} onChange={v => setSortWorker(v as SortWorker)}
                  options={["name"]} />
              )}

              {tab === "jobs" && <>
                <SelectField label="Min pay (RWF)" value={filterMinAmount} onChange={setFilterMinAmount}
                  options={["5000", "8000", "10000", "15000"]} />
                <SelectField label="Max pay (RWF)" value={filterMaxAmount} onChange={setFilterMaxAmount}
                  options={["10000", "15000", "20000", "30000"]} />
                <SelectField label="Sort by" value={sortJob} onChange={v => setSortJob(v as SortJob)}
                  options={["newest", "amount_asc", "amount_desc"]} />
              </>}
            </div>

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
          {loadingData ? "Loading…"
            : tab === "workers"
            ? `${filteredWorkers.length} worker${filteredWorkers.length !== 1 ? "s" : ""} found`
            : `${filteredJobs.length} job${filteredJobs.length !== 1 ? "s" : ""} found`}
        </p>

        {/* WORKERS GRID */}
        {tab === "workers" && (
          loadingData ? <BrowseLoading />
          : filteredWorkers.length === 0
            ? <Empty label="No workers match your filters." />
            : <div className="browse-grid">
                {filteredWorkers.map((w: WorkerProfileDto) => (
                  <a key={w.id} href={`/browse/${w.id}`} className="bcard" style={{
                    background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
                    padding: "16px", display: "flex", flexDirection: "column", gap: 12,
                    textDecoration: "none",
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
                          <p style={{ margin: 0, fontSize: 11, color: "#555", marginTop: 2 }}>{w.experienceType ?? "Worker"}</p>
                        </div>
                      </div>
                      {w.availability.length > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "3px 8px",
                          background: "rgba(34,197,94,0.1)", color: "#22c55e",
                        }}>
                          Available
                        </span>
                      )}
                    </div>

                    {/* location */}
                    {w.district && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <MapPin size={11} color="#555" />
                        <span style={{ fontSize: 11, color: "#555" }}>{w.district}</span>
                      </div>
                    )}

                    {/* equipment tags */}
                    {w.equipment.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {w.equipment.slice(0, 3).map(eq => (
                          <span key={eq} style={{
                            fontSize: 9, fontWeight: 600, borderRadius: 999, padding: "2px 7px",
                            background: "rgba(249,115,22,0.07)", color: "#f97316",
                          }}>{eq}</span>
                        ))}
                        {w.equipment.length > 3 && (
                          <span style={{ fontSize: 9, color: "#555" }}>+{w.equipment.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </a>
                ))}
              </div>
        )}

        {/* JOBS GRID */}
        {tab === "jobs" && (
          loadingData ? <BrowseLoading />
          : filteredJobs.length === 0
            ? <Empty label="No jobs match your filters." />
            : <div className="browse-grid">
                {filteredJobs.map((j: JobDto) => {
                  const posted = daysAgo(j.createdAt);
                  return (
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
                        <span style={{ fontSize: 11, color: "#555" }}>{j.district}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#f97316" }}>
                          {fmt(j.ratePerHour)}
                          <span style={{ fontSize: 11, fontWeight: 500, color: "#555" }}> / hr</span>
                        </span>
                        <span style={{ fontSize: 11, color: "#444" }}>
                          {posted === 0 ? "Today" : `${posted}d ago`}
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
        )}

      </div>

      <Footer />
    </main>
  );
}

function BrowseLoading() {
  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div className="browse-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
            padding: 16, height: 140, animation: "pulse 1.5s ease-in-out infinite",
          }} />
        ))}
      </div>
    </>
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