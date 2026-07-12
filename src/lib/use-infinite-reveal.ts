"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Infinite scroll for a client-filtered list: renders the first `batch` items and reveals more
 * whenever the sentinel scrolls into view, until the whole list is shown. Resets to `batch` when
 * the source list changes (e.g. a filter is applied). Attach `sentinelRef` to an element placed
 * right after the grid.
 */
export function useInfiniteReveal<T>(items: T[], batch = 16) {
  const [count, setCount] = useState(batch);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset the reveal window whenever the (memoised) list identity changes — i.e. filters/search.
  useEffect(() => { setCount(batch); }, [items, batch]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCount((c) => Math.min(c + batch, items.length));
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, batch]);

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    sentinelRef,
  };
}
