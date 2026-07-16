import { permanentRedirect } from "next/navigation";

/**
 * /whats-new and /blog had become the same page: a feature digest is a PRODUCT_UPDATE post, so
 * both were listing the same rows from the same table. Two URLs for one thing splits the ranking
 * signal and doubles the maintenance, so this is now the blog's product-update view.
 *
 * A permanent redirect rather than deleting the route: the footer, old emails and every
 * already-published notification link here, and those must keep working.
 */
export default function WhatsNewPage() {
  permanentRedirect("/blog?category=PRODUCT_UPDATE");
}
