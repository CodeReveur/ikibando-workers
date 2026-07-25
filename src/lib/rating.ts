/**
 * Rating display helper.
 *
 * Every user is seeded at rating=5.0, ratingCount=1 on the server, and each
 * real review increments the count. So the number of genuine reviews is
 * `ratingCount - 1`. A worker with only the seed (0 real reviews) is still
 * shown with their star rating (the 5.0 seed) - just without a review count -
 * rather than a "New" label.
 */
export interface RatingInfo {
  /** True when the user has at least one genuine review (drives whether a count is shown). */
  hasReviews: boolean;
  /** One-decimal average always present, e.g. "5.0" for a seeded worker. */
  value: string;
  /** Number of genuine reviews (seed excluded). */
  reviews: number;
}

export function ratingInfo(
  rating: number | null | undefined,
  ratingCount: number | null | undefined,
): RatingInfo {
  const count = typeof ratingCount === "number" ? ratingCount : 0;
  const reviews = Math.max(0, count - 1);
  const value = (typeof rating === "number" ? rating : 5.0).toFixed(1);
  return { hasReviews: reviews > 0, value, reviews };
}

/** Short inline label, e.g. "4.8 (12)" or "5.0". */
export function ratingLabel(
  rating: number | null | undefined,
  ratingCount: number | null | undefined,
): string {
  const r = ratingInfo(rating, ratingCount);
  return r.hasReviews ? `${r.value} (${r.reviews})` : r.value;
}
