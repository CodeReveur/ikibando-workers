"use client";

import { useState, useEffect } from "react";
import Footer from "@/components/layout/footer";
import { PostJobModal } from "@/components/jobs/post-job-modal";
import { getWorkers, getJobs, daysAgo, workerNetHourly, type WorkerProfileDto, type JobDto } from "@/lib/api";
import { ratingInfo } from "@/lib/rating";
import { useLanguage } from "@/lib/language-context";
import {
  UtensilsCrossed, Sparkles, Shield, Car, Zap, Wrench, Leaf,
  MapPin, ChevronRight, Briefcase, Star,
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
  HardHat,
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
import { BreadcrumbSchema, FAQSchema } from "@/components/seo/json-ld";

const categories = [
  { icon: UtensilsCrossed, label: "Waiters", key: "waiters" },
  { icon: Coffee, label: "Baristas", key: "baristas" },
  { icon: Sparkles, label: "Cleaners", key: "cleaners" },
  { icon: Shield, label: "Security Guards", key: "security_guards" },
  { icon: Car, label: "Drivers", key: "drivers" },
  { icon: Truck, label: "Delivery Drivers", key: "delivery_drivers" },
  { icon: Bike, label: "Courier Riders", key: "courier_riders" },
  { icon: Zap, label: "Electricians", key: "electricians" },
  { icon: Wrench, label: "Plumbers", key: "plumbers" },
  { icon: Hammer, label: "Carpenters", key: "carpenters" },
  { icon: Paintbrush, label: "Painters", key: "painters" },
  { icon: HardHat, label: "Construction Workers", key: "construction_workers" },
  { icon: Drill, label: "Technicians", key: "technicians" },
  { icon: Cog, label: "Mechanics", key: "mechanics" },
  { icon: Leaf, label: "Gardeners", key: "gardeners" },
  { icon: Trees, label: "Landscapers", key: "landscapers" },
  { icon: House, label: "Housekeepers", key: "housekeepers" },
  { icon: Bed, label: "Hotel Staff", key: "hotel_staff" },
  { icon: ShoppingBag, label: "Shop Attendants", key: "shop_attendants" },
  { icon: Store, label: "Cashiers", key: "cashiers" },
  { icon: Package, label: "Warehouse Staff", key: "warehouse_staff" },
  { icon: PackageCheck, label: "Packers", key: "packers" },
  { icon: ClipboardList, label: "Supervisors", key: "supervisors" },
  { icon: UserCheck, label: "Receptionists", key: "receptionists" },
  { icon: PhoneCall, label: "Call Center Agents", key: "call_center_agents" },
  { icon: Headphones, label: "Customer Support", key: "customer_support" },
  { icon: Briefcase, label: "Office Assistants", key: "office_assistants" },
  { icon: GraduationCap, label: "Tutors", key: "tutors" },
  { icon: BookOpen, label: "Teachers", key: "teachers" },
  { icon: HeartHandshake, label: "Caregivers", key: "caregivers" },
  { icon: Stethoscope, label: "Nurses", key: "nurses" },
  { icon: Baby, label: "Babysitters", key: "babysitters" },
  { icon: Dog, label: "Pet Care", key: "pet_care" },
  { icon: Camera, label: "Photographers", key: "photographers" },
  { icon: Video, label: "Videographers", key: "videographers" },
  { icon: Music, label: "DJs", key: "djs" },
  { icon: Mic, label: "MCs", key: "mcs" },
  { icon: PartyPopper, label: "Event Planners", key: "event_planners" },
  { icon: Flower, label: "Florists", key: "florists" },
  { icon: Scissors, label: "Barbers", key: "barbers" },
  { icon: Sparkles, label: "Hair Stylists", key: "hair_stylists" },
  { icon: Palette, label: "Makeup Artists", key: "makeup_artists" },
  { icon: Shirt, label: "Tailors", key: "tailors" },
  { icon: ShirtIcon, label: "Laundry Services", key: "laundry_services" },
  { icon: Smartphone, label: "Phone Repair", key: "phone_repair" },
  { icon: Laptop, label: "Computer Repair", key: "computer_repair" },
  { icon: Wifi, label: "Network Technicians", key: "network_technicians" },
  { icon: MonitorSmartphone, label: "IT Support", key: "it_support" },
  { icon: Globe, label: "Web Developers", key: "web_developers" },
  { icon: Code2, label: "Software Developers", key: "software_developers" },
  { icon: PenTool, label: "Graphic Designers", key: "graphic_designers" },
  { icon: PenSquare, label: "Content Writers", key: "content_writers" },
  { icon: Languages, label: "Translators", key: "translators" },
  { icon: Calculator, label: "Accountants", key: "accountants" },
  { icon: Scale, label: "Legal Advisors", key: "legal_advisors" },
  { icon: Building2, label: "Real Estate Agents", key: "real_estate_agents" },
  { icon: KeyRound, label: "Property Managers", key: "property_managers" },
  { icon: Users, label: "HR Professionals", key: "hr_professionals" },
  { icon: TrendingUp, label: "Marketing Specialists", key: "marketing_specialists" },
  { icon: Megaphone, label: "Sales Representatives", key: "sales_representatives" },
  { icon: BadgeDollarSign, label: "Financial Advisors", key: "financial_advisors" },
];

export default function Home() {
  const { t } = useLanguage();
  const [showPostJob, setShowPostJob] = useState(false);
  const [workers, setWorkers] = useState<WorkerProfileDto[]>([]);
  const [jobs, setJobs] = useState<JobDto[]>([]);

  const fmt = (n: number) => t("common.general.currency_pattern", { amount: n.toLocaleString() });

  useEffect(() => {
    // 18 fills the workers grid to complete rows (3-per-row) instead of leaving a lone last card.
    getWorkers({ size: 18 }).then(p => setWorkers(p.content)).catch(() => {});
    getJobs({ size: 16 }).then(p => setJobs(p.content)).catch(() => {});
  }, []);

  return (
    <main style={{ background: "#111", minHeight: "100vh", fontFamily: "Inter, DM Sans, system-ui, sans-serif", color: "#f5f5f5" }}>
      <BreadcrumbSchema items={[
        { name: "Home", url: "https://mpahmapu.com" },
      ]} />
      <FAQSchema faqs={[
        { question: t("home.faqs.q1"), answer: t("home.faqs.a1") },
        { question: t("home.faqs.q2"), answer: t("home.faqs.a2") },
        { question: t("home.faqs.q3"), answer: t("home.faqs.a3") },
        { question: t("home.faqs.q4"), answer: t("home.faqs.a4") },
        { question: t("home.faqs.q5"), answer: t("home.faqs.a5") },
      ]} />

      {showPostJob && <PostJobModal onClose={() => setShowPostJob(false)} />}

      {/* responsive grid styles */}
      <style>{`
        /* Responsive by container width: as many ~150px columns as fit (up to ~4
           on the wide home summary), fewer on phones — no overflow, no cramping. */
        .card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 10px;
        }
        /* Only drop to a single column on truly tiny widths (watch-class
           screens), where two cards side by side would be unreadable. */
        @media (max-width: 260px) {
          .card-grid {
            grid-template-columns: 1fr;
          }
        }
        .card-hover {
          transition: border-color 0.15s;
        }
        .card-hover:hover {
          border-color: #f97316 !important;
        }
      `}</style>

      {/* HERO */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "68px 20px 52px", textAlign: "center" }}>
        <span style={{
          display: "inline-block", background: "rgba(249,115,22,0.1)", color: "#f97316",
          borderRadius: 999, padding: "4px 14px", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 22,
        }}>
          {t("home.hero.location")}
        </span>
        <h1 style={{ fontSize: "clamp(36px,9vw,54px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-1.5px", margin: "0 0 16px", color: "#fff" }}>
          {t("home.hero.title_find")}<br />
          <span style={{ color: "#f97316" }}>{t("home.hero.title_hire")}</span>
        </h1>
        <p style={{ fontSize: 15, color: "#666", lineHeight: 1.7, margin: "0 auto", maxWidth: 420 }}>
          {t("home.hero.subtitle")}
        </p>
        <div style={{ marginTop: 28, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setShowPostJob(true)} style={{
            background: "#f97316", color: "#fff", borderRadius: 999,
            padding: "12px 26px", fontWeight: 700, fontSize: 14,
            border: "none", cursor: "pointer", fontFamily: "inherit",
          }}>
            {t("common.buttons.post_request")}
          </button>
          <a href="/signup" style={{
            background: "transparent", color: "#aaa", borderRadius: 999,
            padding: "12px 26px", fontWeight: 600, fontSize: 14, textDecoration: "none",
            border: "1px solid #2a2a2a",
          }}>
            {t("common.buttons.become_worker")}
          </a>
        </div>
      </div>

      {/* CATEGORIES */}
      <section id="categories" style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px 20px" }}>
        <SectionHeader title={t("home.sections.categories")} href="/browse" />
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {categories.map(({ icon: Icon, label, key }) => (
            <a
              key={label}
              href={`/browse?category=${label.toLowerCase()}`}
              style={{
                flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                background: "#1c1c1c", border: "1px solid #272727", borderRadius: 16,
                padding: "18px 20px", textDecoration: "none", minWidth: 84,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#f97316")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#272727")}
            >
              <Icon size={22} color="#f97316" strokeWidth={1.75} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa", whiteSpace: "nowrap" }}>{t("common.categories." + key)}</span>
            </a>
          ))}
        </div>
      </section>

      {/* AVAILABLE WORKERS */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 20px" }}>
        <SectionHeader title={t("home.sections.available_workers")} href="/browse" Icon={Briefcase} />
        <div className="card-grid">
          {workers.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background:"#1c1c1c", border:"1px solid #272727", borderRadius:14, padding:16, height:90, animation:"pulse 1.5s ease-in-out infinite" }} />
              ))
            : workers.map((w: WorkerProfileDto) => (
              <a
                href={`/browse/${w.id}`}
                key={w.id}
                className="card-hover"
                style={{
                  background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
                  padding: "16px", display: "flex", flexDirection: "column", gap: 14,
                  textDecoration: "none", color: "inherit", minWidth: 0,
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 999, flexShrink: 0, overflow: "hidden",
                    background: "rgba(249,115,22,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 800, color: "#f97316",
                  }}>
                    {w.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.photoUrl} alt={w.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      w.name[0]
                    )}
                  </div>
                  <div style={{ flex: "1 1 100px", minWidth: 100 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#f0f0f0", wordBreak: "break-word", lineHeight: 1.3 }}>{w.name}</p>
                    {(() => {
                      const catSlugs = (w.experienceTypes && w.experienceTypes.length > 0)
                        ? w.experienceTypes
                        : (w.experienceType ? [w.experienceType] : []);
                      const catLabels = catSlugs.map((s, i) =>
                        t("common.categories." + (s ?? "").toLowerCase()) || w.categoryNames?.[i] || s);
                      if (catLabels.length === 0) catLabels.push(t("common.general.worker"));
                      const MAXW = 2;
                      const text = catLabels.slice(0, MAXW).join(", ")
                        + (catLabels.length > MAXW ? ` +${catLabels.length - MAXW} ${t("worker_detail.more") || "more"}` : "");
                      return (
                        <p title={catLabels.join(", ")} style={{ margin: 0, fontSize: 11, color: "#555", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {text}
                        </p>
                      );
                    })()}
                  </div>
                  {(() => {
                    const r = ratingInfo(w.rating, w.ratingCount);
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0, marginLeft: "auto" }}>
                        <Star size={12} color="#f97316" fill="#f97316" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#f97316" }}>
                          {r.value}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                {(w.locationShort ?? w.district) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                    <MapPin size={11} color="#555" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.locationShort ?? w.district}</span>
                  </div>
                )}
              </a>
            ))
          }
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </section>

      {/* AVAILABLE JOBS */}
      <section id="jobs" style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 64px" }}>
        <SectionHeader title={t("home.sections.available_jobs")} href="/jobs" Icon={Briefcase} />
        <div className="card-grid">
          {jobs.length === 0
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ background:"#1c1c1c", border:"1px solid #272727", borderRadius:14, padding:16, height:110, animation:"pulse 1.5s ease-in-out infinite" }} />
              ))
            : jobs.map((j: JobDto) => (
              <a
                key={j.id}
                href={`/jobs/${j.id}`}
                className="card-hover"
                style={{
                  display: "flex", flexDirection: "column", gap: 10,
                  background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
                  padding: "16px", textDecoration: "none", minWidth: 0,
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#f0f0f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.title}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                  <MapPin size={11} color="#555" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.district}</span>
                </div>
                {/* Worker take-home, not the employer's posting price. */}
                <span title={t("jobs_page.cards.you_earn_hint") || "What you take home, after all charges"}
                  style={{
                    alignSelf: "flex-start", marginTop: "auto",
                    background: "rgba(249,115,22,0.1)", borderRadius: 999,
                    padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#f97316",
                  }}>
                  {fmt(workerNetHourly(j))} {t("common.general.per_hour")}
                </span>
              </a>
            ))
          }
        </div>
      </section>

      <Footer />

    </main>
  );
}

function SectionHeader({ title, href, Icon }: { title: string; href: string; Icon?: React.ElementType }) {
  const { t } = useLanguage();
  return (
    <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {Icon && <Icon size={16} color="#f97316" strokeWidth={2} />}
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", margin: 0 }}>
          {title}
        </h2>
      </div>
      <a href={href} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 12, color: "#f97316", textDecoration: "none", fontWeight: 600 }}>
        {t("common.buttons.more")} <ChevronRight size={13} color="#f97316" />
      </a>
    </div>
  );
}