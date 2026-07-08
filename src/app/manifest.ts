import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

// Served at /manifest.webmanifest; Next auto-injects <link rel="manifest">.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Hire Verified Workers in Rwanda`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    lang: "en",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/coutput.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/coutput.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/coutput.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
