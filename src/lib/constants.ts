export const JOB_CATEGORIES = [
  { value: "waiter", label: "Waiter / Server" },
  { value: "cleaner", label: "Cleaner" },
  { value: "security", label: "Security Guard" },
  { value: "event_staff", label: "Event Staff" },
  { value: "driver", label: "Driver" },
  { value: "gardener", label: "Gardener" },

  { value: "chef", label: "Chef" },
  { value: "cook", label: "Cook" },
  { value: "bartender", label: "Bartender" },
  { value: "cashier", label: "Cashier" },
  { value: "receptionist", label: "Receptionist" },
  { value: "housekeeper", label: "Housekeeper" },

  { value: "delivery_rider", label: "Delivery Rider" },
  { value: "warehouse_worker", label: "Warehouse Worker" },
  { value: "loader", label: "Loader" },
  { value: "unloader", label: "Unloader" },

  { value: "construction_worker", label: "Construction Worker" },
  { value: "electrician", label: "Electrician" },
  { value: "plumber", label: "Plumber" },
  { value: "painter", label: "Painter" },
  { value: "carpenter", label: "Carpenter" },
  { value: "mechanic", label: "Mechanic" },

  { value: "tailor", label: "Tailor" },
  { value: "hairdresser", label: "Hairdresser" },
  { value: "beautician", label: "Beautician" },

  { value: "nanny", label: "Nanny" },
  { value: "caregiver", label: "Caregiver" },
  { value: "tutor", label: "Tutor" },

  { value: "sales_agent", label: "Sales Agent" },
  { value: "promoter", label: "Promoter" },
  { value: "marketing_agent", label: "Marketing Agent" },

  { value: "photographer", label: "Photographer" },
  { value: "videographer", label: "Videographer" },
  { value: "dj", label: "DJ" },
  { value: "mc", label: "Master of Ceremonies (MC)" },
  { value: "musician", label: "Musician" },
  { value: "translator", label: "Translator" },

  { value: "office_assistant", label: "Office Assistant" },
  { value: "data_entry", label: "Data Entry Clerk" },
  { value: "customer_support", label: "Customer Support" },
  { value: "it_support", label: "IT Support" },
  { value: "graphic_designer", label: "Graphic Designer" },
  { value: "web_developer", label: "Web Developer" },
  { value: "mobile_developer", label: "Mobile Developer" },
  { value: "software_engineer", label: "Software Engineer" },
  { value: "accountant", label: "Accountant" },

  { value: "farm_worker", label: "Farm Worker" },
  { value: "packer", label: "Packer" },

  { value: "other", label: "Other" },
] as const;

export const PLATFORM_COMMISSION = 0.10; // 10%
export const CURRENCY = "RWF";

/** Minimum rate an employer may offer, in RWF, per rate period. */
export const MIN_RATE_BY_PERIOD = {
  hr: 100,
  day: 800,
  week: 5000,
  month: 15000,
  year: 120000,
} as const;
export const DEFAULT_CITY = "Rwanda";

export const RWANDA_PROVINCES = [
  {
    label: "City of Kigali",
    districts: ["Gasabo", "Kicukiro", "Nyarugenge"],
  },
  {
    label: "Northern Province",
    districts: ["Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo"],
  },
  {
    label: "Southern Province",
    districts: ["Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe", "Nyanza", "Nyaruguru", "Ruhango"],
  },
  {
    label: "Eastern Province",
    districts: ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"],
  },
  {
    label: "Western Province",
    districts: ["Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rutsiro", "Rusizi"],
  },
] as const;