import type { JobDto, Page, WorkerProfileDto, WorkerReview } from "@/lib/api";

/**
 * Server-side fetching for the public worker and job pages.
 *
 * Same reasoning as lib/blog.ts: the axios client in lib/api.ts is browser-oriented, so anything
 * it fetches lands after hydration and never reaches a crawler. These pages are the only content
 * on the site that scales with the marketplace, so they are rendered on the server: fetched here,
 * passed down as props, and present in the initial HTML.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8088";

/**
 * Detail pages are cheap to regenerate and change more often than blog posts (a job fills, a
 * worker's rating moves), but not so often that a crawler needs live data.
 */
const REVALIDATE_SECONDS = 900;

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data ?? null) as T | null;
  } catch {
    // An API outage must render an empty state, not a 500 - a crawler that gets a 500 on a URL
    // we listed in the sitemap will drop it far more readily than one that gets a soft empty page.
    return null;
  }
}

export async function fetchWorker(id: string): Promise<WorkerProfileDto | null> {
  return getJson<WorkerProfileDto>(`/api/workers/${encodeURIComponent(id)}`);
}

export async function fetchWorkerReviews(id: string): Promise<WorkerReview[]> {
  return (await getJson<WorkerReview[]>(`/api/workers/${encodeURIComponent(id)}/reviews`)) ?? [];
}

export async function fetchWorkers(params?: { size?: number }): Promise<Page<WorkerProfileDto> | null> {
  const q = new URLSearchParams();
  if (params?.size != null) q.set("size", String(params.size));
  const qs = q.toString();
  return getJson<Page<WorkerProfileDto>>(`/api/workers${qs ? `?${qs}` : ""}`);
}

export async function fetchJob(id: string): Promise<JobDto | null> {
  return getJson<JobDto>(`/api/jobs/${encodeURIComponent(id)}`);
}

export async function fetchJobs(params?: { size?: number }): Promise<Page<JobDto> | null> {
  const q = new URLSearchParams();
  if (params?.size != null) q.set("size", String(params.size));
  const qs = q.toString();
  return getJson<Page<JobDto>>(`/api/jobs${qs ? `?${qs}` : ""}`);
}
