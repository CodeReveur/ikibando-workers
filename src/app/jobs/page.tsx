"use client";

import { useState, useCallback } from "react";
import Footer from "@/components/layout/footer";
import { PostJobModal } from "@/components/jobs/post-job-modal";
import { getJobs, daysAgo, workerNetHourly, type JobDto, type JobSearchParams } from "@/lib/api";
import { rateUnit } from "@/lib/rate-unit";
import { usePagedResults } from "@/lib/use-paged-results";
import { CATEGORIES, categoryParam, keyForSlug } from "@/lib/browse-taxonomy";
import {
  ActiveChip, ComboField, NumberField, ToggleField,
  AreaFilter, EMPTY_AREA, areaIsSet, areaLabel, type AreaValue,
} from "@/components/browse/filter-controls";
import { useLanguage } from "@/lib/language-context";
import {
  MapPin, Briefcase, Search, SlidersHorizontal, Clock, Plus, ArrowRight,
} from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/json-ld";

type SortKey = NonNullable<JobSearchParams["sort"]>;

const SORTS: SortKey[] = [
  "newest", "oldest", "rate_desc", "rate_asc", "duration_asc", "duration_desc", "starting_soon",
];
const URGENCIES = ["IMMEDIATE", "SAME_DAY", "SCHEDULED"] as const;
const RATE_TYPES = ["PER_HOUR", "PER_DAY", "PER_WEEK", "PER_MONTH", "PER_YEAR"] as const;
const POSTED_WITHIN = ["1", "3", "7", "14", "30"];

const PAGE_SIZE = 24;

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;
const postedLabel = (d: number) => d === 0 ? "Today" : `${d}d ago`;

const CSS = `
  * { box-sizing: border-box; }
  /* Column count follows the CONTAINER width (container queries):
     4 large/mid → 3 mini-mid → 2 mobile → 1 watch. */
  .jobs-wrap { container-type: inline-size; }
  .jobs-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  @container (min-width: 340px) { .jobs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @container (min-width: 520px) { .jobs-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @container (min-width: 680px) { .jobs-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .jcard { transition: border-color 0.15s; cursor: pointer; text-decoration: none; }
  .jcard:hover { border-color: #f97316 !important; }
  .cat-chip { transition: background 0.12s, color 0.12s, border-color 0.12s; }
  .cat-chip:hover { border-color: #f97316 !important; color: #f97316 !important; }
  select { appearance: none; -webkit-appearance: none; }
  ::-webkit-scrollbar { display: none; }
  input::placeholder { color: #444; }
`;

