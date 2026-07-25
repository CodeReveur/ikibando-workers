"use client";

import Footer from "@/components/layout/footer";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  getWorkers, getJobs, daysAgo, workerNetHourly,
  type WorkerProfileDto, type JobDto, type JobSearchParams, type WorkerSearchParams,
} from "@/lib/api";
import { usePagedResults } from "@/lib/use-paged-results";
import { rateUnit } from "@/lib/rate-unit";
import { CATEGORIES, categoryParam, keyForSlug } from "@/lib/browse-taxonomy";
import {
  ActiveChip, ComboField, NumberField, ToggleField,
  AreaFilter, EMPTY_AREA, areaIsSet, areaLabel, type AreaValue,
} from "@/components/browse/filter-controls";
import { ratingInfo } from "@/lib/rating";
import { useLanguage } from "@/lib/language-context";
import {
  Search, SlidersHorizontal, MapPin, Briefcase, Users, Star, ChevronDown,
} from "lucide-react";
import { BreadcrumbSchema, ServiceSchema } from "@/components/seo/json-ld";

// ── types ──────────────────────────────────────────────────────────────────
type Tab = "workers" | "jobs";
type SortWorker = NonNullable<WorkerSearchParams["sort"]>;
type SortJob = NonNullable<JobSearchParams["sort"]>;

// ── data ───────────────────────────────────────────────────────────────────
const WORKER_SORTS: SortWorker[] = ["recommended", "rating", "jobs", "newest", "name"];
const JOB_SORTS: SortJob[] = [
  "newest", "oldest", "rate_desc", "rate_asc", "duration_asc", "duration_desc", "starting_soon",
];
const URGENCIES = ["IMMEDIATE", "SAME_DAY", "SCHEDULED"] as const;
const ACCOUNT_TYPES = ["INDIVIDUAL", "TEAM", "COMPANY", "CREW"] as const;
const MIN_RATINGS = ["3", "3.5", "4", "4.5"];
const MIN_JOBS = ["1", "5", "10", "25"];
const POSTED_WITHIN = ["1", "3", "7", "14", "30"];

const PAGE_SIZE = 16;


// ── styles ─────────────────────────────────────────────────────────────────
const CSS = `
  * { box-sizing: border-box; }
  /* Column count follows the CONTAINER width (container queries), not the window:
     4 on large/mid → 3 mini-mid → 2 mobile → 1 watch. */
  .browse-wrap { container-type: inline-size; }
  .browse-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  @container (min-width: 340px) { .browse-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @container (min-width: 520px) { .browse-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @container (min-width: 680px) { .browse-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
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
  @media (max-width: 600px) {
    .browse-title { font-size: 22px !important; }
  }
`;

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

// ── sub-components ─────────────────────────────────────────────────────────
/**
 * Whether a worker counts as "available". Single source of truth — change what availability
 * depends on here (currently: the worker has at least one availability slot set).
 */
function isAvailable(w: WorkerProfileDto): boolean {
  return Array.isArray(w.availability) && w.availability.length > 0;
}

