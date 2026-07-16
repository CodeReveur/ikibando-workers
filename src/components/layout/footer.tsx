"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { subscribeNewsletter } from "@/lib/api";

export default function Footer() {
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const links = [
    { href: "/browse",  label: t("common.nav.browse")  },
    { href: "/jobs",    label: t("common.nav.jobs")    },
    { href: "/whats-new", label: t("common.nav.whats_new") || "What's new" },
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
            {t("common.footer.newsletter_thanks") || "Thanks — you're subscribed!"}
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

      {/* Brand + links */}
      <div style={{
        display: "flex", flexWrap: "wrap",
        justifyContent: "space-between", alignItems: "center", gap: 14,
        borderTop: "1px solid #141414", paddingTop: 20,
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: 900, fontSize: 15, color: "#f97316" }}>MpahMapu</p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#444" }}>{t("common.footer.copyright")}</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12 }}>
          {links.map(({ href, label }) => (
            <a key={href} href={href} style={{ color: "#444", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
              onMouseLeave={e => (e.currentTarget.style.color = "#444")}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
