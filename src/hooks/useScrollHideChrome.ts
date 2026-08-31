"use client";

import { useCallback, useRef, useState, type UIEvent } from "react";

type Options = {
  /** Min scroll delta to toggle (px). */
  threshold?: number;
  /**
   * List must overflow by at least this many px before *direction*
   * hide is allowed. Bottom-of-list hide always applies.
   */
  minOverflow?: number;
  /** Treat as bottom when within this many px of the end. */
  bottomSlop?: number;
  /** Ignore scroll events this long after hiding (layout settle). */
  settleMs?: number;
};

/**
 * Hide filters when scrolling down or when the list reaches the bottom.
 * Reveal on scroll up (or via showFilters). Opacity transition lives in UI.
 */
export function useScrollHideChrome(options: Options = {}) {
  const threshold = options.threshold ?? 12;
  const minOverflow = options.minOverflow ?? 96;
  const bottomSlop = options.bottomSlop ?? 16;
  const settleMs = options.settleMs ?? 380;
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const raf = useRef(0);
  const lockUntil = useRef(0);
  const hiddenRef = useRef(false);

  const setHiddenSafe = useCallback((next: boolean) => {
    hiddenRef.current = next;
    setHidden(next);
  }, []);

  const hideWithSettle = useCallback(
    (now: number) => {
      if (hiddenRef.current) return;
      setHiddenSafe(true);
      lockUntil.current = now + settleMs;
    },
    [setHiddenSafe, settleMs]
  );

  const onScroll = useCallback(
    (e: UIEvent<HTMLElement>) => {
      const el = e.currentTarget;
      if (raf.current) return;
      raf.current = window.requestAnimationFrame(() => {
        raf.current = 0;
        const now = Date.now();
        const y = el.scrollTop;
        const overflow = Math.max(0, el.scrollHeight - el.clientHeight);
        const atBottom =
          overflow > 0 && y + el.clientHeight >= el.scrollHeight - bottomSlop;

        if (now < lockUntil.current) {
          lastY.current = el.scrollTop;
          return;
        }

        // Reached the end — filters must hide (with opacity transition in UI)
        if (atBottom) {
          lastY.current = y;
          hideWithSettle(now);
          return;
        }

        const dy = y - lastY.current;
        lastY.current = y;

        // Short column: don't hide from a tiny downward flick
        if (overflow < minOverflow) {
          if (dy < -threshold && hiddenRef.current) setHiddenSafe(false);
          return;
        }

        if (dy > threshold) {
          hideWithSettle(now);
        } else if (dy < -threshold) {
          if (hiddenRef.current) setHiddenSafe(false);
        }
      });
    },
    [
      threshold,
      minOverflow,
      bottomSlop,
      hideWithSettle,
      setHiddenSafe,
    ]
  );

  const showFilters = useCallback(() => {
    lockUntil.current = 0;
    setHiddenSafe(false);
  }, [setHiddenSafe]);

  return { filtersHidden: hidden, onScroll, showFilters };
}
