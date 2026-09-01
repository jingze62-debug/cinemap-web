"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

type DragState = {
  /** Pointer down recorded; pan not started until move threshold */
  armed: boolean;
  /** Actively panning */
  active: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  startScrollX: number;
  startScrollY: number;
  moved: boolean;
};

type DragScrollOptions = {
  /**
   * `window` — pan the page (default).
   * `self` — pan the ref element (`overflow: auto|scroll`).
   */
  target?: "window" | "self";
  /** Stop pointerdown bubbling (useful for nested chip rows). Default: true when target is `self`. */
  stopPropagation?: boolean;
  /**
   * Also pan with touch pointers (needed when native overflow scroll is unreliable,
   * e.g. nested modals). Default false — keep native touch scroll elsewhere.
   */
  includeTouch?: boolean;
};

function getWindowScroll(): { x: number; y: number } {
  return {
    x: window.scrollX || document.documentElement.scrollLeft || 0,
    y: window.scrollY || document.documentElement.scrollTop || 0,
  };
}

/**
 * Drag-to-pan.
 * Mouse: always. Touch: only when `includeTouch` (otherwise native scroll).
 * Clicks stay intact: pan only starts after a small move threshold.
 */
export function useDragScroll(
  axis: "y" | "x" | "both" = "y",
  options: DragScrollOptions = {}
): {
  ref: (node: HTMLDivElement | null) => void;
  dragging: boolean;
  suppressClickIfDragged: (e: ReactMouseEvent) => void;
} {
  const targetMode = options.target ?? "window";
  const stopPropagation =
    options.stopPropagation ?? targetMode === "self";
  const includeTouch = options.includeTouch ?? false;

  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState>({
    armed: false,
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startScrollX: 0,
    startScrollY: 0,
    moved: false,
  });

  const ref = useCallback((el: HTMLDivElement | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;

    const readScroll = () => {
      if (targetMode === "self") {
        return { x: node.scrollLeft, y: node.scrollTop };
      }
      return getWindowScroll();
    };

    const writeScroll = (x: number, y: number) => {
      if (targetMode === "self") {
        if (axis === "x" || axis === "both") node.scrollLeft = x;
        if (axis === "y" || axis === "both") node.scrollTop = y;
        return;
      }
      window.scrollTo(x, y);
    };

    const reset = () => {
      dragRef.current.armed = false;
      dragRef.current.active = false;
      dragRef.current.pointerId = -1;
      setDragging(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !includeTouch) return;
      // Multi-touch (pinch) — leave to other handlers
      if (e.pointerType === "touch" && (e as PointerEvent & { isPrimary?: boolean }).isPrimary === false) {
        reset();
        return;
      }
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      // Never arm over text fields / links — keep caret & navigation
      if (target?.closest("input, textarea, select, a, [data-no-drag]")) return;

      if (stopPropagation) e.stopPropagation();

      const { x, y } = readScroll();
      dragRef.current = {
        armed: true,
        active: false,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startScrollX: x,
        startScrollY: y,
        moved: false,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if ((!d.armed && !d.active) || d.pointerId !== e.pointerId) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const dist = Math.abs(dx) + Math.abs(dy);

      if (!d.active) {
        if (dist < 6) return;
        // Prefer dominant axis for nested rows (avoid diagonal page fight)
        if (targetMode === "self" && axis === "x" && Math.abs(dx) < Math.abs(dy)) {
          reset();
          return;
        }
        if (targetMode === "self" && axis === "y" && Math.abs(dy) < Math.abs(dx)) {
          reset();
          return;
        }
        d.active = true;
        d.moved = true;
        setDragging(true);
        try {
          node.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      e.preventDefault();
      let nextX = d.startScrollX;
      let nextY = d.startScrollY;
      if (axis === "x" || axis === "both") nextX = d.startScrollX - dx;
      if (axis === "y" || axis === "both") nextY = d.startScrollY - dy;
      writeScroll(nextX, nextY);
    };

    const onPointerUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d.pointerId !== e.pointerId) return;
      if (d.active) {
        try {
          node.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }
      // Keep `moved` until click capture can suppress it
      d.armed = false;
      d.active = false;
      d.pointerId = -1;
      setDragging(false);
    };

    node.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      reset();
      node.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [node, axis, targetMode, stopPropagation, includeTouch]);

  const suppressClickIfDragged = (e: ReactMouseEvent) => {
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current.moved = false;
    }
  };

  return { ref, dragging, suppressClickIfDragged };
}
