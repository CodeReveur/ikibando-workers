export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mpahmapu.com";
export const SITE_NAME = "MpahMapu";
export const SITE_DESCRIPTION = "Find verified workers instantly or get hired for a job today. Rwanda's trusted on-demand workforce platform for events, cleaning, security, driving, and more.";
export const SITE_LOCALE = "en_RW";

/**
 * Real raster logo for schema.org. A .ico is not a valid Organization logo — Google needs an
 * image it can render (min 112x112), and without one there's no logo in a knowledge panel.
 */
export const SITE_LOGO = `${SITE_URL}/logo-512.png`;

/**
 * Legitimate ways our own name gets written. Google spell-corrects unfamiliar brands, so it
 * needs the spacing/casing variants stated explicitly.
 *
 * Only genuine variants of OUR name belong here. Do NOT add "Mahmapu" or other near-misses
 * Google currently guesses at — that would be claiming a name that isn't ours, and would teach
 * search engines the wrong entity rather than correcting them.
 */
export const SITE_ALTERNATE_NAMES = ["Mpah Mapu", "Mpahmapu", "MPAHMAPU"];

/**
 * Profiles that prove this brand is a real, single entity. This is the strongest signal Google
 * uses to stop treating an unfamiliar name as a typo — an empty list means nothing corroborates
 * that "MpahMapu" exists.
 *
 * Set NEXT_PUBLIC_SOCIAL_PROFILES to a comma-separated list of full profile URLs
 * (LinkedIn, Facebook, Instagram, X, YouTube). Only list profiles you actually control:
 * pointing sameAs at a page that doesn't reference the site back is worthless or harmful.
 */
export const SOCIAL_PROFILES: string[] = (process.env.NEXT_PUBLIC_SOCIAL_PROFILES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Stable schema.org node ids, so Organization/WebSite/LocalBusiness merge into one entity. */
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const BUSINESS_PHONE = "+250781121117";
export const BUSINESS_EMAIL = "info@mpahmapu.com";
export const BUSINESS_ADDRESS = {
  streetAddress: "Kigali",
  addressLocality: "Kigali",
  addressRegion: "Kigali City",
  postalCode: "00000",
  addressCountry: "RW",
};
