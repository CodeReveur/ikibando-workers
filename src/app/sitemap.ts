import type { MetadataRoute } from "next";
import { fetchPosts } from "@/lib/blog";
import { fetchJobs, fetchWorkers } from "@/lib/server-api";
import { SITE_URL } from "@/lib/seo";

/** Posts appear without a redeploy, but the sitemap isn't rebuilt on every crawl. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const paths = [
    "",
    "/browse",
    "/jobs",
    // The two Motari pages. /motari is where a ride is actually asked for and
    // /app is where the build is handed out; both were missing entirely, so
    // nothing about the moto side of the platform was discoverable at all.
    "/motari",
    "/app",
    "/donate",
    "/help",
    "/about",
    "/contact",
    "/blog",
    // /whats-new is deliberately absent: it 301s to /blog now, and listing a redirect in the
    // sitemap just asks Google to crawl a hop.
    "/privacy-policy",
    "/terms-and-conditions",
    "/signin",
    "/signup",
  ];

  const staticEntries: MetadataRoute.Sitemap = paths.map((path) => {
    const isMain = path === "";
    const isBrowseOrJobs = path.includes("browse") || path.includes("jobs");
    // Asking for a moto and getting the app are the two things a visitor most
    // often arrives wanting, so they rank with browse and jobs rather than with
    // the terms of service.
    const isMotari = path === "/motari" || path === "/app";
    const isInfo = path.includes("about") || path.includes("contact") || path === "/help";
    const isBlog = path === "/blog";
    const priority = isMain ? 1.0
      : isBrowseOrJobs || isMotari ? 0.9
      : isInfo || isBlog ? 0.7
      : 0.5;

    return {
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: (isMain || isBrowseOrJobs ? "daily"
        // A new build lands here whenever one is published, which is far more
        // often than the terms of service change.
        : isBlog || isMotari ? "weekly"
        : "monthly") as
        | "daily"
        | "weekly"
        | "monthly",
      priority,
      alternates: {
        languages: {
          en: `${SITE_URL}${path}?lang=en`,
          fr: `${SITE_URL}${path}?lang=fr`,
          sw: `${SITE_URL}${path}?lang=sw`,
          kin: `${SITE_URL}${path}?lang=kinyy`,
        },
      },
    };
  });

  /**
   * Individual posts. Each is a real page naming the brand - the corroboration Google needs before
   * it stops spell-correcting an unfamiliar name - so they must be discoverable, not just linked.
   * Posts are written in English only, so no hreflang alternates here.
   */
  const page = await fetchPosts({ size: 50 });
  const postEntries: MetadataRoute.Sitemap = (page?.content ?? []).map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.updatedAt ?? p.publishedAt ?? p.createdAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  /**
   * Worker profiles and open jobs. These are the only content that scales with the marketplace,
   * and each one is a real page naming the brand, so they matter more for the entity problem than
   * the handful of static routes above.
   *
   * They are listed only because the pages now render on the server. While they fetched in
   * useEffect a crawler got an empty shell, and submitting hundreds of those would have earned
   * "Crawled - currently not indexed" rather than coverage.
   *
   * The caps are deliberate. A sitemap may hold 50k URLs, so this is nowhere near the limit; the
   * ceiling exists to keep the crawl budget on the freshest records and the response quick to
   * generate. Raise it when the marketplace outgrows it.
   */
  const WORKER_LIMIT = 1000;
  const JOB_LIMIT = 1000;

  const [workerPage, jobPage] = await Promise.all([
    fetchWorkers({ size: WORKER_LIMIT }),
    fetchJobs({ size: JOB_LIMIT }),
  ]);

  const workerEntries: MetadataRoute.Sitemap = (workerPage?.content ?? []).map((w) => ({
    url: `${SITE_URL}/browse/${w.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  /**
   * Filled and closed listings are excluded on purpose: the page marks them noindex, and a sitemap
   * that advertises URLs we ask Google not to index is a contradiction that costs trust in the
   * whole file.
   */
  const jobEntries: MetadataRoute.Sitemap = (jobPage?.content ?? [])
    .filter((j) => j.status === "OPEN" && !j.applicationsClosed)
    .map((j) => ({
      url: `${SITE_URL}/jobs/${j.id}`,
      lastModified: new Date(j.createdAt),
      changeFrequency: "daily",
      priority: 0.6,
    }));

  return [...staticEntries, ...postEntries, ...workerEntries, ...jobEntries];
}
