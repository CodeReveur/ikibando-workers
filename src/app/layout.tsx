import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/navbar";
import { ContentWrapper } from "@/components/layout/content-wrapper";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ikibando",
    template: "%s | Ikibando",
  },
  description:
    "Find verified workers instantly or get hired for a job today. Rwanda's trusted on-demand workforce platform.",
  keywords: [
    "Ikibando",
    "Rwanda jobs",
    "Kigali jobs",
    "casual work",
    "temporary workers",
    "hire workers",
    "gig economy",
    "employment",
  ],
  authors: [
    {
      name: "Ikibando",
    },
  ],
  creator: "Ikibando",
  applicationName: "Ikibando",
  openGraph: {
    title: "Ikibando",
    description:
      "Find verified workers instantly or get hired for a job today.",
    url: "/",
    siteName: "Ikibando",
    locale: "en_RW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ikibando",
    description:
      "Find verified workers instantly or get hired for a job today.",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} min-h-screen bg-white text-gray-900 antialiased`}
      >
        <Navbar />
        <ContentWrapper>{children}</ContentWrapper>
      </body>
    </html>
  );
}