// ── main page ──────────────────────────────────────────────────────────────
function BrowsePageInner() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("workers");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // shared by both tabs
  const [filterCategory, setFilterCategory] = useState("");
  const [area, setArea] = useState<AreaValue>(EMPTY_AREA);

  // workers
  // "recommended" keeps the server ranking: rating → completed jobs → profile completion → newest.
  const [sortWorker, setSortWorker] = useState<SortWorker>("recommended");
  const [minRating, setMinRating] = useState("");
  const [minJobs, setMinJobs] = useState("");
  const [accountType, setAccountType] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withEquipment, setWithEquipment] = useState(false);

  // jobs
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("");
  const [filterPosted, setFilterPosted] = useState("");
  const [filterOpenOnly, setFilterOpenOnly] = useState(false);
  const [sortJob, setSortJob] = useState<SortJob>("newest");

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  // An empty result for the tab that is not on screen, so only the visible tab hits the network.
  const idlePage = <T,>() =>
    Promise.resolve({ content: [] as T[], totalElements: 0, totalPages: 0, number: 0, size: PAGE_SIZE });

  // Both tabs filter server-side, so a filter narrows the whole catalogue rather than only the
  // rows already fetched. `tab` is in the dep lists, so switching tabs loads that tab's results.
  const fetchWorkers = useCallback(
    (page: number) => tab !== "workers" ? idlePage<WorkerProfileDto>() : getWorkers({
      page, size: PAGE_SIZE,
      q: search.trim() || undefined,
      category: categoryParam(filterCategory),
      country: (area.country && area.country !== "Rwanda" ? area.country : undefined),
      province: area.province || undefined,
      district: area.district || undefined,
      sector: area.sector || undefined,
      minRating: num(minRating),
      minCompletedJobs: num(minJobs),
      accountType: (accountType || undefined) as WorkerSearchParams["accountType"],
      availableOnly, verifiedOnly, withEquipment,
      sort: sortWorker,
    }),
    [tab, search, filterCategory, area, minRating, minJobs, accountType,
     availableOnly, verifiedOnly, withEquipment, sortWorker],
  );

  const fetchJobs = useCallback(
    (page: number) => tab !== "jobs" ? idlePage<JobDto>() : getJobs({
      page, size: PAGE_SIZE,
      q: search.trim() || undefined,
      category: categoryParam(filterCategory),
      province: area.province || undefined,
      district: area.district || undefined,
      sector: area.sector || undefined,
      urgency: (filterUrgency || undefined) as JobSearchParams["urgency"],
      minRate: num(filterMinAmount),
      maxRate: num(filterMaxAmount),
      postedWithinDays: num(filterPosted),
      openOnly: filterOpenOnly,
      sort: sortJob,
    }),
    [tab, search, filterCategory, area, filterUrgency, filterMinAmount, filterMaxAmount,
     filterPosted, filterOpenOnly, sortJob],
  );

  // 3s pause before each scroll-loaded batch of 16, so results arrive at a
  // deliberate pace rather than the instant the sentinel scrolls into view.
  const workersView = usePagedResults<WorkerProfileDto>(fetchWorkers, [
    tab, search, filterCategory, area.country, area.province, area.district, area.sector,
    minRating, minJobs, accountType, availableOnly, verifiedOnly, withEquipment, sortWorker,
  ], { autoLoadDelayMs: 3000 });
  const jobsView = usePagedResults<JobDto>(fetchJobs, [
    tab, search, filterCategory, area.province, area.district, area.sector,
    filterUrgency, filterMinAmount, filterMaxAmount, filterPosted, filterOpenOnly, sortJob,
  ], { autoLoadDelayMs: 3000 });

  const workers = workersView.items;
  const jobs = jobsView.items;

  useEffect(() => {
    const cat = searchParams.get('category');
    const tabParam = searchParams.get('tab');
    if (cat) {
      const match = CATEGORIES.find(c => c.key === cat.toLowerCase() || c.label.toLowerCase() === cat.toLowerCase());
      setFilterCategory(match ? match.key : cat);
    }
    if (tabParam === 'jobs') setTab('jobs');
    if (tabParam === 'workers') setTab('workers');
  }, [searchParams]);

  // A single day reads as "Last 24 hours" rather than "Last 1 days".
  const postedWithinLabel = (d: string) => d === "1"
    ? (t("jobs_page.filters.posted_24h") || "Last 24 hours")
    : (t("jobs_page.filters.posted_days", { count: Number(d) }) || `Last ${d} days`);

  const urgencyLabel = (u: string) => t("jobs_page.urgency." + u.toLowerCase()) || u.replace(/_/g, " ");
  const accountTypeLabel = (a: string) =>
    t("browse_page.account_type." + a.toLowerCase()) || a.charAt(0) + a.slice(1).toLowerCase();

  // Active chips list only the filters that apply to the tab being viewed.
  const activeFilters = [
    filterCategory && {
      label: t("common.categories." + filterCategory) || filterCategory,
      clear: () => setFilterCategory(""),
    },
    areaIsSet(area) && { label: areaLabel(area), clear: () => setArea(EMPTY_AREA) },

    tab === "workers" && minRating && {
      label: `${minRating}★+`, clear: () => setMinRating(""),
    },
    tab === "workers" && minJobs && {
      label: t("browse_page.filters.jobs_done", { count: Number(minJobs) }) || `${minJobs}+ jobs`,
      clear: () => setMinJobs(""),
    },
    tab === "workers" && accountType && {
      label: accountTypeLabel(accountType), clear: () => setAccountType(""),
    },
    tab === "workers" && availableOnly && {
      label: t("browse_page.filters.available") || "Available", clear: () => setAvailableOnly(false),
    },
    tab === "workers" && verifiedOnly && {
      label: t("browse_page.filters.verified") || "Verified", clear: () => setVerifiedOnly(false),
    },
    tab === "workers" && withEquipment && {
      label: t("browse_page.filters.has_equipment") || "Has equipment", clear: () => setWithEquipment(false),
    },

    tab === "jobs" && filterUrgency && {
      label: urgencyLabel(filterUrgency), clear: () => setFilterUrgency(""),
    },
    tab === "jobs" && filterMinAmount && {
      label: `${t("jobs_page.filters.min") || "Min"} ${fmt(Number(filterMinAmount))}`,
      clear: () => setFilterMinAmount(""),
    },
    tab === "jobs" && filterMaxAmount && {
      label: `${t("jobs_page.filters.max") || "Max"} ${fmt(Number(filterMaxAmount))}`,
      clear: () => setFilterMaxAmount(""),
    },
    tab === "jobs" && filterPosted && {
      label: postedWithinLabel(filterPosted), clear: () => setFilterPosted(""),
    },
    tab === "jobs" && filterOpenOnly && {
      label: t("jobs_page.filters.still_open") || "Still open", clear: () => setFilterOpenOnly(false),
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => {
    setFilterCategory(""); setArea(EMPTY_AREA);
    setMinRating(""); setMinJobs(""); setAccountType("");
    setAvailableOnly(false); setVerifiedOnly(false); setWithEquipment(false);
    setFilterMinAmount(""); setFilterMaxAmount(""); setFilterUrgency("");
    setFilterPosted(""); setFilterOpenOnly(false);
  };

  const S: React.CSSProperties = { fontFamily: "Inter, DM Sans, system-ui, sans-serif" };

  return (
    <main style={{ ...S, background: "#111", minHeight: "100vh", color: "#f5f5f5" }}>
      <BreadcrumbSchema items={[
        { name: "Home", url: "https://mpahmapu.com" },
        { name: "Browse Workers", url: "https://mpahmapu.com/browse" },
      ]} />
      <ServiceSchema
        name="Browse Verified Workers"
        description="Browse and hire verified workers in Kigali for events, cleaning, security, driving, and more."
        url="https://mpahmapu.com/browse"
      />
      <style>{CSS}</style>

      <div className="browse-wrap" style={{ maxWidth: 760, margin: "0 auto", padding: "36px 20px 64px" }}>

        {/* PAGE TITLE */}
        <div style={{ marginBottom: 28 }}>
          <h1 className="browse-title" style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.8px" }}>
            {t("common.nav.browse")}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>
            {t("browse_page.hero.subtitle")}
          </p>
        </div>

        {/* TAB SWITCH */}
        <div style={{
          display: "inline-flex", background: "#1c1c1c", border: "1px solid #272727",
          borderRadius: 999, padding: 4, marginBottom: 24, gap: 4,
        }}>
          {([
            ["workers", Users, t("browse_page.tabs.workers") || "Workers"],
            ["jobs", Briefcase, t("browse_page.tabs.jobs") || "Jobs"]
          ] as const).map(([key, Icon, label]) => (
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
              placeholder={tab === "workers" ? (t("browse_page.placeholders.search_workers") || "Search workers or categories…") : (t("jobs_page.placeholders.search") || "Search jobs or categories…")}
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
            {t("jobs_page.buttons.filters") || "Filters"} {activeFilters.length > 0 && `(${activeFilters.length})`}
          </button>
        </div>

        {/* FILTER PANEL */}
        {showFilters && (
          <div style={{
            background: "#171717", border: "1px solid #272727", borderRadius: 14,
            padding: "20px", marginBottom: 16,
          }}>
            <div className="filter-panel">
              <ComboField
                label={t("jobs_page.filters.categories") || "Category"}
                value={filterCategory}
                onChange={setFilterCategory}
                options={CATEGORIES.map(c => c.key)}
                labels={CATEGORIES.map(c => t("common.categories." + c.key) || c.label)}
              />
              <AreaFilter
                value={area}
                onChange={setArea}
                showCountry={tab === "workers"}
                labels={{
                  country:  t("jobs_page.filters.country")  || "Country",
                  province: t("jobs_page.filters.province") || "Province",
                  district: t("jobs_page.filters.district") || "District",
                  sector:   t("jobs_page.filters.sector")   || "Sector",
                }}
              />

              {tab === "workers" && <>
                <ComboField
                  label={t("browse_page.filters.min_rating") || "Min rating"}
                  value={minRating}
                  onChange={setMinRating}
                  options={MIN_RATINGS}
                  labels={MIN_RATINGS.map(r => `${r}★ +`)}
                  allLabel={t("browse_page.filters.any_rating") || "Any rating"}
                />
                <ComboField
                  label={t("browse_page.filters.jobs_completed") || "Jobs completed"}
                  value={minJobs}
                  onChange={setMinJobs}
                  options={MIN_JOBS}
                  labels={MIN_JOBS.map(n =>
                    t("browse_page.filters.jobs_done", { count: Number(n) }) || `${n}+ jobs`)}
                  allLabel={t("browse_page.filters.any_experience") || "Any"}
                />
                <ComboField
                  label={t("browse_page.filters.account_type") || "Worker type"}
                  value={accountType}
                  onChange={setAccountType}
                  options={[...ACCOUNT_TYPES]}
                  labels={ACCOUNT_TYPES.map(accountTypeLabel)}
                />
                <ComboField
                  label={t("jobs_page.filters.sort_by") || "Sort by"}
                  value={sortWorker}
                  onChange={v => setSortWorker((v || "recommended") as SortWorker)}
                  options={WORKER_SORTS}
                  labels={[
                    t("browse_page.sort.recommended") || "Recommended",
                    t("browse_page.sort.rating")      || "Highest rated",
                    t("browse_page.sort.jobs")        || "Most jobs done",
                    t("browse_page.sort.newest")      || "Newest members",
                    t("browse_page.sort.name")        || "Name (A–Z)",
                  ]}
                  hideAll
                />
                <ToggleField
                  label={t("browse_page.filters.available") || "Available now"}
                  value={availableOnly} onChange={setAvailableOnly}
                />
                <ToggleField
                  label={t("browse_page.filters.verified") || "Verified only"}
                  value={verifiedOnly} onChange={setVerifiedOnly}
                />
                <ToggleField
                  label={t("browse_page.filters.has_equipment") || "Has equipment"}
                  value={withEquipment} onChange={setWithEquipment}
                />
              </>}

              {tab === "jobs" && <>
                <ComboField
                  label={t("jobs_page.filters.urgency") || "Urgency"}
                  value={filterUrgency}
                  onChange={setFilterUrgency}
                  options={[...URGENCIES]}
                  labels={URGENCIES.map(urgencyLabel)}
                />
                <NumberField
                  label={t("jobs_page.filters.min_pay") || "Min pay (RWF)"}
                  value={filterMinAmount} onChange={setFilterMinAmount} placeholder="5,000" step={1000}
                />
                <NumberField
                  label={t("jobs_page.filters.max_pay") || "Max pay (RWF)"}
                  value={filterMaxAmount} onChange={setFilterMaxAmount} placeholder="50,000" step={1000}
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
                  value={sortJob}
                  onChange={v => setSortJob((v || "newest") as SortJob)}
                  options={JOB_SORTS}
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
                  label={t("jobs_page.filters.still_open") || "Still open"}
                  value={filterOpenOnly} onChange={setFilterOpenOnly}
                />
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
              {t("jobs_page.buttons.clear_all")}
            </button>
          </div>
        )}

        {/* RESULTS COUNT */}
        <p style={{ fontSize: 12, color: "#444", marginBottom: 14, fontWeight: 600 }}>
          {tab === "workers"
            ? (workersView.loading
                ? (t("jobs_page.loading") || "Loading…")
                : (t("browse_page.workers_found", { count: workersView.total }) || `${workersView.total} workers found`))
            : (jobsView.loading
                ? (t("jobs_page.loading") || "Loading…")
                : (t("jobs_page.found_count", { count: jobsView.total }) || `${jobsView.total} jobs found`))}
        </p>

        {/* WORKERS GRID: filtered and paginated by the server, 16 per batch */}
        {tab === "workers" && (
          workersView.loading ? <BrowseLoading />
          : workers.length === 0
            ? <Empty label={t("browse_page.empty.workers") || "No workers match your filters."} />
            : <div className="browse-grid">
                {workers.map((w: WorkerProfileDto) => {
                  const catSlugs = (w.experienceTypes && w.experienceTypes.length > 0)
                    ? w.experienceTypes
                    : (w.experienceType ? [w.experienceType] : []);
                  const catLabels = catSlugs.map((s, i) =>
                    t("common.categories." + keyForSlug(s ?? "")) || w.categoryNames?.[i] || s);
                  if (catLabels.length === 0) catLabels.push(t("common.general.worker"));
                  const MAXW = 2;
                  const localizedWCat = catLabels.slice(0, MAXW).join(", ")
                    + (catLabels.length > MAXW ? ` +${catLabels.length - MAXW} ${t("worker_detail.more") || "more"}` : "");
                  return (
                    <a key={w.id} href={`/browse/${w.id}`} className="bcard" style={{
                      background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
                      padding: "16px", display: "flex", flexDirection: "column", gap: 12,
                      textDecoration: "none", overflow: "hidden",
                    }}>
                      {/* top row — availability shows as a green dot on the avatar, never over the name */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: 999, flexShrink: 0, position: "relative",
                          background: "rgba(249,115,22,0.12)", overflow: "hidden",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16, fontWeight: 800, color: "#f97316",
                        }}>
                          {w.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={w.photoUrl} alt={w.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            w.name[0]
                          )}
                          {isAvailable(w) && (
                            <span title={t("browse_page.badges.available") || "Available"} style={{
                              position: "absolute", bottom: -1, right: -1, width: 12, height: 12,
                              borderRadius: 999, background: "#22c55e", border: "2px solid #1c1c1c",
                            }} />
                          )}
                        </div>
                        {/* flex:1 + minWidth:0 keeps the text inside the card; wrap instead of
                            ellipsis so long names/categories show in full, never cut to "…". */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#f0f0f0", overflowWrap: "anywhere", wordBreak: "break-word", lineHeight: 1.3 }}>{w.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: "#555", marginTop: 2, overflowWrap: "anywhere", wordBreak: "break-word", lineHeight: 1.35 }}>{localizedWCat}</p>
                        </div>
                      </div>

                      {/* rating + location */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        {(() => {
                          const r = ratingInfo(w.rating, w.ratingCount);
                          return (
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <Star size={11} color="#f97316" fill="#f97316" />
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#f97316" }}>
                                {r.hasReviews ? `${r.value} · ${r.reviews} review${r.reviews === 1 ? "" : "s"}` : r.value}
                              </span>
                            </span>
                          );
                        })()}
                        {(w.locationShort ?? w.district) && (
                          <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                            <MapPin size={11} color="#555" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: "#555", overflowWrap: "anywhere", wordBreak: "break-word" }}>{w.locationShort ?? w.district}</span>
                          </span>
                        )}
                      </div>

                      {/* equipment tags */}
                      {w.equipment.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {w.equipment.slice(0, 3).map(eq => (
                            <span key={eq} style={{
                              fontSize: 9, fontWeight: 600, borderRadius: 999, padding: "2px 7px",
                              background: "rgba(249,115,22,0.07)", color: "#f97316",
                              overflowWrap: "anywhere", wordBreak: "break-word", maxWidth: "100%",
                            }}>{eq}</span>
                          ))}
                          {w.equipment.length > 3 && (
                            <span style={{ fontSize: 9, color: "#555" }}>+{w.equipment.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
        )}
        {tab === "workers" && !workersView.loading && workersView.hasMore && (
          <div ref={workersView.sentinelRef} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            padding: "26px 0 8px", minHeight: 60,
          }}>
            {workersView.loadingMore ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#888", fontSize: 13 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                  border: "2px solid #333", borderTopColor: "#f97316",
                  animation: "spin 0.8s linear infinite",
                }} />
                <span>{t("jobs_page.loading_more") || "Loading more…"}</span>
              </div>
            ) : (
              /* Always-visible manual fallback: if auto-load ever misses, one tap works. */
              <button
                onClick={() => workersView.loadMore(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.4)",
                  color: "#f97316", borderRadius: 999, padding: "11px 26px",
                  fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                }}
              >
                <ChevronDown size={15} />
                {t("browse_page.load_more") || "Load more workers"}
              </button>
            )}
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* JOBS GRID */}
        {tab === "jobs" && (
          jobsView.loading ? <BrowseLoading />
          : jobs.length === 0
            ? <Empty label={t("jobs_page.empty.title") || "No jobs match your filters."} />
            : <div className="browse-grid">
                {jobs.map((j: JobDto) => {
                  const posted = daysAgo(j.createdAt);
                  const localizedJCat = t("common.categories." + keyForSlug(j.category)) || j.category;
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
                          {localizedJCat}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <MapPin size={11} color="#555" />
                        <span style={{ fontSize: 11, color: "#555" }}>{j.district}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, rowGap: 4, flexWrap: "wrap", marginTop: "auto" }}>
                        {/* Workers see their take-home, never the employer's gross posting price. */}
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#f97316", whiteSpace: "nowrap" }}
                              title="What you take home, after all charges">
                          {fmt(workerNetHourly(j))}
                          <span style={{ fontSize: 11, fontWeight: 500, color: "#555" }}>{" / " + rateUnit(j).short}</span>
                        </span>
                        <span style={{ fontSize: 11, color: "#444", flexShrink: 0, whiteSpace: "nowrap" }}>
                          {posted === 0 ? "Today" : `${posted}d ago`}
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
        )}
        {tab === "jobs" && !jobsView.loading && jobsView.hasMore && (
          <div ref={jobsView.sentinelRef} style={{ textAlign: "center", padding: "24px 0", color: "#555", fontSize: 13 }}>
            {jobsView.loadingMore
              ? (t("jobs_page.loading_more") || "Loading more…")
              : (t("jobs_page.scroll_for_more") || "Scroll for more")}
          </div>
        )}

      </div>

      <Footer />
    </main>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div style={{ background: '#111', minHeight: '100vh' }} />}>
      <BrowsePageInner />
    </Suspense>
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
  const { t } = useLanguage();
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
      <p style={{ fontSize: 32, margin: "0 0 12px" }}>🔍</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#333" }}>
        {t("jobs_page.empty.desc") || "Try adjusting your filters or search term."}
      </p>
    </div>
  );
}
