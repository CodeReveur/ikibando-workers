import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Footer from "@/components/layout/footer";
import { PostRow } from "@/components/blog/post-row";
import { ArticleSchema, BreadcrumbSchema } from "@/components/seo/json-ld";
import { BLOG_CATEGORY_LABELS } from "@/lib/api";
import { fetchPost, fetchPosts, formatPostDate, readingTime } from "@/lib/blog";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "../blog.css";
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
  const mins = readingTime(post.bodyHtml);

  // Reaching the end of a post shouldn't be a dead end. Fetched after the post, so a failure here
  // costs nothing - the section simply doesn't render.
  const more = await fetchPosts({ size: 4 });
  const related = (more?.content ?? []).filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <main className="blog-page">
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

      <article className="blog-shell">
        <Link href="/blog" className="post-back">
          <ArrowLeft size={14} /> All posts
        </Link>

        <div className="blog-meta">
          <span className="blog-cat">{BLOG_CATEGORY_LABELS[post.category]}</span>
          <span className="blog-dot" />
          <span className="blog-date">{formatPostDate(post.publishedAt ?? post.createdAt)}</span>
          {mins > 0 && (
            <>
              <span className="blog-dot" />
              <span className="blog-date">{mins} min read</span>
            </>
          )}
        </div>

        <h1 className="post-title">{post.title}</h1>
        {post.excerpt && <p className="post-lede">{post.excerpt}</p>}

        <hr className="post-rule" />

        {post.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImageUrl} alt="" className="post-cover" />
        )}

        {/* Sanitised on write (server-side allowlist), so it is safe to render as-is here. */}
        {post.bodyHtml && (
          <div className="post-body" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
        )}

        {post.ctaUrl && (
          <a href={post.ctaUrl} className="post-cta">
            Check it out <ArrowRight size={15} />
          </a>
        )}

        {related.length > 0 && (
          <section className="post-related">
            <h2>More from the blog</h2>
            <div className="blog-list">
              {related.map((p) => (
                <PostRow key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}
      </article>
      <Footer />
    </main>
  );
}
