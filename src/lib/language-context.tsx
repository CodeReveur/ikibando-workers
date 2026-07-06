"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import sw from "@/locales/sw.json";
import kinyy from "@/locales/kinyy.json";

type Language = "en" | "fr" | "sw" | "kinyy";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, any> = { en, fr, sw, kinyy };

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("kinyy");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let activeLang: Language | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryLang = params.get("lang") as Language;
      if (queryLang && ["en", "fr", "sw", "kinyy"].includes(queryLang)) {
        activeLang = queryLang;
        localStorage.setItem("MpahMapu_lang", queryLang);
      }
    }
    if (!activeLang) {
      const saved = localStorage.getItem("MpahMapu_lang") as Language;
      if (saved && (saved === "en" || saved === "fr" || saved === "sw" || saved === "kinyy")) {
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

  const t = (key: string, variables?: Record<string, string | number>): string => {
    const dict = translations[language] || translations["en"];
    const parts = key.split(".");
    let current = dict;

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        // Fallback to English
        let fallback = translations["en"];
        for (const fPart of parts) {
          if (fallback && typeof fallback === "object" && fPart in fallback) {
            fallback = fallback[fPart];
          } else {
            return key;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== "string") {
      return key;
    }

    let text = current;
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{${k}}`, "g"), String(v));
      });
    }

    return text;
  };

  const pathname = usePathname();

  // Dynamically set document title and html lang on path/lang changes
  useEffect(() => {
    if (typeof window === "undefined" || !mounted) return;
    
    // Set document language attribute
    document.documentElement.lang = language === "kinyy" ? "rw" : language;

    let titleKey = "home";
    const path = pathname || "/";
    if (path === "/") titleKey = "home";
    else if (path === "/browse") titleKey = "browse";
    else if (path.startsWith("/browse/")) titleKey = "browse";
    else if (path === "/jobs") titleKey = "jobs";
    else if (path.startsWith("/jobs/")) titleKey = "jobs";
    else if (path === "/about") titleKey = "about";
    else if (path === "/contact") titleKey = "contact";
    else if (path === "/privacy-policy") titleKey = "privacy_policy";
    else if (path === "/terms-and-conditions") titleKey = "terms_and_conditions";
    else if (path === "/signin") titleKey = "signin";
    else if (path === "/signup") titleKey = "signup";
    else if (path === "/forgot-password") titleKey = "forgot_password";
    else if (path === "/reset-password") titleKey = "reset_password";
    else if (path.startsWith("/verify/")) titleKey = "verify_badge";
    else titleKey = "not_found";

    const translatedTitle = t("titles." + titleKey);
    if (translatedTitle && translatedTitle !== "titles." + titleKey) {
      document.title = translatedTitle;
    }
  }, [language, mounted, pathname, t]);

  // Prevent hydration mismatches by returning default "kinyy" during SSR/initial client paint
  const value = {
    language: mounted ? language : "kinyy",
    setLanguage,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
