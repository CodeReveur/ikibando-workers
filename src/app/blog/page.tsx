import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import Footer from "@/components/layout/footer";
import { BreadcrumbSchema } from "@/components/seo/json-ld";
import { BLOG_CATEGORY_LABELS, type BlogCategory } from "@/lib/api";
import { fetchPosts, formatPostDate } from "@/lib/blog";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Blog — product updates, news & partnerships",
  description: `Company news, partnerships, recognitions and product updates from ${SITE_NAME}, Rwanda's on-demand workforce platform.`,
  alternates: { canonical: "/blog" },
  openGraph: {
    title: `Blog | ${SITE_NAME}`,
    description: `Company news, partnerships, recognitions and product updates from ${SITE_NAME}.`,
    url: "/blog",
    type: "website",
  },
};

const FILTERS: Array<{ value: BlogCategory | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PRODUCT_UPDATE", label: "Product updates" },
  { value: "NEWS", label: "Company news" },
  { value: "PARTNERSHIP", label: "Partnerships" },
  { value: "RECOGNITION", label: "Recognitions" },
];

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const active = (FILTERS.find((f) => f.value === category)?.value ?? "ALL") as
    | BlogCategory
    | "ALL";

  const page = await fetchPosts({
    category: active === "ALL" ? undefined : active,
    size: 24,
  });
  const posts = page?.content ?? [];

  return (
    <main
      style={{
        background: "#111",
        minHeight: "100vh",
        color: "#f5f5f5",
        fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}
    >
      <BreadcrumbSchema
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Blog", url: `${SITE_URL}/blog` },
        ]}
      />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 20px 64px" }}>
        {/* HERO */}
        <div style={{ marginBottom: 32 }}>
          <span
            style={{
              display: "inline-block",
              background: "rgba(249,115,22,0.1)",
              color: "#f97316",
              borderRadius: 999,
              padding: "4px 14px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Blog
          </span>
          <h1
            style={{
              fontSize: "clamp(30px, 6vw, 44px)",
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.05,
              letterSpacing: "-1.5px",
              margin: "0 0 14px",
            }}
          >
            News, partnerships &amp; product updates
          </h1>
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.75, maxWidth: 560, margin: 0 }}>
            Everything happening at {SITE_NAME} — what we&apos;ve shipped, who we&apos;re building
            with, and where we&apos;re going.
          </p>
        </div>

        {/* FILTERS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
          {FILTERS.map((f) => {
            const isActive = f.value === active;
            return (
              <Link
                key={f.value}
                href={f.value === "ALL" ? "/blog" : `/blog?category=${f.value}`}
                style={{
                  padding: "7px 15px",
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 700,
                  textDecoration: "none",
                  border: `1px solid ${isActive ? "#f97316" : "#272727"}`,
                  background: isActive ? "rgba(249,115,22,0.12)" : "#1a1a1a",
                  color: isActive ? "#f97316" : "#888",
                }}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* LIST */}
        {posts.length === 0 ? (
          <div
            style={{
              background: "#1c1c1c",
              border: "1px solid #272727",
              borderRadius: 14,
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <Newspaper size={26} color="#f97316" style={{ marginBottom: 10 }} />
            <p style={{ margin: 0, fontSize: 14, color: "#777" }}>
              Nothing here yet — check back soon.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/blog/${p.slug}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: "#1c1c1c",
                  border: "1px solid #272727",
                  borderRadius: 14,
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {p.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.coverImageUrl}
                    alt=""
                    style={{ width: "100%", height: 152, objectFit: "cover", display: "block" }}
                  />
                )}
                <div style={{ padding: "18px 18px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#f97316",
                      }}
                    >
                      {BLOG_CATEGORY_LABELS[p.category]}
                    </span>
                    <span style={{ fontSize: 11, color: "#555" }}>
                      {formatPostDate(p.publishedAt ?? p.createdAt)}
                    </span>
                  </div>
                  <h2
                    style={{
                      margin: "0 0 8px",
                      fontSize: 17,
                      fontWeight: 800,
                      color: "#fff",
                      letterSpacing: "-0.3px",
                      lineHeight: 1.3,
                    }}
                  >
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p style={{ margin: 0, fontSize: 13.5, color: "#888", lineHeight: 1.7 }}>
                      {p.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
