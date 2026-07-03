/**
 * Rating display helper.
 *
 * Every user is seeded at rating=5.0, ratingCount=1 on the server, and each
 * real review increments the count. So the number of genuine reviews is
 * `ratingCount - 1`. A user with only the seed (0 real reviews) is shown as
 * "New" rather than a misleading "5.0 (1)".
 */
export interface RatingInfo {
  /** True when the user has at least one genuine review. */
  hasReviews: boolean;
  /** One-decimal average, e.g. "4.8". Empty when hasReviews is false. */
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
  if (reviews <= 0 || typeof rating !== "number") {
    return { hasReviews: false, value: "", reviews: 0 };
  }
  return { hasReviews: true, value: rating.toFixed(1), reviews };
}

/** Short inline label, e.g. "4.8 (12)" or "New". */
export function ratingLabel(
  rating: number | null | undefined,
  ratingCount: number | null | undefined,
): string {
  const r = ratingInfo(rating, ratingCount);
  return r.hasReviews ? `${r.value} (${r.reviews})` : "New";
}
