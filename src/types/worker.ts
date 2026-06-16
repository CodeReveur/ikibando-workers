import { JobCategory } from "./job";

export type Language =
  | "kinyarwanda"
  | "english"
  | "french"
  | "swahili"
  | "luganda"
  | "other";

export type WorkerType = "individual" | "team" | "company";

export interface Worker {
  id: string;
  name: string;
  phone: string;
  email?: string;
  profileImage?: string;

  workerType: WorkerType;
  teamSize?: number; // for team/company

  categories: JobCategory[];

  rating: number; // 0–5
  totalJobs: number;
  yearsOfExperience?: number;

  isVerified: boolean;
  isAvailable: boolean;

  location?: {
    lat: number;
    lng: number;
    address?: string;
  };

  hourlyRate?: number; // RWF
  completedJobs?: number;
  cancelledJobs?: number;

  languages?: Language[];

  createdAt: string; // ISO
  updatedAt?: string; // ISO
}