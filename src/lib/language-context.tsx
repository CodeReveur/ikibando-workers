"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_LANGUAGE,
  htmlLang,
  isLanguage,
  resolveTitleKey,
  translate,
  type Language,
} from "@/lib/i18n-shared";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let activeLang: Language | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryLang = params.get("lang");
      if (isLanguage(queryLang)) {
        activeLang = queryLang;
        localStorage.setItem("MpahMapu_lang", queryLang);
      }
    }
    if (!activeLang) {
      const saved = localStorage.getItem("MpahMapu_lang");
      if (isLanguage(saved)) {
        activeLang = saved;
      }
    }
    if (activeLang) {
      setLanguageState(activeLang);
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("MpahMapu_lang", lang);
  };

  /**
   * Delegates to the shared translator so metadata generated on the server and text rendered on
   * the client can never disagree about what a key means.
   */
  const t = (key: string, variables?: Record<string, string | number>): string =>
    translate(mounted ? language : DEFAULT_LANGUAGE, key, variables);

  const pathname = usePathname();

  /**
   * Keep <html lang> and the tab title in step with the switcher, which changes language without
   * navigating, so the server-rendered title would otherwise stay frozen in the previous language.
   *
   * Only static routes are titled here. resolveTitleKey returns null for detail pages, which title
   * themselves from the record they render (see usePageTitle). Overwriting those with a generic key
   * is exactly the bug that made every blog post announce itself as "Page Not Found".
   */
  useEffect(() => {
    if (typeof window === "undefined" || !mounted) return;

    document.documentElement.lang = htmlLang(language);

    const titleKey = resolveTitleKey(pathname || "/");
    if (!titleKey) return;

    const key = `titles.${titleKey}`;
    const translatedTitle = t(key);
    if (translatedTitle && translatedTitle !== key) {
      document.title = translatedTitle;
    }
  }, [language, mounted, pathname, t]);

  // Prevent hydration mismatches by returning default "kinyy" during SSR/initial client paint
  const value = {
    language: mounted ? language : DEFAULT_LANGUAGE,
    setLanguage,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Let a page own its tab title.
 *
 * For pages the server already titled (a worker, a job), this is what keeps that title correct
 * after the visitor switches language: the server picked one language and cannot re-render.
 * Pass a fully-formed title, not a key, so callers can interpolate the record's own name.
 *
 * Safe against the provider's effect above, which only titles paths where resolveTitleKey is
 * non-null, and those are precisely the paths that never call this.
 */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (typeof document === "undefined" || !title) return;
    document.title = title;
  }, [title]);
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
