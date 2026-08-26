"use client";

/**
 * The Motari app, offered wherever someone is already standing still.
 *
 * It used to be a navbar tab, which crowded the bar on a phone and put the
 * offer in front of people who had not asked for anything yet. It reads better
 * further in: at the end of a donation, beside the help bot, under a list of
 * jobs, and as a small note over the map for the two people who most want it,
 * the passenger and the motari.
 *
 * Every shape here asks the server what there is to download first, and draws
 * nothing at all when there is no build. An offer that leads to a 404 is worse
 * than no offer.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bike, Download, X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface Build {
  android: boolean;
  /** A release asset, when the build is published as one. */
  url?: string;
  version?: string;
  sizeBytes?: number;
}

/**
 * What there is to download, asked once per page.
 *
 * `null` while the answer is still out, so nothing flashes in and out on a
 * slow connection; `false` once we know there is nothing to offer.
 */
function useBuild(): Build | null | false {
  const [build, setBuild] = useState<Build | null | false>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/app/info")
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        const info = d?.data as Build | undefined;
        setBuild(info?.android ? info : false);
      })
      .catch(() => { if (alive) setBuild(false); });
    return () => { alive = false; };
  }, []);

  return build;
}

/** The app's own mark: the same orange square and bike the phone shows. */
export function AppIcon({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.3),
        background: "#f97316", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Bike size={Math.round(size * 0.54)} color="#000" />
    </span>
  );
}

/**
 * A card for the body of a page: icon, name, a line about it, and the way in.
 *
 * The heading changes with where it stands, because "get the app" means
 * something different under a donation than it does under a list of jobs.
 */
export function AppCard({ blurb, compact = false, tone = "dark", style }: {
  blurb?: string;
  compact?: boolean;
  /** Most of the site is dark; the help page is not, and a black card there
   *  would read as something that had gone wrong rather than an offer. */
  tone?: "dark" | "light";
  style?: React.CSSProperties;
}) {
  const { t } = useLanguage();
  const build = useBuild();
  if (!build) return null;

  const light = tone === "light";

  return (
    <div style={{
      background: light ? "#fff" : "#0a0a0a",
      border: `1px solid ${light ? "#e5e7eb" : "#1f1f1f"}`,
      borderRadius: 16,
      padding: compact ? 16 : 20,
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap",
      ...style,
    }}>
      <AppIcon size={compact ? 36 : 44} />

      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{
          color: light ? "#111" : "#fff", fontSize: compact ? 13.5 : 15, fontWeight: 800,
          letterSpacing: "-0.01em", display: "flex", alignItems: "baseline", gap: 7,
        }}>
          {t("app.title") || "Motari"}
          {build.version && (
            <span style={{ color: light ? "#9ca3af" : "#5a5a5a", fontSize: 10.5, fontWeight: 600 }}>
              v{build.version}
            </span>
          )}
        </div>
        <div style={{
          color: light ? "#6b7280" : "#888",
          fontSize: 12.5, lineHeight: 1.55, marginTop: 3,
        }}>
          {blurb || t("app.subtitle") || "The moto taxi app for MpahMapu"}
        </div>
      </div>

      <Link
        href="/app"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#f97316", color: "#000", borderRadius: 11,
          padding: compact ? "9px 15px" : "11px 18px",
          fontSize: 12, fontWeight: 900, letterSpacing: "0.02em",
          textDecoration: "none", flexShrink: 0,
        }}
      >
        <Download size={14} /> {t("common.nav.get_app") || "Get the app"}
      </Link>
    </div>
  );
}

/**
 * The note over a full-screen map.
 *
 * Small, out of the way, and dismissible: someone in the middle of asking for
 * a moto is doing something more urgent than installing anything, and a banner
 * they cannot close is worse than no banner. Once closed it stays closed.
 */
export function AppTip({ storageKey, style }: { storageKey: string; style?: React.CSSProperties }) {
  const { t } = useLanguage();
  const build = useBuild();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    try {
      setShown(window.localStorage.getItem(storageKey) !== "1");
    } catch {
      // Storage denied: offer it, and let them close it for this visit.
      setShown(true);
    }
  }, [storageKey]);

  if (!build || !shown) return null;

  const dismiss = () => {
    setShown(false);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Nothing to remember it with; closed for now is still closed.
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9,
      background: "rgba(10,10,10,0.94)",
      border: "1px solid #2a2a2a",
      borderRadius: 12,
      padding: "8px 9px 8px 10px",
      ...style,
    }}>
      <AppIcon size={26} />
      <Link
        href="/app"
        style={{ flex: 1, minWidth: 0, textDecoration: "none" }}
      >
        <div style={{ color: "#fff", fontSize: 11.5, fontWeight: 800, lineHeight: 1.3 }}>
          {t("app.tip_title") || "Motari, on your phone"}
        </div>
        <div style={{ color: "#f97316", fontSize: 10.5, fontWeight: 700, marginTop: 1 }}>
          {t("common.nav.get_app") || "Get the app"}
        </div>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("common.buttons.close") || "Close"}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#666", padding: 4, lineHeight: 0, flexShrink: 0, fontFamily: "inherit",
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

/**
 * The slimmest shape: mark, name, and one word.
 *
 * For the hero, which already carries three buttons. A fourth would crowd the
 * one thing the page is actually asking people to do, so this sits under them
 * as a line rather than beside them as a rival.
 */
export function AppPill({ style }: { style?: React.CSSProperties }) {
  const { t } = useLanguage();
  const build = useBuild();
  if (!build) return null;

  return (
    <Link
      href="/app"
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "#0f0f0f", border: "1px solid #262626", borderRadius: 999,
        padding: "6px 14px 6px 7px", textDecoration: "none",
        ...style,
      }}
    >
      <AppIcon size={24} />
      <span style={{ color: "#e8e8e8", fontSize: 12.5, fontWeight: 700 }}>
        {t("app.title") || "Motari"}
      </span>
      <span style={{ color: "#3a3a3a", fontSize: 12 }}>·</span>
      <span style={{ color: "#f97316", fontSize: 12.5, fontWeight: 800 }}>
        {t("common.nav.get_app") || "Get the app"}
      </span>
    </Link>
  );
}

/** The footer's line: the mark and the name, rather than one more word in a list. */
export function AppFooterLink() {
  const { t } = useLanguage();
  const build = useBuild();
  if (!build) return null;

  return (
    <Link
      href="/app"
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        textDecoration: "none", color: "#ccc",
      }}
    >
      <AppIcon size={26} />
      <span>
        <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>
          {t("app.title") || "Motari"}
        </span>
        <span style={{ display: "block", fontSize: 10.5, color: "#f97316", fontWeight: 700 }}>
          {t("common.nav.get_app") || "Get the app"}
        </span>
      </span>
    </Link>
  );
}
