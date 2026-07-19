"use client";

import Footer from "@/components/layout/footer";
import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getWorkers, getJobs, daysAgo, type WorkerProfileDto, type JobDto } from "@/lib/api";
import { useInfiniteReveal } from "@/lib/use-infinite-reveal";
import { ratingInfo } from "@/lib/rating";
import { useLanguage } from "@/lib/language-context";
import {
  UtensilsCrossed, Sparkles, Shield, Car, Zap, Wrench, Leaf,
  Camera, Package, Home, HardHat, Search, SlidersHorizontal,
  MapPin, Briefcase, Users, X, ChevronDown, Star,
  Baby,
  BadgeDollarSign,
  Bed,
  Bike,
  BookOpen,
  Building2,
  Calculator,
  ChefHat,
  ClipboardList,
  Code2,
  Coffee,
  Cog,
  Dog,
  Drill,
  Flower,
  Globe,
  GraduationCap,
  Hammer,
  Headphones,
  HeartHandshake,
  KeyRound,
  Languages,
  Laptop,
  Megaphone,
  Mic,
  MonitorSmartphone,
  Music,
  PackageCheck,
  Paintbrush,
  Palette,
  PartyPopper,
  PenSquare,
  PenTool,
  PhoneCall,
  Scale,
  Scissors,
  Shirt,
  ShirtIcon,
  ShoppingBag,
  Smartphone,
  Stethoscope,
  Store,
  Trees,
  TrendingUp,
  Truck,
  UserCheck,
  Video,
  Wifi,
  House,
} from "lucide-react";
import { BreadcrumbSchema, ServiceSchema } from "@/components/seo/json-ld";

// ── types ──────────────────────────────────────────────────────────────────
type Tab = "workers" | "jobs";
type SortWorker = "recommended" | "name";
type SortJob = "amount_asc" | "amount_desc" | "newest";

