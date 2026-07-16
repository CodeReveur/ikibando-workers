import type { MetadataRoute } from "next";
import { fetchPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";

/** Posts appear without a redeploy, but the sitemap isn't rebuilt on every crawl. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const paths = [
    "",
    "/browse",
    "/jobs",
    "/about",
    "/contact",
    "/blog",
    "/whats-new",
    "/privacy-policy",
    "/terms-and-conditions",
    "/signin",
    "/signup",
  ];

  const staticEntries: MetadataRoute.Sitemap = paths.map((path) => {
    const isMain = path === "";
    const isBrowseOrJobs = path.includes("browse") || path.includes("jobs");
    const isInfo = path.includes("about") || path.includes("contact");
    const isBlog = path === "/blog" || path === "/whats-new";
    const priority = isMain ? 1.0 : isBrowseOrJobs ? 0.9 : isInfo || isBlog ? 0.7 : 0.5;

    return {
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: (isMain || isBrowseOrJobs ? "daily" : isBlog ? "weekly" : "monthly") as
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
   * Individual posts. Each is a real page naming the brand — the corroboration Google needs before
   * it stops spell-correcting an unfamiliar name — so they must be discoverable, not just linked.
   * Posts are written in English only, so no hreflang alternates here.
   */
  const page = await fetchPosts({ size: 50 });
  const postEntries: MetadataRoute.Sitemap = (page?.content ?? []).map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.updatedAt ?? p.publishedAt ?? p.createdAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...postEntries];
}
