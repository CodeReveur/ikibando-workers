import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import Footer from "@/components/layout/footer";
import { PostRow } from "@/components/blog/post-row";
import { BreadcrumbSchema } from "@/components/seo/json-ld";
import type { BlogCategory } from "@/lib/api";
import { fetchPosts } from "@/lib/blog";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "./blog.css";

export const metadata: Metadata = {
  title: "Blog | Product updates, news & partnerships",
  description: `Product updates, company news, partnerships and recognitions from ${SITE_NAME}, Rwanda's on-demand workforce platform.`,
  alternates: { canonical: "/blog" },
  openGraph: {
    title: `Blog | ${SITE_NAME}`,
    description: `Product updates, company news, partnerships and recognitions from ${SITE_NAME}.`,
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
    <main className="blog-page">
      <BreadcrumbSchema
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Blog", url: `${SITE_URL}/blog` },
        ]}
      />

      <div className="blog-shell">
        <header className="blog-hero">
          <span className="blog-eyebrow">Blog</span>
          <h1 className="blog-title">
            What&apos;s new at
            <br />
            <span>{SITE_NAME}</span>
          </h1>
          <p className="blog-lede">
            Every feature we ship, plus the news, partnerships and recognitions behind them.
          </p>
        </header>

        <nav className="blog-filters" aria-label="Filter posts">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "ALL" ? "/blog" : `/blog?category=${f.value}`}
              className="blog-chip"
              data-active={f.value === active}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        {posts.length === 0 ? (
          <div className="blog-empty">
            <Newspaper size={24} className="blog-empty-icon" />
            <h2>{active === "ALL" ? "Nothing published yet" : "Nothing in this category yet"}</h2>
            <p>
              {active === "ALL"
                ? "We're just getting started. Every product update, partnership and announcement will land here first."
                : "Try another category - there may be posts filed elsewhere."}
            </p>
          </div>
        ) : (
          <div className="blog-list">
            {posts.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
