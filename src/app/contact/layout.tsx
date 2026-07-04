import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact MpahMapu - Get in Touch",
  description:
    "Contact MpahMapu for questions about hiring workers or finding jobs in Kigali, Rwanda. Reach us by email, phone, or WhatsApp.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact MpahMapu - Get in Touch",
    description:
      "Contact MpahMapu for questions about hiring workers or finding jobs in Kigali, Rwanda.",
    url: "/contact",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
