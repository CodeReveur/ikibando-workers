"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PageLike<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * Server-side filtered, paginated results.
 *
 * Browsing used to fetch one fixed slab of rows and filter it in the browser, so a filter
 * could only ever narrow what had already been loaded and anything past the slab was
 * unreachable. This drives the filters into the request instead: changing any of them
 * refetches from page 0, and "load more" appends the next page.
 *
 * Two races are handled explicitly, because both were visible as flicker on the old tables:
 *  - Responses can arrive out of order, so every request carries a ticket and only the
 *    newest one is allowed to write state. A slow early response can never overwrite a
 *    fast later one.
 *  - A "load more" already in flight when the filters change belongs to the old filter set,
 *    so its rows are dropped rather than appended to the new results.
 *
 * Filter changes are debounced so typing a search term costs one request, not one per key.
 */
export function usePagedResults<T>(
  fetchPage: (page: number) => Promise<PageLike<T>>,
  deps: readonly unknown[],
  { debounceMs = 350 }: { debounceMs?: number } = {},
) {
  const [items, setItems]             = useState<T[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [sentinel, setSentinel]       = useState<HTMLDivElement | null>(null);

  // Latest fetcher, read through a ref so a new closure each render does not restart the effect.
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const seqRef     = useRef(0);      // ticket of the newest first-page request
  const pageRef    = useRef(0);
  const hasMoreRef = useRef(false);
  const busyRef    = useRef(false);
  const firstRef   = useRef(true);   // the initial load should not wait out the debounce

  const key = JSON.stringify(deps);

  useEffect(() => {
    const ticket = ++seqRef.current;
    const wait   = firstRef.current ? 0 : debounceMs;
    firstRef.current = false;
    setLoading(true);

    const timer = setTimeout(() => {
      fetchRef.current(0).then(
        p => {
          if (seqRef.current !== ticket) return;   // superseded by a newer filter change
          const content = p.content ?? [];
          setItems(content);
          setTotal(Number(p.totalElements ?? content.length));
          pageRef.current = 0;
          const more = Number(p.totalPages) > 1;
          hasMoreRef.current = more;
          setHasMore(more);
          setLoading(false);
        },
        () => {
          if (seqRef.current !== ticket) return;
          setItems([]); setTotal(0);
          hasMoreRef.current = false; setHasMore(false);
          setLoading(false);
        },
      );
    }, wait);

    return () => clearTimeout(timer);
  }, [key, debounceMs]);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMoreRef.current) return;
    busyRef.current = true;
    const ticket = seqRef.current;   // the filter set this page belongs to
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const p = await fetchRef.current(next);
      if (seqRef.current !== ticket) return;   // filters changed mid-flight: these rows are stale
      setItems(prev => [...prev, ...(p.content ?? [])]);
      pageRef.current = next;
      const more = p.number + 1 < p.totalPages;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch {
      // Network hiccup: keep hasMore so the "Load more" button lets the user retry.
    } finally {
      busyRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  const sentinelRef = useCallback((el: HTMLDivElement | null) => setSentinel(el), []);

  // Scroll-position detection rather than an IntersectionObserver: an observer only fires on
  // visibility crossings, which silently never happen if it attaches at the wrong moment.
  useEffect(() => {
    if (!sentinel) return;
    const check = () => {
      if (busyRef.current || !hasMoreRef.current) return;
      const rect  = sentinel.getBoundingClientRect();
      const viewH = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top <= viewH + 300) loadMore();
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    document.addEventListener("scroll", check, { passive: true, capture: true });
    check();                                    // content shorter than the viewport: fill it now
    const iv = setInterval(check, 1500);        // belt and braces when no scroll events arrive
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      document.removeEventListener("scroll", check, { capture: true } as EventListenerOptions);
      clearInterval(iv);
    };
  }, [sentinel, loadMore]);

  return { items, total, loading, loadingMore, hasMore, loadMore, sentinelRef };
}