// ── data ───────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { icon: UtensilsCrossed, label: "Waiters", key: "waiters", apiValues: ["waiter"] },
  { icon: Coffee, label: "Baristas", key: "baristas", apiValues: ["bartender"] },
  { icon: Sparkles, label: "Cleaners", key: "cleaners", apiValues: ["cleaner"] },
  { icon: Shield, label: "Security Guards", key: "security_guards", apiValues: ["security"] },
  { icon: Car, label: "Drivers", key: "drivers", apiValues: ["driver"] },
  { icon: Truck, label: "Delivery Drivers", key: "delivery_drivers", apiValues: ["delivery_rider"] },
  { icon: Bike, label: "Courier Riders", key: "courier_riders", apiValues: ["delivery_rider"] },
  { icon: Zap, label: "Electricians", key: "electricians", apiValues: ["electrician"] },
  { icon: Wrench, label: "Plumbers", key: "plumbers", apiValues: ["plumber"] },
  { icon: Hammer, label: "Carpenters", key: "carpenters", apiValues: ["carpenter"] },
  { icon: Paintbrush, label: "Painters", key: "painters", apiValues: ["painter"] },
  { icon: HardHat, label: "Construction Workers", key: "construction_workers", apiValues: ["construction_worker"] },
  { icon: Drill, label: "Technicians", key: "technicians", apiValues: ["it_support"] },
  { icon: Cog, label: "Mechanics", key: "mechanics", apiValues: ["mechanic"] },
  { icon: Leaf, label: "Gardeners", key: "gardeners", apiValues: ["gardener"] },
  { icon: Trees, label: "Landscapers", key: "landscapers", apiValues: ["gardener"] },
  { icon: House, label: "Housekeepers", key: "housekeepers", apiValues: ["housekeeper"] },
  { icon: Bed, label: "Hotel Staff", key: "hotel_staff", apiValues: ["housekeeper", "waiter"] },
  { icon: ShoppingBag, label: "Shop Attendants", key: "shop_attendants", apiValues: ["sales_agent"] },
  { icon: Store, label: "Cashiers", key: "cashiers", apiValues: ["cashier"] },
  { icon: Package, label: "Warehouse Staff", key: "warehouse_staff", apiValues: ["warehouse_worker"] },
  { icon: PackageCheck, label: "Packers", key: "packers", apiValues: ["packer"] },
  { icon: ClipboardList, label: "Supervisors", key: "supervisors", apiValues: ["office_assistant"] },
  { icon: UserCheck, label: "Receptionists", key: "receptionists", apiValues: ["receptionist"] },
  { icon: PhoneCall, label: "Call Center Agents", key: "call_center_agents", apiValues: ["customer_support"] },
  { icon: Headphones, label: "Customer Support", key: "customer_support", apiValues: ["customer_support"] },
  { icon: Briefcase, label: "Office Assistants", key: "office_assistants", apiValues: ["office_assistant"] },
  { icon: GraduationCap, label: "Tutors", key: "tutors", apiValues: ["tutor"] },
  { icon: BookOpen, label: "Teachers", key: "teachers", apiValues: ["tutor"] },
  { icon: HeartHandshake, label: "Caregivers", key: "caregivers", apiValues: ["caregiver"] },
  { icon: Stethoscope, label: "Nurses", key: "nurses", apiValues: ["caregiver"] },
  { icon: Baby, label: "Babysitters", key: "babysitters", apiValues: ["nanny"] },
  { icon: Dog, label: "Pet Care", key: "pet_care", apiValues: ["other"] },
  { icon: Camera, label: "Photographers", key: "photographers", apiValues: ["photographer"] },
  { icon: Video, label: "Videographers", key: "videographers", apiValues: ["videographer"] },
  { icon: Music, label: "DJs", key: "djs", apiValues: ["dj"] },
  { icon: Mic, label: "MCs", key: "mcs", apiValues: ["mc"] },
  { icon: PartyPopper, label: "Event Planners", key: "event_planners", apiValues: ["promoter"] },
  { icon: Flower, label: "Florists", key: "florists", apiValues: ["gardener"] },
  { icon: Scissors, label: "Barbers", key: "barbers", apiValues: ["hairdresser"] },
  { icon: Sparkles, label: "Hair Stylists", key: "hair_stylists", apiValues: ["hairdresser"] },
  { icon: Palette, label: "Makeup Artists", key: "makeup_artists", apiValues: ["beautician"] },
  { icon: Shirt, label: "Tailors", key: "tailors", apiValues: ["tailor"] },
  { icon: ShirtIcon, label: "Laundry Services", key: "laundry_services", apiValues: ["housekeeper"] },
  { icon: Smartphone, label: "Phone Repair", key: "phone_repair", apiValues: ["it_support"] },
  { icon: Laptop, label: "Computer Repair", key: "computer_repair", apiValues: ["it_support"] },
  { icon: Wifi, label: "Network Technicians", key: "network_technicians", apiValues: ["it_support"] },
  { icon: MonitorSmartphone, label: "IT Support", key: "it_support", apiValues: ["it_support"] },
  { icon: Globe, label: "Web Developers", key: "web_developers", apiValues: ["web_developer"] },
  { icon: Code2, label: "Software Developers", key: "software_developers", apiValues: ["software_engineer"] },
  { icon: PenTool, label: "Graphic Designers", key: "graphic_designers", apiValues: ["graphic_designer"] },
  { icon: PenSquare, label: "Content Writers", key: "content_writers", apiValues: ["data_entry"] },
  { icon: Languages, label: "Translators", key: "translators", apiValues: ["translator"] },
  { icon: Calculator, label: "Accountants", key: "accountants", apiValues: ["accountant"] },
  { icon: Scale, label: "Legal Advisors", key: "legal_advisors", apiValues: ["other"] },
  { icon: Building2, label: "Real Estate Agents", key: "real_estate_agents", apiValues: ["sales_agent"] },
  { icon: KeyRound, label: "Property Managers", key: "property_managers", apiValues: ["office_assistant"] },
  { icon: Users, label: "HR Professionals", key: "hr_professionals", apiValues: ["office_assistant"] },
  { icon: TrendingUp, label: "Marketing Specialists", key: "marketing_specialists", apiValues: ["marketing_agent"] },
  { icon: Megaphone, label: "Sales Representatives", key: "sales_representatives", apiValues: ["sales_agent"] },
  { icon: BadgeDollarSign, label: "Financial Advisors", key: "financial_advisors", apiValues: ["accountant"] },
];

