import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import sw from "@/locales/sw.json";
import kinyy from "@/locales/kinyy.json";

export type Language = "en" | "fr" | "sw" | "kinyy";

export const LANGUAGES: Language[] = ["en", "fr", "sw", "kinyy"];

/**
 * The platform defaults to English ("en") across the application.
 */
export const DEFAULT_LANGUAGE: Language = "en";

const dictionaries: Record<Language, unknown> = { en, fr, sw, kinyy };

export function isLanguage(value: string | null | undefined): value is Language {
  return !!value && (LANGUAGES as string[]).includes(value);
}

/** BCP-47 tag for <html lang> and og:locale. "kinyy" is our internal key; the web wants "rw". */
export function htmlLang(language: Language): string {
  return language === "kinyy" ? "rw" : language;
}

function lookup(dict: unknown, key: string): string | null {
  let current: unknown = dict;
  for (const part of key.split(".")) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof current === "string" ? current : null;
}

/**
 * Translate outside React - usable from generateMetadata, where hooks and context do not exist.
 * Mirrors the context's t(): English is the fallback, and an unresolvable key returns itself.
 */
/**
 * "common.categories.hotel_staff" → "Hotel staff". Used only when a key is missing,
 * so an untranslated string degrades to plain English rather than exposing the key.
 */
function humanizeKey(key: string): string {
  const last = String(key).split(".").pop() || key;
  const words = last.replace(/[_-]+/g, " ").trim();
  if (!words) return key;
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[i18n] missing translation key: ${key}`);
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function translate(
  language: Language,
  key: string,
  variables?: Record<string, string | number>,
): string {
  const text = lookup(dictionaries[language], key) ?? lookup(dictionaries.en, key);
  // A missing key must never be shown to a user as a raw dotted path
  // ("common.categories.hotel staff"). Fall back to a readable version of the last
  // segment instead, so the worst case is imperfect wording, not a broken-looking
  // screen. Callers that supply their own fallback still read fine.
  if (text == null) return humanizeKey(key);
  if (!variables) return text;
  return Object.entries(variables).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`{${k}}`, "g"), String(v)),
    text,
  );
}

/**
 * Which titles.* key owns a given path, or null when the page supplies its own title.
 *
 * Null is the important case. Detail pages (a worker, a job, a blog post) title themselves from
 * the record they render, and a generic key would overwrite the specific one. Previously every
 * unmatched path - including /blog/* and /whats-new - fell through to "not_found", so real pages
 * announced themselves as "Page Not Found" once the language effect ran.
 */
export function resolveTitleKey(pathname: string): string | null {
  const path = pathname || "/";

  if (path === "/") return "home";
  if (path === "/browse") return "browse";
  if (path === "/jobs") return "jobs";
  if (path === "/blog") return "blog";
  if (path === "/whats-new") return "whats_new";
  if (path === "/about") return "about";
  if (path === "/contact") return "contact";
  if (path === "/privacy-policy") return "privacy_policy";
  if (path === "/terms-and-conditions") return "terms_and_conditions";
  if (path === "/signin") return "signin";
  if (path === "/signup") return "signup";
  if (path === "/forgot-password") return "forgot_password";
  if (path === "/reset-password") return "reset_password";

  // Detail routes render a named record and set their own title on the server.
  if (path.startsWith("/browse/")) return null;
  if (path.startsWith("/jobs/")) return null;
  if (path.startsWith("/blog/")) return null;
  if (path.startsWith("/verify/")) return "verify_badge";

  if (path.endsWith("/settings")) return "settings";
  if (path.startsWith("/seeker") || path.startsWith("/owner")) return "dashboard";

  // Genuinely unrouted paths only - /unsubscribe and /map-demo are noindex utility pages and are
  // happy with the app-wide default title rather than a "not found" claim.
  return null;
}
