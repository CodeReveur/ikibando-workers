import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Verified Workers & Jobs in Rwanda",
  description:
    "Browse verified workers and available jobs in Rwanda. Find cleaners, security guards, event staff, drivers, electricians, and more on MpahMapu.",
  alternates: { canonical: "/browse" },
  openGraph: {
    title: "Browse Verified Workers & Jobs in Rwanda | MpahMapu",
    description:
      "Browse verified workers and available jobs in Rwanda. Find cleaners, security guards, event staff, drivers & more.",
    url: "/browse",
  },
};

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
