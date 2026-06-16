import { create } from "zustand";
import type { Job } from "@/types/job";

interface JobStore {
  jobs: Job[];
  activeJob: Job | null;

  setJobs: (jobs: Job[]) => void;
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  clearJobs: () => void;

  setActiveJob: (job: Job | null) => void;
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: [],
  activeJob: null,

  setJobs: (jobs) =>
    set({
      jobs,
    }),

  addJob: (job) =>
    set((state) => ({
      jobs: [...state.jobs, job],
    })),

  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id
          ? {
              ...job,
              ...updates,
            }
          : job
      ),
      activeJob:
        state.activeJob?.id === id
          ? {
              ...state.activeJob,
              ...updates,
            }
          : state.activeJob,
    })),

  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== id),
      activeJob:
        state.activeJob?.id === id ? null : state.activeJob,
    })),

  clearJobs: () =>
    set({
      jobs: [],
      activeJob: null,
    }),

  setActiveJob: (job) =>
    set({
      activeJob: job,
    }),
}));