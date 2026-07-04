import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About MpahMapu - Rwanda's Trusted Workforce Platform",
  description:
    "Learn about MpahMapu, Kigali's on-demand workforce platform connecting verified workers with employers for events, cleaning, security, and more.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About MpahMapu - Rwanda's Trusted Workforce Platform",
    description:
      "Learn about MpahMapu, Kigali's on-demand workforce platform connecting verified workers with employers.",
    url: "/about",
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
