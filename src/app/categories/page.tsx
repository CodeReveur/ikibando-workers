"use client";

import { useEffect, useMemo, useState } from "react";
import Footer from "@/components/layout/footer";
import { Search, Users, Briefcase, ChevronDown } from "lucide-react";
import { getCategoryStats, getJobCategories, type JobCategoryMeta } from "@/lib/api";
import { CATEGORIES, countsForCategory, keyForSlug, iconForSlug, type CategoryStats } from "@/lib/browse-taxonomy";
import { useLanguage } from "@/lib/language-context";
import { BreadcrumbSchema } from "@/components/seo/json-ld";

type Sort = "workers" | "jobs" | "name";

export default function CategoriesPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<CategoryStats>({});
  const [dbCats, setDbCats] = useState<JobCategoryMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("workers");

  useEffect(() => {
    getJobCategories().then(setDbCats).catch(() => {});
    getCategoryStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Each category with its live counts and a localized name for search + display. The list comes
  // from the admin-managed database so newly added categories appear automatically; the built-in
  // taxonomy is only a fallback until the DB list loads.
  const rows = useMemo(() => {
    const list = dbCats.length
      ? dbCats.map((c) => {
          const s = c.slug.toLowerCase();
          const name = t("common.categories." + s) || c.displayName;
          return { key: keyForSlug(c.slug), name, alt: c.displayName, Icon: iconForSlug(c.slug),
                   workers: stats[s]?.workers ?? 0, jobs: stats[s]?.jobs ?? 0 };
        })
      : CATEGORIES.map((c) => {
          const { workers, jobs } = countsForCategory(c, stats);
          return { key: c.key, name: t("common.categories." + c.key) || c.label, alt: c.label,
                   Icon: c.icon, workers, jobs };
        });
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter((c) => c.name.toLowerCase().includes(q) || c.alt.toLowerCase().includes(q))
      : list;
    filtered.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name)
      : sort === "jobs" ? b.jobs - a.jobs || b.workers - a.workers
      : b.workers - a.workers || b.jobs - a.jobs);
    return filtered;
  }, [dbCats, stats, search, sort, t]);

  const totalWorkers = useMemo(
    () => Object.values(stats).reduce((n, s) => n + (s.workers || 0), 0), [stats]);

  return (
    <main style={{ background: "#111", minHeight: "100vh", color: "#f5f5f5", fontFamily: "Inter, DM Sans, system-ui, sans-serif" }}>
      <BreadcrumbSchema items={[
        { name: "Home", url: "https://mpahmapu.com" },
        { name: "Categories", url: "https://mpahmapu.com/categories" },
      ]} />
      <style>{`
        .cats-grid { display:grid; grid-template-columns:1fr; gap:12px; }
        @container (min-width:420px){ .cats-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @container (min-width:680px){ .cats-grid{ grid-template-columns:repeat(3,minmax(0,1fr)); } }
        .cats-wrap{ container-type:inline-size; }
        select{ appearance:none;-webkit-appearance:none; }
        ::-webkit-scrollbar{ display:none; }
      `}</style>

      <div className="cats-wrap" style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px 64px" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.8px" }}>
          {t("categories_page.title") || "Categories"}
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
          {loading
            ? (t("jobs_page.loading") || "Loading…")
            : (t("categories_page.subtitle", { count: totalWorkers }) || `${totalWorkers.toLocaleString()} active workers across ${rows.length} categories`)}
        </p>

        {/* Search + sort */}
        <div style={{ display: "flex", gap: 10, margin: "22px 0 20px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <Search size={15} color="#555" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t("categories_page.search") || "Search categories…"}
              style={{ width: "100%", background: "#1c1c1c", border: "1px solid #272727", borderRadius: 999, padding: "10px 14px 10px 38px", fontSize: 13, color: "#f0f0f0", outline: "none" }}
            />
          </div>
          <div style={{ position: "relative" }}>
            <select
              value={sort} onChange={(e) => setSort(e.target.value as Sort)}
              style={{ background: "#1c1c1c", border: "1px solid #272727", borderRadius: 999, padding: "10px 34px 10px 14px", fontSize: 13, color: "#f0f0f0", cursor: "pointer", outline: "none" }}
            >
              <option value="workers">{t("categories_page.sort_workers") || "Most available workers"}</option>
              <option value="jobs">{t("categories_page.sort_jobs") || "Most open jobs"}</option>
              <option value="name">{t("categories_page.sort_name") || "Name (A–Z)"}</option>
            </select>
            <ChevronDown size={14} color="#555" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          </div>
        </div>

        {rows.length === 0 && !loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
            <p style={{ fontSize: 30, margin: "0 0 10px" }}>🔍</p>
            <p style={{ fontSize: 14, fontWeight: 600 }}>{t("categories_page.empty") || "No categories match your search."}</p>
          </div>
        ) : (
          <div className="cats-grid">
            {rows.map((c) => (
              <a
                key={c.key}
                href={`/browse?category=${c.key}`}
                style={{
                  background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14,
                  padding: "16px", textDecoration: "none", display: "flex", flexDirection: "column", gap: 12,
                  transition: "border-color .15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#272727")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <c.Icon size={19} color="#f97316" />
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#f0f0f0", overflowWrap: "anywhere", lineHeight: 1.3 }}>{c.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Users size={13} color={c.workers > 0 ? "#22c55e" : "#555"} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: c.workers > 0 ? "#22c55e" : "#555" }}>
                      {c.workers.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: "#555" }}>{t("categories_page.workers_word") || "workers"}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Briefcase size={12} color="#666" />
                    <span style={{ fontSize: 12, color: "#888" }}>{c.jobs.toLocaleString()} {t("categories_page.jobs_word") || "jobs"}</span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
