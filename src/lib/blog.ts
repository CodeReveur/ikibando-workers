import type { BlogCategory, BlogPost, Page } from "@/lib/api";

/**
 * Server-side blog fetching.
 *
 * The blog exists largely to give the brand crawlable, corroborating content, so these pages are
 * server-rendered — the axios client in lib/api.ts is browser-oriented and its data would never
 * reach a crawler. Plain fetch also lets us use Next's revalidation cache.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8088";

/** Posts change rarely; an hour of staleness is invisible to readers and cheap for the server. */
const REVALIDATE_SECONDS = 3600;

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
    // A blog outage must not take the page down — callers render an empty state.
    return null;
  }
}

export async function fetchPosts(params?: {
  category?: BlogCategory;
  page?: number;
  size?: number;
}): Promise<Page<BlogPost> | null> {
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.size != null) q.set("size", String(params.size));
  const qs = q.toString();
  return getJson<Page<BlogPost>>(`/api/blog${qs ? `?${qs}` : ""}`);
}

export async function fetchPost(slug: string): Promise<BlogPost | null> {
  return getJson<BlogPost>(`/api/blog/${encodeURIComponent(slug)}`);
}

/**
 * Rough minutes to read, from the post body. 200wpm is the usual figure for prose.
 * Returns 0 when there's nothing to measure, so callers can hide the label rather than print a
 * confident "0 min read".
 */
export function readingTime(bodyHtml: string | null): number {
  if (!bodyHtml) return 0;
  const words = bodyHtml
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return words === 0 ? 0 : Math.max(1, Math.round(words / 200));
}

export function formatPostDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
