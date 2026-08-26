"use client";

/**
 * The app page: where the Motari build is handed out.
 *
 * It is linked from the navbar and the footer, so it is reachable from every
 * page of the site rather than only from the places a motari already knows to
 * look. The page asks the server what there is to download before offering a
 * button, because a download link that 404s is worse than one that is honestly
 * missing.
 */

import { useEffect, useState } from "react";
import { Bike, Download, Smartphone, MapPin, Bell, Wallet, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

type AppInfo = {
  android: boolean;
  ios: boolean;
  /** A release asset, when the build is published as one. */
  url?: string;
  version?: string;
  sizeBytes?: number;
  updatedAt?: string;
};

const mb = (bytes?: number) =>
  bytes ? `${(bytes / 1024 / 1024).toFixed(0)} MB` : "";

export default function AppPage() {
  const { t } = useLanguage();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/app/info")
      .then(r => r.json())
      .then(d => { if (alive) setInfo(d?.data ?? null); })
      .catch(() => { /* the page still explains itself without it */ })
      .finally(() => { if (alive) setAsked(true); });
    return () => { alive = false; };
  }, []);

  const card: React.CSSProperties = {
    background: "#0a0a0a",
    border: "1px solid #1f1f1f",
    borderRadius: 16,
    padding: 22,
  };

  const features = [
    { icon: <MapPin size={16} />, key: "nearby",
      fallback: ["A motari, where you are", "Ask from the map, or type the place. No account needed."] },
    { icon: <Bell size={16} />, key: "offers",
      fallback: ["Work that rings", "A motari hears every offer, even with the phone in a pocket."] },
    { icon: <Wallet size={16} />, key: "money",
      fallback: ["Money you can see", "Fares, the daily fee, payouts and every trip, in one place."] },
    { icon: <ShieldCheck size={16} />, key: "trust",
      fallback: ["Plates you can check", "Verified motari, and a price agreed before the ride starts."] },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px 70px" }}>

      {/* What it is */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
        <span style={{
          width: 56, height: 56, borderRadius: 17, background: "#f97316",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Bike size={30} color="#000" />
        </span>
        <div>
          <h1 style={{ color: "#fff", fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            {t("app.title") || "Motari"}
          </h1>
          <div style={{ color: "#888", fontSize: 13.5, marginTop: 2 }}>
            {t("app.subtitle") || "The moto taxi app for MpahMapu"}
          </div>
        </div>
      </div>

      <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.65, maxWidth: "62ch", margin: "14px 0 26px" }}>
        {t("app.blurb")
          || "Ask for a moto or send a delivery in a few taps, and follow it on the map. "
           + "Motari sign in to take the work, get paid, and settle the daily fee."}
      </p>

      {/* The download itself */}
      <div style={{ ...card, marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Smartphone size={16} color="#f97316" />
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>
            {t("app.get_it") || "Get the app"}
          </span>
          {info?.version && (
            <span style={{ color: "#666", fontSize: 11.5, marginLeft: "auto" }}>
              v{info.version}{info.sizeBytes ? ` · ${mb(info.sizeBytes)}` : ""}
            </span>
          )}
        </div>

        {/* A button is only offered when there is a build behind it. */}
        {info?.android ? (
          <a
            href={info.url || "/api/app/android"}
            {...(info.url ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              background: "#f97316", color: "#000", borderRadius: 12,
              padding: "13px 22px", fontSize: 13, fontWeight: 900,
              textDecoration: "none", letterSpacing: "0.02em",
            }}
          >
            <Download size={16} /> {t("app.download_android") || "Download for Android"}
          </a>
        ) : (
          <div style={{ color: "#888", fontSize: 12.5, lineHeight: 1.6 }}>
            {asked
              ? (t("app.not_ready") || "The Android build is not up yet. It will appear here as soon as it is.")
              : (t("app.checking") || "Checking…")}
          </div>
        )}

        <div style={{ color: "#666", fontSize: 11.5, lineHeight: 1.6, marginTop: 12 }}>
          {t("app.android_note")
            || "Android will ask you to allow installing this file. That is normal for an app that does not come from the Play Store."}
        </div>

        {!info?.ios && (
          <div style={{ color: "#555", fontSize: 11.5, marginTop: 10 }}>
            {t("app.ios_soon") || "iPhone: not yet. Use the website in the meantime, it does everything the app does."}
          </div>
        )}
      </div>

      {/* Why it is worth having */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12,
      }}>
        {features.map(f => (
          <div key={f.key} style={card}>
            <span style={{ color: "#f97316", display: "block", marginBottom: 9 }}>{f.icon}</span>
            <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>
              {t(`app.feature.${f.key}.title`) || f.fallback[0]}
            </div>
            <div style={{ color: "#888", fontSize: 12.5, lineHeight: 1.6 }}>
              {t(`app.feature.${f.key}.body`) || f.fallback[1]}
            </div>
          </div>
        ))}
      </div>

      {/* The website does the same job, for anyone who would rather not install. */}
      <div style={{ ...card, marginTop: 26 }}>
        <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>
          {t("app.no_install_title") || "Would rather not install anything?"}
        </div>
        <div style={{ color: "#888", fontSize: 12.5, lineHeight: 1.6, marginBottom: 12 }}>
          {t("app.no_install_body")
            || "Ask Motari works in the browser, and your phone can keep it on the home screen like an app."}
        </div>
        <a
          href="/motari"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            border: "1px solid #2a2a2a", color: "#fff", borderRadius: 10,
            padding: "10px 18px", fontSize: 12.5, fontWeight: 700, textDecoration: "none",
          }}
        >
          <Bike size={14} color="#f97316" /> {t("common.buttons.ask_motari") || "Ask Motari"}
        </a>
      </div>
    </div>
  );
}
