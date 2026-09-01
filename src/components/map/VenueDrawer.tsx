"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronUp,
  Copy,
  Sparkles,
  X,
} from "lucide-react";
import type { Cinema } from "@/types/cinema";
import { Button } from "@/components/ui/button";
import { TipBoard } from "@/components/map/TipBoard";
import { useDragScroll } from "@/hooks/useDragScroll";
import { cn } from "@/lib/utils";

type VenueDrawerProps = {
  cinema: Cinema | null;
  checkedIn: boolean;
  /** Animate sheet away, then clear selection */
  exiting?: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
  onToggleCheckIn: () => void;
  onOpenCheckInForm: () => void;
};

type SheetSnap = "open" | "peek" | "hidden";

const PEEK_VISIBLE_PX = 68;
const HIDDEN_BELOW_PX = 20;
const SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const SHEET_MS = 380;

function restingTranslateFor(
  snap: SheetSnap,
  peekTranslate: number,
  hiddenTranslate: number
) {
  if (snap === "hidden") return hiddenTranslate;
  if (snap === "peek") return peekTranslate;
  return 0;
}

function resolveSnap(
  current: number,
  peekTranslate: number,
  hiddenTranslate: number
): SheetSnap {
  const midPeekHidden = peekTranslate + (hiddenTranslate - peekTranslate) * 0.52;
  if (current >= midPeekHidden) return "hidden";
  if (current >= peekTranslate * 0.38) return "peek";
  return "open";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function VenueDrawer({
  cinema,
  checkedIn,
  exiting = false,
  onClose,
  onExitComplete,
  onToggleCheckIn,
  onOpenCheckInForm,
}: VenueDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>("hidden");
  const [sheetHeight, setSheetHeight] = useState(0);
  const [dragTranslate, setDragTranslate] = useState<number | null>(null);
  const [sheetDragging, setSheetDragging] = useState(false);
  const [dockReady, setDockReady] = useState(false);
  /** First paint of an open sits off-screen without transition */
  const [skipTransition, setSkipTransition] = useState(true);

  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetDragRef = useRef<{
    startY: number;
    startTranslate: number;
    startSnap: SheetSnap;
    pointerId: number;
    moved: boolean;
    totalDy: number;
  } | null>(null);
  const liveTranslateRef = useRef(0);
  const handleMovedRef = useRef(false);
  const enteredForIdRef = useRef<string | null>(null);

  const {
    ref: contentDragRef,
    dragging: contentDragging,
    suppressClickIfDragged,
  } = useDragScroll("y", { target: "self" });

  useEffect(() => {
    if (!cinema) {
      enteredForIdRef.current = null;
      setSnap("hidden");
      setSkipTransition(true);
      setDragTranslate(null);
      setSheetDragging(false);
      setDockReady(false);
      return;
    }
    // New venue — allow enter animation again
    if (enteredForIdRef.current !== cinema.id) {
      setSkipTransition(true);
      setSnap("hidden");
      setDragTranslate(null);
      setSheetDragging(false);
      setDockReady(false);
    }
  }, [cinema]);

  /** Slide up when a venue opens (or switches) */
  useEffect(() => {
    if (!cinema?.id || exiting) return;
    if (sheetHeight < 48) return;
    if (enteredForIdRef.current === cinema.id) return;
    enteredForIdRef.current = cinema.id;

    setSkipTransition(true);
    setSnap("hidden");
    setDragTranslate(null);
    setSheetDragging(false);
    setDockReady(false);
    sheetDragRef.current = null;

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      void sheetRef.current?.offsetHeight;
      raf2 = window.requestAnimationFrame(() => {
        setSkipTransition(false);
        setSnap("open");
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [cinema?.id, sheetHeight, exiting]);

  /** Parent asked to dismiss — slide down, then notify when done */
  useEffect(() => {
    if (!exiting) return;
    setSkipTransition(false);
    setSnap("hidden");
    setDragTranslate(null);
    setSheetDragging(false);
    sheetDragRef.current = null;
  }, [exiting]);

  useEffect(() => {
    if (!exiting) return;
    if (sheetDragging || dragTranslate !== null) return;
    const t = window.setTimeout(() => {
      onExitComplete?.();
    }, SHEET_MS + 30);
    return () => window.clearTimeout(t);
  }, [exiting, sheetDragging, dragTranslate, onExitComplete]);

  useEffect(() => {
    if (snap !== "hidden" || exiting) {
      setDockReady(false);
      return;
    }
    if (sheetDragging || dragTranslate !== null) return;

    const el = sheetRef.current;
    if (!el) {
      setDockReady(true);
      return;
    }

    const finish = () => setDockReady(true);
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === "transform") finish();
    };
    el.addEventListener("transitionend", onEnd);
    const t = window.setTimeout(finish, SHEET_MS + 40);
    return () => {
      el.removeEventListener("transitionend", onEnd);
      window.clearTimeout(t);
    };
  }, [snap, sheetDragging, dragTranslate, exiting]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const measure = () => setSheetHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cinema?.id]);

  const peekTranslate = Math.max(0, sheetHeight - PEEK_VISIBLE_PX);
  const hiddenTranslate = Math.max(peekTranslate + 1, sheetHeight + HIDDEN_BELOW_PX);
  const restingTranslate = restingTranslateFor(snap, peekTranslate, hiddenTranslate);
  const translateY = dragTranslate ?? restingTranslate;
  const isAnimating = dragTranslate === null && !sheetDragging;
  const collapseProgress =
    hiddenTranslate > 0 ? clamp(translateY / hiddenTranslate, 0, 1) : 0;

  const contentFadeStart = peekTranslate * 0.72;
  const contentOpacity =
    translateY <= contentFadeStart
      ? 1
      : 1 -
        clamp(
          (translateY - contentFadeStart) /
            Math.max(hiddenTranslate - contentFadeStart, 1),
          0,
          1
        );

  const sheetShellOpacity =
    1 - clamp((collapseProgress - 0.86) / 0.12, 0, 1);
  const dockOpacity = clamp((collapseProgress - 0.82) / 0.16, 0, 1);
  const showDock = !exiting && dockOpacity > 0.04;
  const contentInteractive =
    contentOpacity > 0.35 && translateY < peekTranslate + 24;

  const endSheetDrag = useCallback(
    (pointerId: number, captureTarget?: HTMLElement) => {
      const d = sheetDragRef.current;
      if (!d || d.pointerId !== pointerId) return;

      const current = liveTranslateRef.current;
      const nextSnap = resolveSnap(current, peekTranslate, hiddenTranslate);

      setSnap(nextSnap);
      setDragTranslate(null);
      setSheetDragging(false);
      sheetDragRef.current = null;

      if (captureTarget) {
        try {
          captureTarget.releasePointerCapture(pointerId);
        } catch {
          /* already released */
        }
      }
    },
    [hiddenTranslate, peekTranslate]
  );

  const onSheetPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = sheetDragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;

      const dy = e.clientY - d.startY;
      d.totalDy = dy;
      if (Math.abs(dy) > 4) {
        d.moved = true;
        handleMovedRef.current = true;
      }

      const next = clamp(d.startTranslate + dy, 0, hiddenTranslate);
      liveTranslateRef.current = next;
      setDragTranslate(next);
    },
    [hiddenTranslate]
  );

  const onSheetPointerUp = useCallback(
    (e: PointerEvent) => {
      endSheetDrag(e.pointerId);
    },
    [endSheetDrag]
  );

  useEffect(() => {
    if (!sheetDragging) return;
    window.addEventListener("pointermove", onSheetPointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", onSheetPointerUp);
    window.addEventListener("pointercancel", onSheetPointerUp);
    return () => {
      window.removeEventListener("pointermove", onSheetPointerMove);
      window.removeEventListener("pointerup", onSheetPointerUp);
      window.removeEventListener("pointercancel", onSheetPointerUp);
    };
  }, [sheetDragging, onSheetPointerMove, onSheetPointerUp]);

  const beginSheetDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const startTranslate = dragTranslate ?? restingTranslate;
    liveTranslateRef.current = startTranslate;
    handleMovedRef.current = false;
    sheetDragRef.current = {
      startY: e.clientY,
      startTranslate,
      startSnap: snap,
      pointerId: e.pointerId,
      moved: false,
      totalDy: 0,
    };
    setSheetDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onHandlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    beginSheetDrag(e);
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    endSheetDrag(e.pointerId, e.currentTarget);
  };

  const onHandleClick = () => {
    if (handleMovedRef.current) {
      handleMovedRef.current = false;
      return;
    }
    if (snap !== "open") setSnap("open");
  };

  if (!cinema) return null;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(cinema.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const sheetTransition =
    isAnimating && !skipTransition
      ? `transform ${SHEET_MS}ms ${SHEET_EASE}, opacity ${SHEET_MS}ms ${SHEET_EASE}`
      : "none";

  return (
    <>
      <div
        ref={sheetRef}
        style={{
          transform: `translateY(${translateY}px)`,
          opacity: sheetShellOpacity,
          transition: sheetTransition,
          pointerEvents:
            snap === "hidden" && !sheetDragging && dockReady
              ? "none"
              : "auto",
        }}
        className="cm-frost absolute inset-x-0 bottom-0 z-[500] flex max-h-[min(62%,calc(100%-0.5rem))] flex-col overflow-hidden rounded-t-2xl border-t border-ink/15 text-ink shadow-[0_-12px_40px_rgba(26,26,26,0.12)] will-change-transform"
        role="dialog"
        aria-label={`${cinema.nameZh} 详情`}
        aria-hidden={snap === "hidden" && dockReady}
      >
        <div
          data-sheet-handle
          className={cn(
            "relative shrink-0 touch-none select-none border-b border-ink/8",
            sheetDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          onPointerDown={onHandlePointerDown}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          onClick={onHandleClick}
          role="button"
          tabIndex={0}
          aria-label={
            snap === "hidden"
              ? "上拉展开影院详情"
              : snap === "peek"
                ? "上拉展开，或继续下拉查看地图"
                : "下拉收起以查看地图"
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setSnap((s) =>
                s === "open" ? "peek" : s === "peek" ? "hidden" : "open"
              );
            }
          }}
        >
          <div className="flex flex-col items-center px-4 pb-3 pt-3">
            <div
              className={cn(
                "h-1 rounded-full bg-ink/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-[width,background-color] duration-200",
                sheetDragging ? "w-12 bg-ink/35" : "w-10"
              )}
              aria-hidden
            />
          </div>

        <button
          type="button"
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-2.5 top-2 rounded-full p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={contentDragRef}
        onClickCapture={suppressClickIfDragged}
        style={{
          opacity: contentOpacity,
          transition: isAnimating && !skipTransition
            ? `opacity ${SHEET_MS}ms ${SHEET_EASE}`
            : "none",
        }}
        className={cn(
          "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-8 pt-3 scrollbar-none select-none touch-pan-y",
          !contentInteractive && "pointer-events-none",
          contentInteractive && contentDragging
            ? "cursor-grabbing"
            : contentInteractive && "cursor-grab"
        )}
        aria-hidden={!contentInteractive}
      >
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink/40">
            <span className="text-accent">{"//"}</span> Selected Venue
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">
                {cinema.nameZh}
              </h2>
              <p className="mt-1 text-xs text-ink/50">
                {cinema.district} · 影院 · 热度 {cinema.heat ?? 0}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={checkedIn ? "accent" : "default"}
                className={cn(
                  "text-xs font-bold",
                  !checkedIn &&
                    "border border-accent/35 bg-gradient-to-r from-accent-soft to-accent text-white shadow-sm hover:opacity-90"
                )}
                onClick={() =>
                  checkedIn ? onToggleCheckIn() : onOpenCheckInForm()
                }
              >
                {checkedIn ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> 已点亮
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> 我要打卡
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-ink/10 bg-white/70 p-3 text-center">
          <Stat
            value={checkedIn ? 1 : 0}
            label="我的点亮"
            highlight={checkedIn}
          />
          <Stat value={cinema.heat ?? 0} label="热度" />
        </div>

        {cinema.blurb && (
          <p className="text-sm leading-relaxed text-ink/60">{cinema.blurb}</p>
        )}

        <TipBoard cinemaId={cinema.id} />

        <button
          type="button"
          onClick={copyAddress}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink/10 bg-white/70 py-2.5 text-xs text-ink/65 hover:bg-white"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "已复制地址" : `复制地址 · ${cinema.address}`}
        </button>
      </div>
    </div>

      {showDock && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-3 z-[501] flex justify-center px-4"
          style={{
            opacity: dockOpacity,
            transition: isAnimating && !skipTransition
              ? `opacity ${SHEET_MS}ms ${SHEET_EASE}`
              : "none",
          }}
        >
          <button
            type="button"
            data-sheet-handle
            onPointerDown={onHandlePointerDown}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
            onClick={onHandleClick}
            style={{ pointerEvents: dockOpacity > 0.35 ? "auto" : "none" }}
            className={cn(
              "cm-venue-dock pointer-events-auto flex max-w-[min(100%,19rem)] flex-col items-center gap-1.5 px-3.5 pb-2 pt-2",
              !dockReady && dockOpacity > 0.5 && "animate-fade-up motion-reduce:animate-none",
              sheetDragging ? "cursor-grabbing" : "cursor-grab"
            )}
            aria-label={`展开 ${cinema.nameZh} 详情`}
            tabIndex={dockOpacity > 0.35 ? 0 : -1}
            aria-hidden={dockOpacity < 0.2}
          >
            <span className="cm-venue-dock-handle" aria-hidden />
            <span className="relative z-[1] flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate font-display text-[12px] font-bold leading-tight tracking-tight text-ink">
                {cinema.nameZh}
              </span>
              <span className="cm-venue-dock-chevron" aria-hidden>
                <ChevronUp className="h-3 w-3" strokeWidth={2.25} />
              </span>
            </span>
          </button>
        </div>
      )}
    </>
  );
}

function Stat({
  value,
  label,
  highlight,
}: {
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "font-display text-xl font-semibold",
          highlight ? "text-accent" : "text-ink"
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-ink/40">{label}</p>
    </div>
  );
}
