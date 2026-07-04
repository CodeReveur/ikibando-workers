import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In to MpahMapu",
  description:
    "Sign in to your MpahMapu account to hire workers or find jobs in Kigali, Rwanda.",
  alternates: { canonical: "/signin" },
  robots: { index: false, follow: true },
};

export default function SigninLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