export default function JobsPage() {
  const { t } = useLanguage();
  const [search, setSearch]             = useState("");
  const [filterCategory, setFilterCat]  = useState("");
  const [area, setArea]                 = useState<AreaValue>(EMPTY_AREA);
  const [filterUrgency, setUrgency]     = useState("");
  const [filterRateType, setRateType]   = useState("");
  const [filterMinAmt, setFilterMinAmt] = useState("");
  const [filterMaxAmt, setFilterMaxAmt] = useState("");
  const [filterMinHours, setMinHours]   = useState("");
  const [filterMaxHours, setMaxHours]   = useState("");
  const [filterPosted, setFilterPosted] = useState("");
  const [filterTeam, setFilterTeam]     = useState(false);   // jobs hiring more than one worker
  const [filterOpenOnly, setOpenOnly]   = useState(false);
  const [sort, setSort]                 = useState<SortKey>("newest");
  const [showFilters, setShowFilters]   = useState(false);
  const [showPostJob, setShowPostJob]   = useState(false);

  // Every filter goes to the server, so results are drawn from the whole catalogue rather
  // than from one preloaded slab of rows.
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const fetchPage = useCallback(
    (page: number) => getJobs({
      page, size: PAGE_SIZE,
      q: search.trim() || undefined,
      category: categoryParam(filterCategory),
      province: area.province || undefined,
      district: area.district || undefined,
      sector: area.sector || undefined,
      urgency: (filterUrgency || undefined) as JobSearchParams["urgency"],
      rateType: (filterRateType || undefined) as JobSearchParams["rateType"],
      minRate: num(filterMinAmt),
      maxRate: num(filterMaxAmt),
      minDuration: num(filterMinHours),
      maxDuration: num(filterMaxHours),
      postedWithinDays: num(filterPosted),
      minHeadcount: filterTeam ? 2 : undefined,
      openOnly: filterOpenOnly,
      sort,
    }),
    [search, filterCategory, area, filterUrgency, filterRateType, filterMinAmt, filterMaxAmt,
     filterMinHours, filterMaxHours, filterPosted, filterTeam, filterOpenOnly, sort],
  );

  const { items: jobs, total, loading: loadingJobs, loadingMore, hasMore, sentinelRef } =
    usePagedResults<JobDto>(fetchPage, [
      search, filterCategory, area.province, area.district, area.sector, filterUrgency,
      filterRateType, filterMinAmt, filterMaxAmt, filterMinHours, filterMaxHours,
      filterPosted, filterTeam, filterOpenOnly, sort,
    ]);

  // A single day reads as "Last 24 hours" rather than "Last 1 days".
  const postedWithinLabel = (d: string) => d === "1"
    ? (t("jobs_page.filters.posted_24h") || "Last 24 hours")
    : (t("jobs_page.filters.posted_days", { count: Number(d) }) || `Last ${d} days`);

  const urgencyLabel = (u: string) => t("jobs_page.urgency." + u.toLowerCase()) || u.replace(/_/g, " ");
  const rateTypeLabel = (r: string) => t("jobs_page.rate_type." + r.toLowerCase()) || r.replace("PER_", "Per ").toLowerCase();

  const activeFilters = [
    filterCategory && {
      label: t("common.categories." + filterCategory) || filterCategory,
      clear: () => setFilterCat(""),
    },
    areaIsSet(area) && { label: areaLabel(area), clear: () => setArea(EMPTY_AREA) },
    filterUrgency  && { label: urgencyLabel(filterUrgency), clear: () => setUrgency("") },
    filterRateType && { label: rateTypeLabel(filterRateType), clear: () => setRateType("") },
    filterMinAmt   && { label: `${t("jobs_page.filters.min") || "Min"} ${fmt(Number(filterMinAmt))}`, clear: () => setFilterMinAmt("") },
    filterMaxAmt   && { label: `${t("jobs_page.filters.max") || "Max"} ${fmt(Number(filterMaxAmt))}`, clear: () => setFilterMaxAmt("") },
    filterMinHours && { label: `${filterMinHours}h+`, clear: () => setMinHours("") },
    filterMaxHours && { label: `≤ ${filterMaxHours}h`, clear: () => setMaxHours("") },
    filterPosted   && { label: postedWithinLabel(filterPosted), clear: () => setFilterPosted("") },
    filterTeam     && { label: t("jobs_page.filters.team_jobs") || "Hiring 2+", clear: () => setFilterTeam(false) },
    filterOpenOnly && { label: t("jobs_page.filters.still_open") || "Still open", clear: () => setOpenOnly(false) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => {
    setFilterCat(""); setArea(EMPTY_AREA); setUrgency(""); setRateType("");
    setFilterMinAmt(""); setFilterMaxAmt(""); setMinHours(""); setMaxHours("");
    setFilterPosted(""); setFilterTeam(false); setOpenOnly(false);
  };

  return (
    <main style={{ background: "#111", minHeight: "100vh", color: "#f5f5f5", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
      <BreadcrumbSchema items={[
        { name: "Home", url: "https://mpahmapu.com" },
        { name: "Jobs", url: "https://mpahmapu.com/jobs" },
      ]} />
      {showPostJob && <PostJobModal onClose={() => setShowPostJob(false)} />}
      <style>{CSS}</style>

      <div className="jobs-wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "36px 20px 64px" }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.8px" }}>
              {t("common.nav.jobs")}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>
              {t("jobs_page.hero.subtitle")}
            </p>
          </div>
          <button onClick={() => setShowPostJob(true)} style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "#f97316", color: "#fff", borderRadius: 999,
            padding: "10px 18px", fontSize: 13, fontWeight: 700,
            border: "none", cursor: "pointer", fontFamily: "inherit",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "#ea6a0a")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f97316")}
          >
            <Plus size={14} /> {t("jobs_page.buttons.post_job")}
          </button>
        </div>

        {/* CATEGORY CHIPS */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", marginBottom: 20 }}>
          {[{ label: t("common.categories.all") || "All", key: "" }, ...CATEGORIES].map(({ label, key }) => {
            const active = filterCategory === key || (key === "" && !filterCategory);
            return (
              <button key={key || "all"} type="button"
                className="cat-chip"
                onClick={() => setFilterCat(key)}
                style={{
                  flexShrink: 0, borderRadius: 999, padding: "6px 14px",
                  fontSize: 12, fontWeight: 600, border: "1px solid",
                  cursor: "pointer",
                  background: active ? "rgba(249,115,22,0.12)" : "#1c1c1c",
                  borderColor: active ? "#f97316" : "#272727",
                  color: active ? "#f97316" : "#666",
                }}
              >
                {key === "" ? label : t("common.categories." + key) || label}
              </button>
            );
          })}
        </div>

        {/* SEARCH + FILTER TOGGLE */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={14} color="#555" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder={t("jobs_page.placeholders.search") || "Search jobs or categories…"}
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
              fontSize: 13, fontWeight: 600,
              color: showFilters ? "#fff" : "#aaa",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            <SlidersHorizontal size={14} />
            {t("jobs_page.buttons.filters") || "Filters"} {activeFilters.length > 0 && `(${activeFilters.length})`}
          </button>
        </div>

        {/* FILTER PANEL */}
        {showFilters && (
          <div style={{
            background: "#171717", border: "1px solid #272727",
            borderRadius: 14, padding: "20px", marginBottom: 14,
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14,
          }}>
            <ComboField
              label={t("jobs_page.filters.categories") || "Category"}
              value={filterCategory}
              onChange={setFilterCat}
              options={CATEGORIES.map(c => c.key)}
              labels={CATEGORIES.map(c => t("common.categories." + c.key) || c.label)}
            />

            <AreaFilter
              value={area}
              onChange={setArea}
              labels={{
                province: t("jobs_page.filters.province") || "Province",
                district: t("jobs_page.filters.district") || "District",
                sector:   t("jobs_page.filters.sector")   || "Sector",
              }}
            />

            <ComboField
              label={t("jobs_page.filters.urgency") || "Urgency"}
              value={filterUrgency}
              onChange={setUrgency}
              options={[...URGENCIES]}
              labels={URGENCIES.map(urgencyLabel)}
            />
            <ComboField
              label={t("jobs_page.filters.rate_type") || "Rate type"}
              value={filterRateType}
              onChange={setRateType}
              options={[...RATE_TYPES]}
              labels={RATE_TYPES.map(rateTypeLabel)}
            />

            <NumberField
              label={t("jobs_page.filters.min_pay") || "Min pay (RWF)"}
              value={filterMinAmt} onChange={setFilterMinAmt} placeholder="5,000" step={1000}
            />
            <NumberField
              label={t("jobs_page.filters.max_pay") || "Max pay (RWF)"}
              value={filterMaxAmt} onChange={setFilterMaxAmt} placeholder="50,000" step={1000}
            />

            <NumberField
              label={t("jobs_page.filters.min_hours") || "Min hours"}
              value={filterMinHours} onChange={setMinHours} placeholder="1" step={1}
            />
            <NumberField
              label={t("jobs_page.filters.max_hours") || "Max hours"}
              value={filterMaxHours} onChange={setMaxHours} placeholder="12" step={1}
            />

            <ComboField
              label={t("jobs_page.filters.posted") || "Posted"}
              value={filterPosted}
              onChange={setFilterPosted}
              options={POSTED_WITHIN}
              labels={POSTED_WITHIN.map(postedWithinLabel)}
              allLabel={t("jobs_page.filters.any_time") || "Any time"}
            />
            <ComboField
              label={t("jobs_page.filters.sort_by") || "Sort by"}
              value={sort}
              onChange={v => setSort((v || "newest") as SortKey)}
              options={SORTS}
              labels={[
                t("jobs_page.sort_options.newest")        || "Newest first",
                t("jobs_page.sort_options.oldest")        || "Oldest first",
                t("jobs_page.sort_options.pay_desc")      || "Pay: high → low",
                t("jobs_page.sort_options.pay_asc")       || "Pay: low → high",
                t("jobs_page.sort_options.hours_asc")     || "Shortest shift",
                t("jobs_page.sort_options.hours_desc")    || "Longest shift",
                t("jobs_page.sort_options.starting_soon") || "Starting soonest",
              ]}
              hideAll
            />

            <ToggleField
              label={t("jobs_page.filters.team_jobs") || "Hiring 2+"}
              value={filterTeam}
              onChange={setFilterTeam}
            />
            <ToggleField
              label={t("jobs_page.filters.still_open") || "Still open"}
              value={filterOpenOnly}
              onChange={setOpenOnly}
            />
          </div>
        )}

        {/* ACTIVE CHIPS */}
        {activeFilters.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, alignItems: "center" }}>
            {activeFilters.map(f => (
              <ActiveChip key={f.label} label={f.label} onRemove={f.clear} />
            ))}
            <button onClick={clearAll} style={{ background: "none", border: "none", fontSize: 11, color: "#555", cursor: "pointer", fontWeight: 600 }}>
              {t("jobs_page.buttons.clear_all")}
            </button>
          </div>
        )}

        {/* COUNT */}
        <p style={{ fontSize: 12, color: "#444", marginBottom: 14, fontWeight: 600 }}>
          {loadingJobs ? (t("jobs_page.loading") || "Loading…") : t("jobs_page.found_count", { count: total })}
        </p>

        {/* GRID */}
        {loadingJobs
          ? <LoadingGrid />
          : jobs.length === 0
          ? <Empty />
          : (
            <div className="jobs-grid">
              {jobs.map((j: JobDto) => {
                const posted = daysAgo(j.createdAt);
                const localizedCat = t("common.categories." + keyForSlug(j.category)) || j.category;
                return (
                  <a key={j.id} href={`/jobs/${j.id}`} className="jcard" style={{
                    display: "flex", flexDirection: "column", gap: 12,
                    background: "#1c1c1c", border: "1px solid #272727",
                    borderRadius: 14, padding: "16px",
                  }}>
                    {/* top row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#f0f0f0", lineHeight: 1.35 }}>{j.title}</p>
                      {j.urgency === "IMMEDIATE" && (
                        <span style={{
                          flexShrink: 0, fontSize: 10, fontWeight: 700, borderRadius: 999,
                          padding: "3px 8px", background: "rgba(239,68,68,0.1)", color: "#ef4444",
                        }}>
                          {t("jobs_page.badges.urgent") || "Urgent"}
                        </span>
                      )}
                    </div>

                    {/* category */}
                    <span style={{
                      alignSelf: "flex-start", fontSize: 10, fontWeight: 700, borderRadius: 999,
                      padding: "3px 10px", background: "rgba(249,115,22,0.08)", color: "#f97316",
                    }}>
                      {localizedCat}
                    </span>

                    {/* meta */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <MapPin size={11} color="#555" />
                        <span style={{ fontSize: 11, color: "#555" }}>{j.district}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Clock size={11} color="#555" />
                        <span style={{ fontSize: 11, color: "#555" }}>{postedLabel(posted)}</span>
                      </div>
                      {j.headcount > 1 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Briefcase size={11} color="#555" />
                          <span style={{ fontSize: 11, color: "#555" }}>
                            {t("jobs_page.cards.slots_open", { count: j.headcount }) || `${j.headcount} slots open`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* footer */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                      {/* Workers see their take-home, never the employer's posting price. */}
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#f97316" }}
                            title={t("jobs_page.cards.you_earn_hint") || "What you take home, after all charges"}>
                        {fmt(workerNetHourly(j))}
                        <span style={{ fontSize: 11, fontWeight: 500, color: "#555" }}>{" / " + rateUnit(j).short}</span>
                      </span>
                      <span style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 12, fontWeight: 600, color: "#666",
                      }}>
                        {t("jobs_page.cards.apply") || "Apply"} <ArrowRight size={12} />
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        {/* Infinite-scroll sentinel: reaching it fetches the next page from the server. */}
        {!loadingJobs && hasMore && (
          <div ref={sentinelRef} style={{ textAlign: "center", padding: "24px 0", color: "#555", fontSize: 13 }}>
            {loadingMore
              ? (t("jobs_page.loading_more") || "Loading more…")
              : (t("jobs_page.scroll_for_more") || "Scroll for more")}
          </div>
        )}

        {/* POST A JOB CTA */}
        <div id="post" style={{
          marginTop: 52, background: "#1c1c1c", border: "1px solid #272727",
          borderRadius: 18, padding: "32px 28px",
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20,
        }}>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>
              {t("jobs_page.cta.title")}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "#555", maxWidth: 340, lineHeight: 1.65 }}>
              {t("jobs_page.cta.desc")}
            </p>
          </div>
          <button onClick={() => setShowPostJob(true)} style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "#f97316", color: "#fff", borderRadius: 999,
            padding: "12px 22px", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap",
            border: "none", cursor: "pointer", fontFamily: "inherit",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "#ea6a0a")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f97316")}
          >
            {t("jobs_page.cta.button")} <ArrowRight size={14} />
          </button>
        </div>

      </div>

      <Footer />
    </main>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
function LoadingGrid() {
  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div className="jobs-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
            padding: 16, height: 160, animation: "pulse 1.5s ease-in-out infinite",
          }} />
        ))}
      </div>
    </>
  );
}

function Empty() {
  const { t } = useLanguage();
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
      <p style={{ fontSize: 32, margin: "0 0 12px" }}>🔍</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#555" }}>
        {t("jobs_page.empty.title") || "No jobs match your filters."}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#333" }}>
        {t("jobs_page.empty.desc") || "Try adjusting your search or clearing filters."}
      </p>
    </div>
  );
}