const LOCATIONS = ["Kacyiru", "Nyamirambo", "Kimihurura", "Remera", "Gisozi", "Kicukiro", "Gikondo", "Kanombe", "Kigali-wide"];



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

function SelectField({ label, value, onChange, options, labels }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: string[];
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
            color: value ? "#f0f0f0" : "#555", cursor: "pointer", outline: "none",
          }}
        >
          <option value="">All</option>
          {options.map((o, i) => <option key={o} value={o}>{labels ? labels[i] : o}</option>)}
        </select>
        <ChevronDown size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────
function BrowsePageInner() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("workers");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [workers, setWorkers] = useState<WorkerProfileDto[]>([]);
  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [loadingData, setLoadingData] = useState(true);   // jobs initial load

  // Workers paginate from the server: 16 (4 rows x 4) per batch, the next batch
  // fetched only when the sentinel scrolls into view (after a 1s pause) — never
  // preloaded. Refs mirror the state the observer/loader read without stale closures.
  const WORKERS_PAGE_SIZE = 16;
  const [workersLoading, setWorkersLoading] = useState(true);        // first page
  const [workersLoadingMore, setWorkersLoadingMore] = useState(false);
  const [workersHasMore, setWorkersHasMore] = useState(true);
  const [workersSentinel, setWorkersSentinel] = useState<HTMLDivElement | null>(null);
  const workersPageRef = useRef(0);
  const workersHasMoreRef = useRef(true);
  const workersBusyRef = useRef(false);

  // shared
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  // workers
  // Default keeps the server ranking: rating → completed jobs → profile completion → newest.
  const [sortWorker, setSortWorker] = useState<SortWorker>("recommended");

  // jobs
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [sortJob, setSortJob] = useState<SortJob>("newest");

  // Jobs still load in one shot (client-side reveal). Workers paginate — see loadWorkers.
  useEffect(() => {
    getJobs({ size: 100 }).then(p => setJobs(p.content)).catch(() => {}).finally(() => setLoadingData(false));
  }, []);

  // Fetch the next page of workers from the server. `initial` skips the pause and
  // replaces (rather than appends); `immediate` skips the pause for the explicit
  // "Load more" button. Guarded so a page is never loaded twice.
  const loadWorkers = useCallback(async (initial: boolean, immediate = false) => {
    if (workersBusyRef.current) return;
    if (!initial && !workersHasMoreRef.current) return;
    workersBusyRef.current = true;
    if (initial) setWorkersLoading(true); else setWorkersLoadingMore(true);
    if (!initial && !immediate) await new Promise((r) => setTimeout(r, 1000)); // pause before auto-loaded batch
    try {
      const p = await getWorkers({ page: workersPageRef.current, size: WORKERS_PAGE_SIZE });
      const content = p.content || [];
      setWorkers((prev) => (initial ? content : [...prev, ...content]));
      workersPageRef.current += 1;
      // Belt and braces: trust totalPages when present, but a FULL page also means
      // "probably more" — so a missing/odd meta shape can never kill pagination again.
      const more = (Number.isFinite(p.totalPages) && p.totalPages > 0)
        ? p.number + 1 < p.totalPages
        : content.length === WORKERS_PAGE_SIZE;
      workersHasMoreRef.current = more;
      setWorkersHasMore(more);
    } catch {
      // Network hiccup: keep hasMore so the "Load more" button lets the user retry.
      setWorkersHasMore(workersHasMoreRef.current);
    } finally {
      workersBusyRef.current = false;
      if (initial) setWorkersLoading(false); else setWorkersLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadWorkers(true); }, [loadWorkers]);

  // Scroll-position detection — NOT an IntersectionObserver. An observer only
  // fires on visibility *crossings*, which silently never happens when it attaches
  // at the wrong moment; a plain scroll listener re-checks the indicator's actual
  // position on every scroll/resize tick, so reaching the bottom always triggers.
  const workersSentinelRef = useCallback((el: HTMLDivElement | null) => setWorkersSentinel(el), []);
  useEffect(() => {
    if (!workersSentinel) return;
    const check = () => {
      if (workersBusyRef.current || !workersHasMoreRef.current) return;
      const rect = workersSentinel.getBoundingClientRect();
      const viewH = window.innerHeight || document.documentElement.clientHeight;
      // Indicator within 300px below the viewport bottom (or above it) → load next rows.
      if (rect.top <= viewH + 300) loadWorkers(false);
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    document.addEventListener("scroll", check, { passive: true, capture: true }); // inner scroll containers too
    check(); // page taller than content? load immediately until it fills
    const iv = setInterval(check, 1500); // belt-and-braces: recheck even without scroll events
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      document.removeEventListener("scroll", check, { capture: true } as EventListenerOptions);
      clearInterval(iv);
    };
  }, [workersSentinel, loadWorkers]);

  useEffect(() => {
    const cat = searchParams.get('category');
    const tab = searchParams.get('tab');
    if (cat) {
      const match = CATEGORIES.find(c => c.key === cat.toLowerCase() || c.label.toLowerCase() === cat.toLowerCase());
      if (match) setFilterCategory(match.key);
      else setFilterCategory(cat);
    }
    if (tab === 'jobs') setTab('jobs');
    if (tab === 'workers') setTab('workers');
  }, [searchParams]);

  // active filter chips
  const activeFilters = [
    filterCategory  && {
      label: t("common.categories." + filterCategory) || filterCategory,
      clear: () => setFilterCategory("")
    },
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
      const expType = (w.experienceType ?? "").toLowerCase();
      if (search && !w.name.toLowerCase().includes(search.toLowerCase())
        && !expType.includes(search.toLowerCase())) return false;
      if (filterCategory) {
        const catObj = CATEGORIES.find(c => c.key === filterCategory);
        if (catObj) {
          if (!catObj.apiValues.includes(expType)) return false;
        } else {
          if (expType !== filterCategory.toLowerCase()) return false;
        }
      }
      if (filterLocation && (w.district ?? "").toLowerCase() !== filterLocation.toLowerCase()) return false;
      return true;
    });
    if (sortWorker === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [workers, search, filterCategory, filterLocation, sortWorker]);

  // filtered jobs
  const filteredJobs = useMemo(() => {
    let list = jobs.filter((j: JobDto) => {
      const jobCat = j.category.toLowerCase();
      if (search && !j.title.toLowerCase().includes(search.toLowerCase())
        && !jobCat.includes(search.toLowerCase())) return false;
      if (filterCategory) {
        const catObj = CATEGORIES.find(c => c.key === filterCategory);
        if (catObj) {
          if (!catObj.apiValues.includes(jobCat)) return false;
        } else {
          if (jobCat !== filterCategory.toLowerCase()) return false;
        }
      }
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

  // Jobs use the client-side reveal (loaded whole); workers paginate server-side above.
  const jobsReveal = useInfiniteReveal(filteredJobs, 28);

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
              <SelectField
                label={t("jobs_page.filters.categories") || "Category"}
                value={filterCategory}
                onChange={setFilterCategory}
                options={CATEGORIES.map(c => c.key)}
                labels={CATEGORIES.map(c => t("common.categories." + c.key) || c.label)}
              />
              <SelectField
                label={t("jobs_page.filters.location") || "Location"}
                value={filterLocation}
                onChange={setFilterLocation}
                options={LOCATIONS}
              />

              {tab === "workers" && (
                <SelectField
                  label={t("jobs_page.filters.sort_by") || "Sort by"}
                  value={sortWorker}
                  onChange={v => setSortWorker((v || "recommended") as SortWorker)}
                  options={["recommended", "name"]}
                  labels={[
                    t("browse_page.sort.recommended") || "Recommended",
                    t("browse_page.sort.name") || "Name (A–Z)",
                  ]}
                />
              )}

              {tab === "jobs" && <>
                <SelectField
                  label={t("jobs_page.filters.min_pay") || "Min pay (RWF)"}
                  value={filterMinAmount}
                  onChange={setFilterMinAmount}
                  options={["5000", "8000", "10000", "15000"]}
                />
                <SelectField
                  label={t("jobs_page.filters.max_pay") || "Max pay (RWF)"}
                  value={filterMaxAmount}
                  onChange={setFilterMaxAmount}
                  options={["10000", "15000", "20000", "30000"]}
                />
                <SelectField
                  label={t("jobs_page.filters.sort_by") || "Sort by"}
                  value={sortJob}
                  onChange={v => setSortJob(v as SortJob)}
                  options={["newest", "amount_asc", "amount_desc"]}
                  labels={[
                    t("jobs_page.sort_options.newest") || "Newest first",
                    t("jobs_page.sort_options.pay_asc") || "Pay: low → high",
                    t("jobs_page.sort_options.pay_desc") || "Pay: high → low"
                  ]}
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
            ? (workersLoading
                ? (t("jobs_page.loading") || "Loading…")
                : (t("browse_page.workers_found", { count: filteredWorkers.length }) || `${filteredWorkers.length} workers found`) + (workersHasMore ? " +" : ""))
            : (loadingData
                ? (t("jobs_page.loading") || "Loading…")
                : (t("jobs_page.found_count", { count: filteredJobs.length }) || `${filteredJobs.length} jobs found`))}
        </p>

        {/* WORKERS GRID — paginated from the server, 16 per batch */}
        {tab === "workers" && (
          workersLoading ? <BrowseLoading />
          : filteredWorkers.length === 0 && !workersHasMore
            ? <Empty label={t("browse_page.empty.workers") || "No workers match your filters."} />
            : <div className="browse-grid">
                {filteredWorkers.map((w: WorkerProfileDto) => {
                  const catSlugs = (w.experienceTypes && w.experienceTypes.length > 0)
                    ? w.experienceTypes
                    : (w.experienceType ? [w.experienceType] : []);
                  const catLabels = catSlugs.map((s, i) => {
                    const key = CATEGORIES.find(c => c.apiValues.includes((s ?? "").toLowerCase()))?.key || (s ?? "").toLowerCase();
                    return t("common.categories." + key) || w.categoryNames?.[i] || s;
                  });
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
        {tab === "workers" && !workersLoading && workersHasMore && (
          <div ref={workersSentinelRef} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            padding: "26px 0 8px", minHeight: 60,
          }}>
            {workersLoadingMore ? (
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
                onClick={() => loadWorkers(false, true)}
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
          loadingData ? <BrowseLoading />
          : filteredJobs.length === 0
            ? <Empty label={t("jobs_page.empty.title") || "No jobs match your filters."} />
            : <div className="browse-grid">
                {jobsReveal.visible.map((j: JobDto) => {
                  const posted = daysAgo(j.createdAt);
                  const jCatKey = CATEGORIES.find(c => c.apiValues.includes(j.category.toLowerCase()))?.key || j.category;
                  const localizedJCat = t("common.categories." + jCatKey) || j.category;
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#f97316" }}>
                          {fmt(j.ratePerHour)}
                          <span style={{ fontSize: 11, fontWeight: 500, color: "#555" }}>{t("common.general.per_hour") || " / hr"}</span>
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
        {tab === "jobs" && !loadingData && jobsReveal.hasMore && (
          <div ref={jobsReveal.sentinelRef} style={{ textAlign: "center", padding: "24px 0", color: "#555", fontSize: 13 }}>
            {t("jobs_page.loading_more") || "Loading more…"}
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