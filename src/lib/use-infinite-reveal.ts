"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Infinite scroll for a client-filtered list: renders the first `batch` items and reveals more
 * whenever the sentinel scrolls into view, until the whole list is shown. Resets to `batch` when
 * the source list changes (e.g. a filter is applied). Attach `sentinelRef` to an element placed
 * right after the grid.
 *
 * The sentinel is a *callback ref*, not an object ref, on purpose. The sentinel is usually only
 * mounted once loading finishes (a render where the item count no longer changes), so an observer
 * wired to the item count would never attach and the list would sit forever on "Loading more…".
 * A callback ref fires exactly when the node mounts/unmounts, so the observer always attaches. We
 * also re-observe on each reveal so that if the sentinel is still on-screen after growing, the next
 * batch loads too (an IntersectionObserver does not re-fire while it stays intersecting).
 */
export function useInfiniteReveal<T>(items: T[], batch = 16) {
  const [count, setCount] = useState(batch);
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  // Keep the current length reachable from the observer callback without re-creating it.
  const lenRef = useRef(items.length);
  lenRef.current = items.length;

  // Reset the reveal window whenever the (memoised) list identity changes - i.e. filters/search.
  useEffect(() => { setCount(batch); }, [items, batch]);

  const sentinelRef = useCallback((el: HTMLDivElement | null) => { setNode(el); }, []);

  useEffect(() => {
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCount((c) => Math.min(c + batch, lenRef.current));
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, batch, count]);

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    sentinelRef,
  };
}
