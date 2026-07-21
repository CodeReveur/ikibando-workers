import {
  UtensilsCrossed, Sparkles, Shield, Car, Zap, Wrench, Leaf, Briefcase, HardHat,
  Baby, BadgeDollarSign, Bed, Bike, BookOpen, Building2, Calculator, Camera,
  ClipboardList, Code2, Coffee, Cog, Dog, Drill, Flower, Globe, GraduationCap,
  Hammer, Headphones, HeartHandshake, KeyRound, Languages, Laptop, Megaphone, Mic,
  MonitorSmartphone, Music, Package, PackageCheck, Paintbrush, Palette, PartyPopper,
  PenSquare, PenTool, PhoneCall, Scale, Scissors, Shirt, ShirtIcon, ShoppingBag,
  Smartphone, Stethoscope, Store, Trees, TrendingUp, Truck, UserCheck, Users, Video,
  Wifi, House, type LucideIcon,
} from "lucide-react";

/**
 * The browse taxonomy: the categories a searcher picks from, and the job/worker category
 * slugs each one maps to. Several display categories intentionally fan out to the same
 * slug (Landscapers, Florists and Gardeners are all posted as `gardener`), and a few fan
 * out to more than one, which is why `apiValues` is a list and is sent to the API as a
 * comma-separated set rather than a single value.
 *
 * Shared by /jobs and /browse. Previously each page carried its own copy of this array.
 */
export interface BrowseCategory {
  icon: LucideIcon;
  label: string;
  key: string;
  apiValues: string[];
}

export const CATEGORIES: BrowseCategory[] = [
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

/** The category entry for a picker key, if it is one of ours. */
export function categoryByKey(key: string): BrowseCategory | undefined {
  return CATEGORIES.find(c => c.key === key);
}

/**
 * The API `category` value for a picker key: the slugs it fans out to, comma-separated.
 * An unknown key (for example one arriving in a shared URL) is passed through as-is.
 */
export function categoryParam(key: string): string | undefined {
  if (!key) return undefined;
  const match = categoryByKey(key);
  return match ? match.apiValues.join(",") : key;
}

/** The picker key covering an API slug, for labelling a result card. */
export function keyForSlug(slug: string): string {
  const s = (slug ?? "").toLowerCase();
  return CATEGORIES.find(c => c.apiValues.includes(s))?.key ?? slug;
}

export type CategoryStats = Record<string, { workers: number; jobs: number }>;

/**
 * Sum a stats map (keyed by experience slug) across a category's apiValues.
 * De-duplicates because several display categories share a slug (gardener), so a
 * category with two apiValues pointing at the same slug must not double-count.
 */
export function countsForCategory(cat: BrowseCategory, stats: CategoryStats): { workers: number; jobs: number } {
  const seen = new Set<string>();
  let workers = 0, jobs = 0;
  for (const slug of cat.apiValues) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const s = stats[slug];
    if (s) { workers += s.workers || 0; jobs += s.jobs || 0; }
  }
  return { workers, jobs };
}
