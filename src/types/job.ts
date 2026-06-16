export type JobCategory =
  | "waiter"
  | "cleaner"
  | "security"
  | "event_staff"
  | "driver"
  | "gardener"
  | "chef"
  | "cook"
  | "bartender"
  | "cashier"
  | "receptionist"
  | "housekeeper"
  | "delivery_rider"
  | "warehouse_worker"
  | "loader"
  | "unloader"
  | "construction_worker"
  | "electrician"
  | "plumber"
  | "painter"
  | "carpenter"
  | "mechanic"
  | "tailor"
  | "hairdresser"
  | "beautician"
  | "nanny"
  | "caregiver"
  | "tutor"
  | "sales_agent"
  | "promoter"
  | "photographer"
  | "videographer"
  | "dj"
  | "mc"
  | "musician"
  | "translator"
  | "office_assistant"
  | "data_entry"
  | "customer_support"
  | "it_support"
  | "social_media_manager"
  | "graphic_designer"
  | "web_developer"
  | "mobile_developer"
  | "software_engineer"
  | "marketing_agent"
  | "accountant"
  | "farm_worker"
  | "packer"
  | "other";

export type JobStatus =
  | "draft"
  | "pending"
  | "open"
  | "accepted"
  | "assigned"
  | "dispatched"
  | "arrived"
  | "in_progress"
  | "paused"
  | "completed"
  | "verified"
  | "paid"
  | "expired"
  | "rejected"
  | "cancelled";
  
  export interface Job {
  id: string;
  category: JobCategory;
  headcount: number;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  startTime: string; // ISO 8601
  durationHours: number;
  ratePerHour: number; // RWF
  status: JobStatus;
  employerId: string;
  createdAt: string; // ISO 8601
}