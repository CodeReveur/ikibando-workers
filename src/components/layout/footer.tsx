"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { AppFooterLink } from "@/components/app/get-the-app";
import { subscribeNewsletter } from "@/lib/api";

const WHATSAPP_URL = "https://chat.whatsapp.com/LJN7cg1PSGa2PXz4qk1tPy";

const IG_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.66 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.66-.67 1.07-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 00-1.38-2.13A5.9 5.9 0 0019.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 105.84 12 6.16 6.16 0 0012 5.84zM12 16a4 4 0 114-4 4 4 0 01-4 4zm6.41-10.85a1.44 1.44 0 11-1.44-1.44 1.44 1.44 0 011.44 1.44z"/></svg>
);
const WHATSAPP_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 01-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.44 9.44 0 01-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.9.99 6.69 2.78a9.4 9.4 0 012.77 6.7c-.01 5.22-4.26 9.47-9.48 9.47zm8.06-17.53A11.36 11.36 0 0012.04.5C5.76.5.66 5.6.66 11.87c0 2.01.53 3.97 1.53 5.7L.5 23.5l6.07-1.59a11.34 11.34 0 005.46 1.39h.01c6.28 0 11.38-5.1 11.38-11.37 0-3.04-1.18-5.9-3.32-8.06z"/></svg>
);

/** Social platforms - inline SVGs so we don't depend on a brand-icon package. */
const SOCIALS: { name: string; href: string; icon: React.ReactNode }[] = [
  { name: "Facebook", href: "https://web.facebook.com/profile.php?id=61591875575238", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>
  ) },
  { name: "Instagram", href: "https://www.instagram.com/mpamapu", icon: IG_ICON },
  { name: "TikTok", href: "https://www.tiktok.com/@mpahmapu", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
  ) },
  { name: "X", href: "https://x.com/ikibandoh", icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3L17.61 20.65z"/></svg>
  ) },
  { name: "YouTube", href: "https://www.youtube.com/@mpahmapu", icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3.02 3.02 0 00-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 00.5 6.2C0 8.09 0 12 0 12s0 3.91.5 5.8a3.02 3.02 0 002.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 002.12-2.14c.5-1.89.5-5.8.5-5.8s0-3.91-.5-5.8zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>
  ) },
];

export default function Footer() {
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const links = [
    { href: "/browse",  label: t("common.nav.browse")  },
    { href: "/jobs",    label: t("common.nav.jobs")    },
    { href: "/motari?register=1", label: t("motari.menu.register") || "Become a motari" },
    // "What's new" now lives inside the blog, so linking both would send people to one page twice.
    { href: "/blog",    label: t("common.nav.blog")    },
    { href: "/about",   label: t("common.nav.about")   },
    { href: "/contact", label: t("common.nav.contact") },
    { href: "/privacy-policy", label: t("common.nav.privacy") },
    { href: "/terms-and-conditions",   label: t("common.nav.terms")   },
  ];

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@") || state === "loading") return;
    setState("loading");
    try {
      await subscribeNewsletter(email.trim());
      setState("done");
      setEmail("");
    } catch {
      setState("error");
    }
  }

  return (
    <footer style={{
      borderTop: "1px solid #1e1e1e",
      maxWidth: 760, margin: "0 auto",
      padding: "28px 20px 44px",
      display: "flex", flexDirection: "column", gap: 22,
      fontFamily: "Inter, DM Sans, system-ui, sans-serif",
    }}>
      {/* Newsletter signup */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
        <div style={{ minWidth: 200 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#ccc" }}>
            {t("common.footer.newsletter_title") || "Get feature updates"}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#666" }}>
            {t("common.footer.newsletter_subtitle") || "New features and tips, straight to your inbox."}
          </p>
        </div>
        {state === "done" ? (
          <p style={{ margin: 0, fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
            {t("common.footer.newsletter_thanks") || "Thanks - you're subscribed!"}
          </p>
        ) : (
          <form onSubmit={handleSubscribe} style={{ display: "flex", gap: 8, flex: "1 1 260px", maxWidth: 340 }}>
            <input
              type="email"
              required
              value={email}
              onChange={e => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
              placeholder={t("common.footer.newsletter_placeholder") || "you@email.com"}
              style={{
                flex: 1, minWidth: 0, background: "#141414", border: "1px solid #2a2a2a",
                borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#fff",
                outline: "none", fontFamily: "inherit",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
              onBlur={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
            />
            <button
              type="submit"
              disabled={state === "loading"}
              style={{
                background: "#f97316", color: "#fff", border: "none", borderRadius: 8,
                padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                opacity: state === "loading" ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap",
              }}
            >
              {state === "loading"
                ? (t("common.buttons.sending") || "…")
                : (t("common.footer.newsletter_button") || "Subscribe")}
            </button>
          </form>
        )}
      </div>
      {state === "error" && (
        <p style={{ margin: "-12px 0 0", fontSize: 11, color: "#ef4444" }}>
          {t("common.footer.newsletter_error") || "Couldn't subscribe. Please try again."}
        </p>
      )}

      {/* Socials + WhatsApp community */}
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14,
        borderTop: "1px solid #141414", paddingTop: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#666" }}>
            {t("common.footer.follow_us") || "Follow us"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {SOCIALS.map(s => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                title={s.name}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 8, background: "#141414",
                  border: "1px solid #222", color: "#888", textDecoration: "none",
                  transition: "color 0.12s, border-color 0.12s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#f97316"; e.currentTarget.style.borderColor = "#f97316"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.borderColor = "#222"; }}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)",
            color: "#25D366", borderRadius: 10, padding: "9px 16px",
            fontSize: 12, fontWeight: 700, textDecoration: "none",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(37,211,102,0.18)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(37,211,102,0.1)")}
        >
          {WHATSAPP_ICON} {t("common.footer.join_community") || "Join our WhatsApp community"}
        </a>
      </div>

      {/* Brand + links */}
      <div style={{
        display: "flex", flexWrap: "wrap",
        justifyContent: "space-between", alignItems: "center", gap: 14,
        borderTop: "1px solid #141414", paddingTop: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 15, color: "#f97316" }}>MpahMapu</p>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "#444" }}>{t("common.footer.copyright")}</p>
          </div>
          <AppFooterLink />
        </div>
        {/* Two deliberate rows instead of one long wrapping line: site links on
            top, company/legal plus Donate below. Each row still wraps on tiny screens. */}
        {/* Mobile: one wrapping row, as it always was. Large screens: two rows
            sharing a left edge inside the right-aligned block. */}
        <style>{`
          .foot-links { display: flex; flex-wrap: wrap; gap: 18px; font-size: 12px; align-items: center; }
          .foot-row { display: contents; }
          @media (min-width: 720px) {
            .foot-links { flex-direction: column; flex-wrap: nowrap; gap: 10px; align-items: flex-start; }
            .foot-row { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; }
          }
        `}</style>
        <div className="foot-links">
          {[links.slice(0, 4), links.slice(4)].map((row, i) => (
            <div key={i} className="foot-row">
              {row.map(({ href, label }) => (
                <a key={href} href={href} style={{ color: "#444", textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#444")}
                >
                  {label}
                </a>
              ))}
              {i === 1 && (
                <a
                  href="/donate"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 12, fontWeight: 700, color: "#f97316", textDecoration: "none",
                  }}
                >
                  <HandCoins size={13} /> {t("donate.cta")}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
