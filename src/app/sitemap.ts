import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = [
    "",
    "/browse",
    "/jobs",
    "/about",
    "/contact",
    "/privacy-policy",
    "/terms-and-conditions",
    "/signin",
    "/signup",
  ];

  return paths.map((path) => {
    const isMain = path === "";
    const isBrowseOrJobs = path.includes("browse") || path.includes("jobs");
    const isInfo = path.includes("about") || path.includes("contact");
    const priority = isMain ? 1.0 : isBrowseOrJobs ? 0.9 : isInfo ? 0.7 : 0.5;

    return {
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: (isMain || isBrowseOrJobs) ? "daily" : "monthly",
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
}
