import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Footer from "@/components/layout/footer";
import { ArticleSchema, BreadcrumbSchema } from "@/components/seo/json-ld";
import { BLOG_CATEGORY_LABELS } from "@/lib/api";
import { fetchPost, formatPostDate } from "@/lib/blog";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "./post.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return { title: "Post not found" };

  const description = post.excerpt ?? `An update from ${SITE_NAME}.`;
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description,
      url: `/blog/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : {}),
    },
    twitter: {
      card: post.coverImageUrl ? "summary_large_image" : "summary",
      title: post.title,
      description,
      ...(post.coverImageUrl ? { images: [post.coverImageUrl] } : {}),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;

  return (
    <main
      style={{
        background: "#111",
        minHeight: "100vh",
        color: "#f5f5f5",
        fontFamily: "Inter, DM Sans, system-ui, sans-serif",
      }}
    >
      <ArticleSchema
        title={post.title}
        description={post.excerpt}
        url={url}
        imageUrl={post.coverImageUrl}
        publishedAt={post.publishedAt}
        updatedAt={post.updatedAt}
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Blog", url: `${SITE_URL}/blog` },
          { name: post.title, url },
        ]}
      />

      <article style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 64px" }}>
        <Link
          href="/blog"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#777",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            marginBottom: 28,
          }}
        >
          <ArrowLeft size={14} /> All posts
        </Link>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#f97316",
            }}
          >
            {BLOG_CATEGORY_LABELS[post.category]}
          </span>
          <span style={{ fontSize: 12, color: "#555" }}>
            {formatPostDate(post.publishedAt ?? post.createdAt)}
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(27px, 5.5vw, 40px)",
            fontWeight: 900,
            color: "#fff",
            lineHeight: 1.12,
            letterSpacing: "-1.2px",
            margin: "0 0 16px",
          }}
        >
          {post.title}
        </h1>

        {post.excerpt && (
          <p style={{ fontSize: 16, color: "#8a8a8a", lineHeight: 1.75, margin: "0 0 28px" }}>
            {post.excerpt}
          </p>
        )}

        {post.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt=""
            style={{
              width: "100%",
              borderRadius: 14,
              border: "1px solid #272727",
              marginBottom: 32,
              display: "block",
            }}
          />
        )}

        {/* Sanitised on write (server-side allowlist), so it is safe to render as-is here. */}
        {post.bodyHtml && (
          <div className="post-body" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
        )}

        {post.ctaUrl && (
          <a
            href={post.ctaUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 34,
              background: "#f97316",
              color: "#fff",
              borderRadius: 10,
              padding: "12px 22px",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Check it out <ArrowRight size={15} />
          </a>
        )}
      </article>
      <Footer />
    </main>
  );
}
