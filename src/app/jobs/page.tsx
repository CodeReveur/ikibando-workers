"use client";

import { useState, useMemo, useEffect } from "react";
import Footer from "@/components/layout/footer";
import { PostJobModal } from "@/components/jobs/post-job-modal";
import { getJobs, daysAgo, type JobDto } from "@/lib/api";
import { useInfiniteReveal } from "@/lib/use-infinite-reveal";
import { useLanguage } from "@/lib/language-context";
import {
  UtensilsCrossed, Sparkles, Shield, Car, Zap, Wrench, Leaf,
  MapPin, ChevronRight, Briefcase, Star, Search, SlidersHorizontal, ChevronDown,
  X, Clock, Plus, ArrowRight, Home, HardHat,
  Baby,
  BadgeDollarSign,
  Bed,
  Bike,
  BookOpen,
  Building2,
  Calculator,
  Camera,
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
  Package,
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
  Users,
  Video,
  Wifi,
  House,
} from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/json-ld";

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

const LOCATIONS = ["Kacyiru", "Nyamirambo", "Kimihurura", "Remera", "Gisozi", "Kicukiro", "Gikondo", "Kanombe"];

type SortKey = "newest" | "amount_asc" | "amount_desc";

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;
const postedLabel = (d: number) => d === 0 ? "Today" : `${d}d ago`;

const CSS = `
  * { box-sizing: border-box; }
  .jobs-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  @media (min-width: 560px)  { .jobs-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 900px)  { .jobs-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1180px) { .jobs-grid { grid-template-columns: repeat(4, 1fr); } }
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
  const [jobs, setJobs]                  = useState<JobDto[]>([]);
  const [loadingJobs, setLoadingJobs]    = useState(true);
  const [search, setSearch]              = useState("");
  const [filterCategory, setFilterCat]  = useState("");
  const [filterLocation, setFilterLoc]  = useState("");
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [filterMinAmt, setFilterMinAmt] = useState("");
  const [sort, setSort]                  = useState<SortKey>("newest");
  const [showFilters, setShowFilters]   = useState(false);
  const [showPostJob, setShowPostJob]   = useState(false);

  useEffect(() => {
    getJobs({ size: 100 })
      .then(page => setJobs(page.content))
      .catch(() => setJobs([]))
      .finally(() => setLoadingJobs(false));
  }, []);

  const activeFilters = [
    filterCategory && {
      label: t("common.categories." + filterCategory) || filterCategory,
      clear: () => setFilterCat("")
    },
    filterLocation && { label: filterLocation,                     clear: () => setFilterLoc("") },
    filterUrgent   && { label: t("jobs_page.filters.urgent") || "Urgent only", clear: () => setFilterUrgent(false) },
    filterMinAmt   && { label: `${t("jobs_page.filters.min") || "Min"} ${fmt(Number(filterMinAmt))}`, clear: () => setFilterMinAmt("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => { setFilterCat(""); setFilterLoc(""); setFilterUrgent(false); setFilterMinAmt(""); };

  const filtered = useMemo(() => {
    let list = jobs.filter((j: JobDto) => {
      const q = search.toLowerCase();
      if (q && !j.title.toLowerCase().includes(q) && !j.category.toLowerCase().includes(q)) return false;
      if (filterCategory) {
        const catObj = CATEGORIES.find(c => c.key === filterCategory);
        if (catObj) {
          if (!catObj.apiValues.includes(j.category.toLowerCase())) return false;
        } else {
          if (j.category.toLowerCase() !== filterCategory.toLowerCase()) return false;
        }
      }
      if (filterLocation && j.district.toLowerCase() !== filterLocation.toLowerCase()) return false;
      if (filterUrgent && j.urgency !== "IMMEDIATE") return false;
      if (filterMinAmt && j.ratePerHour < Number(filterMinAmt)) return false;
      return true;
    });
    if (sort === "amount_asc")  list = [...list].sort((a, b) => a.ratePerHour - b.ratePerHour);
    if (sort === "amount_desc") list = [...list].sort((a, b) => b.ratePerHour - a.ratePerHour);
    if (sort === "newest")      list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [jobs, search, filterCategory, filterLocation, filterUrgent, filterMinAmt, sort]);

  // Infinite scroll: reveal in batches of 16 (4 rows × 4 columns) as the user scrolls.
  const { visible, hasMore, sentinelRef } = useInfiniteReveal(filtered, 16);

  return (
    <main style={{ background: "#111", minHeight: "100vh", color: "#f5f5f5", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
      <BreadcrumbSchema items={[
        { name: "Home", url: "https://mpahmapu.com" },
        { name: "Jobs", url: "https://mpahmapu.com/jobs" },
      ]} />
      {showPostJob && <PostJobModal onClose={() => setShowPostJob(false)} />}
      <style>{CSS}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 20px 64px" }}>

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
            <SelectField label={t("jobs_page.filters.location") || "Location"} value={filterLocation} onChange={setFilterLoc} options={LOCATIONS} />
            <SelectField label={t("jobs_page.filters.min_pay") || "Min pay (RWF)"} value={filterMinAmt} onChange={setFilterMinAmt}
              options={["5000", "8000", "10000", "15000", "20000"]} />
            <SelectField label={t("jobs_page.filters.sort_by") || "Sort by"} value={sort} onChange={v => setSort(v as SortKey)}
              options={["newest", "amount_asc", "amount_desc"]}
              labels={[
                t("jobs_page.sort_options.newest") || "Newest first",
                t("jobs_page.sort_options.pay_asc") || "Pay: low → high",
                t("jobs_page.sort_options.pay_desc") || "Pay: high → low"
              ]} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t("jobs_page.filters.urgent_only") || "Urgent only"}
              </label>
              <div
                onClick={() => setFilterUrgent(u => !u)}
                style={{
                  width: 36, height: 20, borderRadius: 999, position: "relative", cursor: "pointer",
                  background: filterUrgent ? "#f97316" : "#2a2a2a", transition: "background 0.2s", marginTop: 6,
                }}
              >
                <div style={{
                  position: "absolute", top: 2, left: filterUrgent ? 18 : 2,
                  width: 16, height: 16, borderRadius: 999, background: "#fff",
                  transition: "left 0.2s",
                }} />
              </div>
            </div>
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
          {loadingJobs ? (t("jobs_page.loading") || "Loading…") : t("jobs_page.found_count", { count: filtered.length })}
        </p>

        {/* GRID */}
        {loadingJobs
          ? <LoadingGrid />
          : filtered.length === 0
          ? <Empty />
          : (
            <div className="jobs-grid">
              {visible.map((j: JobDto) => {
                const posted = daysAgo(j.createdAt);
                const catKey = CATEGORIES.find(c => c.apiValues.includes(j.category.toLowerCase()))?.key || j.category;
                const localizedCat = t("common.categories." + catKey) || j.category;
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
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#f97316" }}>
                        {fmt(j.ratePerHour)}
                        <span style={{ fontSize: 11, fontWeight: 500, color: "#555" }}>{t("common.general.per_hour") || " / hr"}</span>
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
        {/* Infinite-scroll sentinel + loading indicator */}
        {!loadingJobs && hasMore && (
          <div ref={sentinelRef} style={{ textAlign: "center", padding: "24px 0", color: "#555", fontSize: 13 }}>
            {t("jobs_page.loading_more") || "Loading more…"}
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
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; labels?: string[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <select value={value} onChange={e => onChange(e.target.value)}
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
