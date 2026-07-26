/**
 * The origin the site actually answers on, and therefore the one every canonical, sitemap entry,
 * schema @id and og:url must use.
 *
 * It is www. The host 308s https://mpahmapu.com to https://www.mpahmapu.com, so the bare domain
 * is a redirect, not a home. This defaulted to the bare domain, which made every page declare a
 * canonical pointing at a URL that redirects straight back to the page declaring it. Google will
 * not follow that: it reported no user-declared canonical at all and picked the crawled URL
 * itself, and every sitemap entry cost it a redirect hop to discover a page it already had.
 *
 * If the redirect is ever flipped to strip www instead, change this to match. The rule is simply
 * that this constant and the host's redirect must agree.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mpahmapu.com";
export const SITE_NAME = "MpahMapu";
export const SITE_DESCRIPTION = "Find verified workers instantly or get hired for a job today. Rwanda's trusted on-demand workforce platform for events, cleaning, security, driving, and more.";
export const SITE_LOCALE = "en_RW";

/**
 * Real raster logo for schema.org. A .ico is not a valid Organization logo - Google needs an
 * image it can render (min 112x112), and without one there's no logo in a knowledge panel.
 */
export const SITE_LOGO = `${SITE_URL}/logo-512.png`;

/**
 * Legitimate ways our own name gets written. Google spell-corrects unfamiliar brands, so it
 * needs the spacing/casing variants stated explicitly.
 *
 * "Mpamapu" and its variants are ours: it is the spelling the backend itself uses (the Java
 * package is rw.MPAMAPU.server), so people who have seen it internally, and anyone who drops the
 * silent h, will search for it. Naming it here tells Google the two strings are one entity.
 *
 * Only genuine variants of OUR name belong here. Do NOT add "Mahmapuu" or the other near-misses
 * Google currently guesses at - those belong to somebody else, and claiming them would teach
 * search engines the wrong entity rather than correcting them.
 */
export const SITE_ALTERNATE_NAMES = [
  "Mpah Mapu",
  "Mpahmapu",
  "MPAHMAPU",
  "MpaMapu",
  "Mpamapu",
  "MPAMAPU",
];

/**
 * Profiles that prove this brand is a real, single entity. This is the strongest signal Google
 * has for deciding an unfamiliar name is a real thing rather than a typo, and while it was empty
 * nothing anywhere corroborated that "MpahMapu" exists - which is why a search for it offered a
 * similarly spelled stranger instead.
 *
 * Hard-coded rather than env-only: these are public brand facts, not secrets or per-environment
 * config, and leaving them to a variable meant they were simply never set. NEXT_PUBLIC_SOCIAL_PROFILES
 * still overrides, for a staging site that should not claim the real accounts.
 *
 * Every URL here is verified to resolve. Facebook is normalised to www; web.facebook.com is an
 * alternate host and sameAs should name the canonical one.
 *
 * Two caveats worth knowing, because sameAs only works as well as what it points at:
 *   - YouTube and X are branded "Ikibando", the previous name. Google reads the profile, so those
 *     currently argue the entity is Ikibando rather than MpahMapu. Renaming them, or at minimum
 *     putting MpahMapu in the profile name/bio, is what turns them from mixed signal into proof.
 *   - LinkedIn and Facebook are personal profiles, not a Company Page. For an Organization they
 *     are a category mismatch; a real Page would carry more weight.
 * In every case the profile should link back to https://www.mpahmapu.com. sameAs is a claim we
 * make; the link back is what corroborates it.
 */
const DEFAULT_SOCIAL_PROFILES = [
  "https://www.youtube.com/@Ikibandoh",
  "https://www.instagram.com/mpamapu/",
  "https://x.com/ikibandoh",
  "https://www.linkedin.com/in/mpah-mapu-524a6241b/",
  "https://www.facebook.com/profile.php?id=61591875575238",
];

export const SOCIAL_PROFILES: string[] = (() => {
  const fromEnv = (process.env.NEXT_PUBLIC_SOCIAL_PROFILES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_SOCIAL_PROFILES;
})();

/** Stable schema.org node ids, so Organization/WebSite/LocalBusiness merge into one entity. */
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const BUSINESS_PHONE = "+250781121117";
export const BUSINESS_EMAIL = "info@mpahmapu.com";
export const BUSINESS_ADDRESS = {
  streetAddress: "Rwanda",
  addressLocality: "Rwanda",
  addressRegion: "Rwanda City",
  postalCode: "00000",
  addressCountry: "RW",
};
