import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /unsubscribe is a per-recipient action page - nothing to index, and no crawler
        // should be following opt-out links.
        disallow: ["/dashboard/", "/owner/", "/seeker/", "/api/", "/verify/", "/reset-password/", "/forgot-password/", "/unsubscribe"],
      },
      {
        userAgent: "GPTBot",
        allow: "/",
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
