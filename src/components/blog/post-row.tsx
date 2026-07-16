import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BLOG_CATEGORY_LABELS, type BlogPost } from "@/lib/api";
import { formatPostDate } from "@/lib/blog";

/**
 * One post in the list.
 *
 * A row rather than an image card: posts are written by hand and most won't carry a cover, so a
 * grid of empty frames would look broken. The thumbnail is rendered only when there is one.
 */
export function PostRow({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="blog-row">
      <div className="blog-row-main">
        <div className="blog-meta">
          <span className="blog-cat">{BLOG_CATEGORY_LABELS[post.category]}</span>
          <span className="blog-dot" />
          <span className="blog-date">{formatPostDate(post.publishedAt ?? post.createdAt)}</span>
        </div>
        <h2 className="blog-row-title">{post.title}</h2>
        {post.excerpt && <p className="blog-excerpt">{post.excerpt}</p>}
        <span className="blog-read">
          Read <ArrowRight size={13} />
        </span>
      </div>

      {post.coverImageUrl && (
        <div className="blog-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImageUrl} alt="" loading="lazy" />
        </div>
      )}
    </Link>
  );
}
