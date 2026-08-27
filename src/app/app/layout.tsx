import type { Metadata } from "next";

/**
 * What a crawler is told about the download page.
 *
 * The page itself is a client component, so it cannot declare any of this: a
 * search engine reading /app saw the site-wide title and description and had no
 * idea an app existed. Everything a person would search for to find it lives
 * here instead. "Moto" and "moto taxi" are what people say in Rwanda;
 * "boda boda" and "motorcycle taxi" are what people arriving from elsewhere
 * search for, and they are the same thing.
 */

const TITLE = "Ask Motari App - Moto Taxi App for Rwanda | Download for Android";

const DESCRIPTION =
  "Download Ask Motari, the moto taxi app for Kigali and Rwanda. Ask for a moto or send a "
  + "parcel in a few taps, agree the fare before you set off, and follow the ride on the map. "
  + "Free, no account needed to ask for a ride, and it works in English, French, Kinyarwanda "
  + "and Kiswahili.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Ask Motari",
    "Ask Motari app",
    "moto taxi app Rwanda",
    "moto taxi Kigali",
    "moto app Kigali",
    "motari app",
    "boda boda app Rwanda",
    "motorcycle taxi Kigali",
    "parcel delivery by moto Kigali",
    "MpahMapu app",
    "moto taxi app download Android",
  ],
  alternates: { canonical: "/app" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/app",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  // An APK is a real download, and a page offering one has nothing to hide.
  robots: { index: true, follow: true },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
