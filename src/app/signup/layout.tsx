import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account - Join MpahMapu",
  description:
    "Create your MpahMapu account. Join as a worker to find jobs or as an employer to hire verified workers in Kigali, Rwanda.",
  alternates: { canonical: "/signup" },
  robots: { index: true, follow: true },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
