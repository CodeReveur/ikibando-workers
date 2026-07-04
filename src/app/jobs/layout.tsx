import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Jobs in Kigali, Rwanda - MpahMapu",
  description:
    "Browse available jobs in Kigali, Rwanda. Find work as a waiter, cleaner, security guard, driver, event staff, and more. Get hired today on MpahMapu.",
  alternates: { canonical: "/jobs" },
  openGraph: {
    title: "Find Jobs in Kigali, Rwanda | MpahMapu",
    description:
      "Browse available jobs in Kigali. Find work as a waiter, cleaner, security guard, driver, event staff & more.",
    url: "/jobs",
  },
};

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
