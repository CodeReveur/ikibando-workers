"use client";

/**
 * The app page: where the Ask Motari build is handed out.
 *
 * It is reached from the hero, the footer, both maps and half the pages on the
 * site, so it is the one place that has to do the whole job: say what the app
 * is, hand over the file, and walk somebody through installing it. That last
 * part matters more than it looks. An APK from outside the Play Store puts a
 * warning in front of people, and someone who was not told it was coming will
 * stop there and assume something is wrong.
 *
 * The page asks the server what there is to download before offering a button,
 * because a download link that 404s is worse than one that is honestly missing.
 */

import { useEffect, useState } from "react";
import { Bike, Download, Smartphone, MapPin, Bell, Wallet, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import Footer from "@/components/layout/footer";
import { MobileAppSchema, BreadcrumbSchema } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/seo";

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

/* The site's own vocabulary, rather than the near-black this page used to
   wear. It sat inside the same shell as every other page and did not look
   like it belonged to them. */
const CARD: React.CSSProperties = {
  background: "#161616",
  border: "1px solid #232323",
  borderRadius: 14,
  padding: 20,
};

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

  const steps = [
    t("app.install_1") || "Tap Download for Android. The file lands in your Downloads.",
    t("app.install_2") || "Open it. Android will ask whether to allow installing apps from this source. Allow it.",
    t("app.install_3") || "Tap Install, then Open.",
    t("app.install_4") || "Say yes to location, notifications and sound. Motari cannot find you, or ring when work arrives, without them.",
  ];

  return (
    <main style={{
      background: "#111", minHeight: "100vh", color: "#f5f5f5",
      fontFamily: "Inter, DM Sans, system-ui, sans-serif",
    }}>
      {/* Declared as software rather than prose, and carrying the numbers off
          the release that is actually published rather than any written here. */}
      <MobileAppSchema
        version={info?.version}
        sizeBytes={info?.sizeBytes}
        updatedAt={info?.updatedAt}
        downloadUrl={info?.url}
      />
      <BreadcrumbSchema items={[
        { name: "Home", url: SITE_URL },
        { name: "Ask Motari app", url: `${SITE_URL}/app` },
      ]} />
      {/* 760 is the width of the navbar above it and of every other page on the
          site. This one was 900, so it visibly overhung the bar it sits under. */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 56px" }}>

        {/* What it is */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <span style={{
            width: 54, height: 54, borderRadius: 16, background: "#f97316",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Bike size={28} color="#000" />
          </span>
          <div>
            <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 900, letterSpacing: "-0.8px", margin: 0 }}>
              {t("app.title") || "Ask Motari"}
            </h1>
            <div style={{ color: "#8a8a8a", fontSize: 13, marginTop: 2 }}>
              {t("app.subtitle") || "The moto taxi app for MpahMapu"}
            </div>
          </div>
        </div>

        <p style={{ color: "#9a9a9a", fontSize: 14, lineHeight: 1.7, maxWidth: "62ch", margin: "14px 0 24px" }}>
          {t("app.blurb")
            || "Ask for a moto or send a delivery in a few taps, and follow it on the map. "
             + "Motari sign in to take the work, get paid, and settle the daily fee."}
        </p>

        {/* The download itself */}
        <div style={{ ...CARD, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Smartphone size={16} color="#f97316" />
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>
              {t("app.get_it") || "Get the app"}
            </span>
            {info?.version && (
              <span style={{ color: "#6a6a6a", fontSize: 11.5, marginLeft: "auto" }}>
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
                background: "#f97316", color: "#000", borderRadius: 11,
                padding: "13px 22px", fontSize: 13, fontWeight: 900,
                textDecoration: "none", letterSpacing: "0.02em",
              }}
            >
              <Download size={16} /> {t("app.download_android") || "Download for Android"}
            </a>
          ) : (
            <div style={{ color: "#8a8a8a", fontSize: 12.5, lineHeight: 1.6 }}>
              {asked
                ? (t("app.not_ready") || "The Android build is not up yet. It will appear here as soon as it is.")
                : (t("app.checking") || "Checking…")}
            </div>
          )}

          <div style={{ color: "#6a6a6a", fontSize: 11.5, lineHeight: 1.6, marginTop: 12 }}>
            {t("app.size_note") || "About 55 MB. On mobile data that is roughly the size of a short video."}
          </div>
        </div>

        {/* How to get it onto a phone. The part that was missing. */}
        <div style={{ ...CARD, marginBottom: 16 }}>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, marginBottom: 14 }}>
            {t("app.install_title") || "Installing it"}
          </div>

          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
            {steps.map((step, i) => (
              <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  background: "rgba(249,115,22,0.12)", color: "#f97316",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900,
                }}>
                  {i + 1}
                </span>
                <span style={{ color: "#9a9a9a", fontSize: 12.5, lineHeight: 1.65 }}>{step}</span>
              </li>
            ))}
          </ol>

          <div style={{
            color: "#6a6a6a", fontSize: 11.5, lineHeight: 1.6,
            marginTop: 16, paddingTop: 14, borderTop: "1px solid #232323",
          }}>
            {t("app.install_note")
              || "Nothing is charged and no account is needed to ask for a moto. "
               + "Motari sign in with the account they registered on this site."}
          </div>

          {!info?.ios && (
            <div style={{ color: "#5a5a5a", fontSize: 11.5, marginTop: 10 }}>
              {t("app.ios_soon") || "iPhone: not yet. Use the website in the meantime, it does everything the app does."}
            </div>
          )}
        </div>

        {/* Why it is worth having */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12,
        }}>
          {features.map(f => (
            <div key={f.key} style={CARD}>
              <span style={{ color: "#f97316", display: "block", marginBottom: 9 }}>{f.icon}</span>
              <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>
                {t(`app.feature.${f.key}.title`) || f.fallback[0]}
              </div>
              <div style={{ color: "#8a8a8a", fontSize: 12.5, lineHeight: 1.6 }}>
                {t(`app.feature.${f.key}.body`) || f.fallback[1]}
              </div>
            </div>
          ))}
        </div>

        {/* The website does the same job, for anyone who would rather not install. */}
        <div style={{ ...CARD, marginTop: 16 }}>
          <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>
            {t("app.no_install_title") || "Would rather not install anything?"}
          </div>
          <div style={{ color: "#8a8a8a", fontSize: 12.5, lineHeight: 1.6, marginBottom: 12 }}>
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

      <Footer />
    </main>
  );
}
