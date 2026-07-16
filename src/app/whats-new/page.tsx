"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import Footer from "@/components/layout/footer";
import { BreadcrumbSchema } from "@/components/seo/json-ld";
import { useLanguage } from "@/lib/language-context";
import { getProductUpdates, type BlogPost } from "@/lib/api";

export default function WhatsNewPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Product updates are the PRODUCT_UPDATE slice of the blog — one source, two views.
  useEffect(() => {
    getProductUpdates()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return "";
    }
  }

  return (
    <main style={{
      background: "#111", minHeight: "100vh", color: "#f5f5f5",
      fontFamily: "Inter, DM Sans, system-ui, sans-serif",
    }}>
      <BreadcrumbSchema items={[
        { name: "Home", url: "https://mpahmapu.com" },
        { name: "What's New", url: "https://mpahmapu.com/whats-new" },
      ]} />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 64px" }}>

        {/* HERO */}
        <div style={{ marginBottom: 40 }}>
          <span style={{
            display: "inline-block", background: "rgba(249,115,22,0.1)", color: "#f97316",
            borderRadius: 999, padding: "4px 14px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18,
          }}>
            {t("whats_new.tag") || "What's new"}
          </span>
          <h1 style={{
            fontSize: "clamp(30px, 6vw, 44px)", fontWeight: 900, color: "#fff",
            lineHeight: 1.05, letterSpacing: "-1.5px", margin: "0 0 14px",
          }}>
            {t("whats_new.title") || "Latest features & updates"}
          </h1>
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.75, maxWidth: 500, margin: 0 }}>
            {t("whats_new.desc") || "Everything we've shipped recently on MpahMapu."}
          </p>
        </div>

        {/* LIST */}
        {loading ? (
          <p style={{ fontSize: 14, color: "#555" }}>{t("common.general.loading") || "Loading…"}</p>
        ) : items.length === 0 ? (
          <div style={{
            background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
            padding: "40px 24px", textAlign: "center",
          }}>
            <Sparkles size={26} color="#f97316" style={{ marginBottom: 10 }} />
            <p style={{ margin: 0, fontSize: 14, color: "#777" }}>
              {t("whats_new.empty") || "No announcements yet — check back soon."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {items.map(a => (
              <div key={a.id} style={{
                background: "#1c1c1c", border: "1px solid #272727",
                borderRadius: 14, padding: "22px 22px",
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#555", fontWeight: 600 }}>
                  {formatDate(a.publishedAt ?? a.createdAt)}
                </p>
                <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
                  {a.title}
                </h2>
                {a.excerpt && (
                  <p style={{ margin: 0, fontSize: 14, color: "#888", lineHeight: 1.7 }}>{a.excerpt}</p>
                )}
                <Link href={`/blog/${a.slug}`} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14,
                  color: "#f97316", fontSize: 13, fontWeight: 700, textDecoration: "none",
                }}>
                  {t("whats_new.cta") || "Check it out"} <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
