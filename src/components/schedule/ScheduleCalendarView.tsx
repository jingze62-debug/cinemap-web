"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Trash2 } from "lucide-react";
import type { Cinema } from "@/types/cinema";
import type { Film, Screening } from "@/types/film";
import {
  sortScreenings,
  timeToMinutes,
  computeGap,
  findOverlaps,
} from "@/utils/transitEngine";
import type { TransitMatrix, TravelModesMatrix } from "@/utils/dataLoader";
import { TransitBadge, OverlapConflictBadge } from "@/components/schedule/TransitBadge";
import { useDragScroll } from "@/hooks/useDragScroll";
import { cn } from "@/lib/utils";

/** Calendar grid layout (zoom applied via CSS transform) */
const METRICS = {
  pxPerMin: 1.2,
  colWidth: 176,
  gutterWidth: 44,
  headerHeight: 40,
  minCardHeight: 52,
} as const;

const CALENDAR_ZOOM_MIN = 0.35;
const CALENDAR_ZOOM_MAX = 2.4;
const CALENDAR_ZOOM_STEP = 0.1;
const CALENDAR_DEFAULT_ZOOM_MOBILE = 0.6;
const CALENDAR_DEFAULT_ZOOM_DESKTOP = 0.9;

function calendarDefaultZoom(): number {
  if (typeof window === "undefined") return CALENDAR_DEFAULT_ZOOM_MOBILE;
  return window.matchMedia("(min-width: 1024px)").matches
    ? CALENDAR_DEFAULT_ZOOM_DESKTOP
    : CALENDAR_DEFAULT_ZOOM_MOBILE;
}

function useIsMobileCalendar() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return mobile;
}
/** Festival days usually start mid-morning */
const DAY_START = 8 * 60;
/** Default end at midnight so 20:40→23:xx films aren't clipped */
const DAY_END_DEFAULT = 24 * 60;
/** Overnight / 通宵场 — extend into next calendar morning */
const DAY_END_MAX = 28 * 60; // 04:00 next day
/** Breathing room after the last screening ends */
const END_PAD_MIN = 60;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
/** Label + grid line every 2 hours (density / pxPerMin unchanged) */
const GRID_HOUR_STEP = 120;

const ACCENTS = [
  { border: "#e85d33", text: "#c4451a", bg: "rgba(232,93,51,0.11)" },
  { border: "#8a9a3a", text: "#6b7a28", bg: "rgba(138,154,58,0.12)" },
  { border: "#2f6fad", text: "#1e4f7a", bg: "rgba(47,111,173,0.11)" },
  { border: "#c45a8a", text: "#9a3d68", bg: "rgba(196,90,138,0.11)" },
  { border: "#3d8b6e", text: "#2a6b54", bg: "rgba(61,139,110,0.11)" },
] as const;

type ScheduleCalendarViewProps = {
  screenings: Screening[];
  filmsById: Map<string, Film>;
  cinemasById: Map<string, Cinema>;
  matrix: TransitMatrix;
  travelModes?: TravelModesMatrix;
  onRemove: (screeningId: string) => void;
  /** Highlight a screening card (desktop list → calendar sync) */
  highlightId?: string | null;
};

function screeningEndMin(s: Screening): number {
  let end = timeToMinutes(s.end);
  const start = timeToMinutes(s.start);
  if (end < start) end += 24 * 60;
  return end;
}

function accentFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

function formatDateHeader(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()} 周${WEEKDAYS[d.getDay()]}`;
}

function formatHourLabel(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

/** True when this hour mark is on the next calendar day (通宵). */
function isNextDayHour(totalMin: number): boolean {
  return totalMin >= 24 * 60;
}

/** Inclusive YYYY-MM-DD from first to last screening date (every day). */
function dateRangeInclusive(keys: string[]): string[] {
  if (keys.length === 0) return [];
  const sorted = [...keys].sort();
  const start = new Date(`${sorted[0]}T12:00:00`);
  const end = new Date(`${sorted[sorted.length - 1]}T12:00:00`);
  const out: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const d = new Date(t);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

function yPos(minOfDay: number, gridStart: number, pxPerMin: number) {
  return (minOfDay - gridStart) * pxPerMin;
}

function overlappingIdsForDay(dayScreenings: Screening[]): Set<string> {
  const ids = new Set<string>();
  for (const [a, b] of findOverlaps(dayScreenings)) {
    ids.add(a.id);
    ids.add(b.id);
  }
  return ids;
}

export function ScheduleCalendarView({
  screenings,
  filmsById,
  cinemasById,
  matrix,
  travelModes,
  onRemove,
  highlightId = null,
}: ScheduleCalendarViewProps) {
  const isMobile = useIsMobileCalendar();
  const metrics = METRICS;
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(CALENDAR_DEFAULT_ZOOM_MOBILE);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const [zoom, setZoom] = useState(CALENDAR_DEFAULT_ZOOM_MOBILE);

  const applyZoom = useCallback((next: number) => {
    const z = Math.min(CALENDAR_ZOOM_MAX, Math.max(CALENDAR_ZOOM_MIN, next));
    zoomRef.current = z;
    setZoom(z);
  }, []);

  const resetDefaultZoom = useCallback(() => {
    applyZoom(calendarDefaultZoom());
    scrollElRef.current?.scrollTo(0, 0);
  }, [applyZoom]);

  const {
    ref: bindDrag,
    dragging,
    suppressClickIfDragged,
  } = useDragScroll("both", { target: "self", includeTouch: isMobile });

  const setScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollElRef.current = node;
      bindDrag(node);
    },
    [bindDrag]
  );
  const sorted = useMemo(() => sortScreenings(screenings), [screenings]);

  const byDate = useMemo(() => {
    const map = new Map<string, Screening[]>();
    for (const s of sorted) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [sorted]);

  /** Every calendar day from earliest to latest screening */
  const dates = useMemo(
    () => dateRangeInclusive(Array.from(byDate.keys())),
    [byDate]
  );

  const { gridStart, gridEnd } = useMemo(() => {
    let start = DAY_START;
    let end = DAY_END_DEFAULT;
    for (const s of sorted) {
      start = Math.min(start, Math.floor(timeToMinutes(s.start) / 60) * 60);
      // Cover full runtime + pad (e.g. 20:40–23:20 → show through 00:00)
      const endWithPad = screeningEndMin(s) + END_PAD_MIN;
      end = Math.max(end, Math.ceil(endWithPad / 60) * 60);
    }
    start = Math.max(0, start);
    end = Math.max(start + 60, Math.min(DAY_END_MAX, end));
    return { gridStart: start, gridEnd: end };
  }, [sorted]);

  const spanMin = gridEnd - gridStart;
  const gridHeight = spanMin * metrics.pxPerMin;
  const hourMarks: number[] = [];
  for (let m = gridStart; m <= gridEnd; m += GRID_HOUR_STEP) hourMarks.push(m);

  const [activeIdx, setActiveIdx] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [focusedOverlapId, setFocusedOverlapId] = useState<string | null>(null);

  const contentW = metrics.gutterWidth + dates.length * metrics.colWidth;
  const contentH = metrics.headerHeight + gridHeight;
  const scaledW = contentW * zoom;
  const scaledH = contentH * zoom;
  const colStep = metrics.colWidth * zoom;

  const updateScrollHints = () => {
    const el = scrollElRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    const idx = Math.round(el.scrollLeft / colStep);
    setActiveIdx(Math.max(0, Math.min(dates.length - 1, idx)));
  };

  useEffect(() => {
    updateScrollHints();
    const el = scrollElRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollHints, { passive: true });
    const ro = new ResizeObserver(updateScrollHints);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollHints);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates.length, gridHeight, colStep]);

  useEffect(() => {
    resetDefaultZoom();
  }, [isMobile, dates.length, gridHeight, resetDefaultZoom]);

  useEffect(() => {
    if (
      focusedOverlapId &&
      !sorted.some((s) => s.id === focusedOverlapId)
    ) {
      setFocusedOverlapId(null);
    }
  }, [sorted, focusedOverlapId]);

  /** Trackpad wheel pan (desktop); pinch zoom (mobile). */
  useEffect(() => {
    const el = scrollElRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta =
          e.deltaY > 0 ? -CALENDAR_ZOOM_STEP / 2 : CALENDAR_ZOOM_STEP / 2;
        applyZoom(zoomRef.current + delta);
        return;
      }
      const canX = el.scrollWidth > el.clientWidth;
      const canY = el.scrollHeight > el.clientHeight;
      if (!canX && !canY) return;
      if (e.deltaX === 0 && e.deltaY === 0) return;
      e.preventDefault();
      if (canX) el.scrollLeft += e.deltaX;
      if (canY) el.scrollTop += e.deltaY;
      if (canX && !canY && e.deltaX === 0 && e.deltaY !== 0) {
        el.scrollLeft += e.deltaY;
      }
    };

    const touchDist = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const a = touches[0];
      const b = touches[1];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!isMobile || e.touches.length !== 2) {
        pinchRef.current = null;
        return;
      }
      pinchRef.current = {
        startDist: touchDist(e.touches),
        startZoom: zoomRef.current,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isMobile) return;
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const dist = touchDist(e.touches);
      if (pinchRef.current.startDist <= 0) return;
      applyZoom(
        pinchRef.current.startZoom * (dist / pinchRef.current.startDist)
      );
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isMobile, applyZoom, dates.length]);

  const scrollToDateIndex = (idx: number) => {
    const el = scrollElRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * colStep, behavior: "smooth" });
  };

  if (sorted.length === 0) {
    return (
      <div className="cm-frost-soft rounded-xl border-2 border-dashed border-ink/20 px-4 py-12 text-center font-mono text-sm font-semibold text-ink/40">
        还没有场次。去「选电影」加入日程吧。
      </div>
    );
  }

  return (
    <div className="space-y-2 lg:space-y-2.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="font-mono text-[10px] font-bold text-ink/50 lg:text-[11px]">
          <span className="text-accent">{"//"}</span> {sorted.length} 场 ·{" "}
          {dates.length} 天
        </p>
        <div className="flex items-center gap-1">
          <div
            className="flex items-center gap-0.5 rounded border border-ink/10 cm-frost-soft px-0.5 lg:px-1"
            aria-label="日程表缩放"
          >
            <button
              type="button"
              aria-label="缩小"
              onClick={() => applyZoom(zoomRef.current - CALENDAR_ZOOM_STEP)}
              className="rounded p-0.5 text-ink/45 hover:text-accent lg:p-1"
            >
              <Minus className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
            </button>
            <span className="min-w-[2.25rem] text-center font-mono text-[9px] font-bold tabular-nums text-ink/50 lg:text-[10px]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="放大"
              onClick={() => applyZoom(zoomRef.current + CALENDAR_ZOOM_STEP)}
              className="rounded p-0.5 text-ink/45 hover:text-accent lg:p-1"
            >
              <Plus className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
            </button>
          </div>
          {dates.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="上一天"
                  disabled={!canScrollLeft}
                  onClick={() => scrollToDateIndex(Math.max(0, activeIdx - 1))}
                  className="rounded border border-ink/12 cm-frost-soft p-1 text-ink/50 disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="下一天"
                  disabled={!canScrollRight}
                  onClick={() =>
                    scrollToDateIndex(Math.min(dates.length - 1, activeIdx + 1))
                  }
                  className="rounded border border-ink/12 cm-frost-soft p-1 text-ink/50 disabled:opacity-30"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
        </div>
      </div>

      {/* Film-gate calendar — slightly brighter than map, still translucent */}
      <div className="cm-cal-gate cm-frost relative overflow-hidden rounded-xl border border-ink/12 shadow-[0_10px_36px_color-mix(in_srgb,var(--ink)_10%,transparent)] lg:rounded-2xl">
        {canScrollLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-40 w-7 rounded-l-2xl bg-gradient-to-r from-panel-raised/75 via-panel-raised/30 to-transparent" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-40 w-8 rounded-r-2xl bg-gradient-to-l from-panel-raised/75 via-panel-raised/30 to-transparent" />
        )}
        {canScrollUp && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-7 rounded-t-2xl bg-gradient-to-b from-panel-raised/75 via-panel-raised/30 to-transparent" />
        )}
        {canScrollDown && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-8 rounded-b-2xl bg-gradient-to-t from-panel-raised/75 via-panel-raised/30 to-transparent" />
        )}

        <div
          ref={setScrollRef}
          onClickCapture={suppressClickIfDragged}
          className={cn(
            "relative touch-none overflow-auto overscroll-contain scrollbar-none select-none",
            "h-[min(58dvh,calc(100dvh-11.5rem))] lg:h-full lg:min-h-[20rem]",
            dragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <div
            className="relative"
            style={{ width: scaledW, height: scaledH }}
          >
            <div
              className="relative"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                width: contentW,
                height: contentH,
              }}
            >
            <div
              className="sticky top-0 z-30 flex border-b cm-cal-line bg-panel-raised/78 backdrop-blur-xl"
              style={{ height: metrics.headerHeight, paddingLeft: metrics.gutterWidth }}
            >
              {dates.map((date) => (
                <div
                  key={date}
                  className="flex shrink-0 items-center justify-center border-r cm-cal-line font-mono text-[11px] font-semibold text-ink/55 lg:text-[12px]"
                  style={{ width: metrics.colWidth }}
                >
                  {formatDateHeader(date)}
                </div>
              ))}
            </div>

            <div className="relative flex" style={{ height: gridHeight }}>
              <div
                className="sticky left-0 z-20 shrink-0 border-r cm-cal-line bg-panel-raised/70 backdrop-blur-lg"
                style={{ width: metrics.gutterWidth, height: gridHeight }}
              >
                {hourMarks.map((m) => {
                  const isFirst = m === gridStart;
                  const isLast = m === gridEnd;
                  const nextDay = isNextDayHour(m);
                  return (
                    <span
                      key={m}
                      className={cn(
                        "absolute right-1.5 font-mono text-[9px] font-medium leading-none lg:text-[10px]",
                        nextDay ? "text-accent/70" : "text-ink/40"
                      )}
                      style={{
                        top: yPos(m, gridStart, metrics.pxPerMin),
                        // Keep first/last labels inside the gate (avoid header clip)
                        transform: isFirst
                          ? "translateY(3px)"
                          : isLast
                            ? "translateY(calc(-100% - 2px))"
                            : "translateY(-50%)",
                      }}
                      title={nextDay ? "次日" : undefined}
                    >
                      {formatHourLabel(m)}
                      {nextDay ? (
                        <span className="ml-0.5 text-[8px] opacity-80">+1</span>
                      ) : null}
                    </span>
                  );
                })}
              </div>

              {dates.map((date) => {
                const dayScreenings = byDate.get(date) ?? [];
                const overlapIds = overlappingIdsForDay(dayScreenings);
                return (
                  <div
                    key={date}
                    className="relative shrink-0 border-r cm-cal-line bg-panel-raised/35"
                    style={{ width: metrics.colWidth, height: gridHeight }}
                  >
                    {hourMarks.map((m) => (
                      <div
                        key={m}
                        className="pointer-events-none absolute inset-x-0 border-t cm-cal-line"
                        style={{ top: yPos(m, gridStart, metrics.pxPerMin) }}
                      />
                    ))}

                    {dayScreenings.map((s) => {
                      const start = timeToMinutes(s.start);
                      const end = screeningEndMin(s);
                      const top = yPos(start, gridStart, metrics.pxPerMin);
                      const height = Math.max(
                        (end - start) * metrics.pxPerMin,
                        metrics.minCardHeight
                      );
                      const film = filmsById.get(s.filmId);
                      const cinema = cinemasById.get(s.cinemaId);
                      const accent = accentFor(s.filmId);
                      const tags = s.techTags.filter(Boolean);
                      const titleExtra =
                        tags.length > 0 ? ` (${tags[0]})` : "";
                      const isOverlapCard = overlapIds.has(s.id);
                      const isRaised =
                        isOverlapCard && focusedOverlapId === s.id;
                      const isHighlighted = highlightId === s.id;

                      return (
                        <article
                          key={s.id}
                          data-overlap-card={isOverlapCard ? "" : undefined}
                          data-highlight-card={isHighlighted ? "" : undefined}
                          role={isOverlapCard ? "button" : undefined}
                          tabIndex={isOverlapCard ? 0 : undefined}
                          onClick={() => {
                            if (isOverlapCard) setFocusedOverlapId(s.id);
                          }}
                          onKeyDown={(e) => {
                            if (
                              isOverlapCard &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              e.preventDefault();
                              setFocusedOverlapId(s.id);
                            }
                          }}
                          className={cn(
                            "absolute left-1.5 right-1.5 overflow-hidden rounded-lg border border-ink/10 shadow-[0_2px_10px_color-mix(in_srgb,var(--ink)_8%,transparent)] backdrop-blur-[1px] transition-[box-shadow,ring]",
                            isOverlapCard && "cursor-pointer",
                            isRaised || isHighlighted ? "z-[3]" : "z-[1]",
                            isRaised &&
                              "shadow-[0_4px_16px_color-mix(in_srgb,var(--ink)_14%,transparent)]",
                            isHighlighted &&
                              "ring-2 ring-accent ring-offset-1 ring-offset-paper"
                          )}
                          style={{
                            top,
                            height,
                            background: accent.bg,
                            borderLeftWidth: 3,
                            borderLeftColor: accent.border,
                          }}
                        >
                          <div className="flex h-full min-h-0 flex-col gap-0.5 p-1.5 pr-1">
                            <div className="flex items-start gap-1">
                              <h3
                                className="min-w-0 flex-1 line-clamp-2 text-[12px] font-bold leading-snug"
                                style={{ color: accent.text }}
                              >
                                {film?.titleZh ?? s.filmId}
                                {titleExtra}
                              </h3>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemove(s.id);
                                }}
                                className="shrink-0 rounded p-0.5 text-ink/30 hover:bg-ink/5 hover:text-accent"
                                aria-label="移出场次"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            <p className="font-mono text-[10px] font-medium text-ink/55">
                              {s.start}-{s.end}
                            </p>
                            {height >= 70 && (
                              <p className="truncate text-[10px] leading-snug text-ink/45">
                                {cinema?.nameZh ?? s.cinemaId}
                                {s.hall ? ` · ${s.hall}` : ""}
                                {typeof s.price === "number"
                                  ? ` · ¥${s.price}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}

                    {dayScreenings.slice(0, -1).map((s, i) => {
                      const next = dayScreenings[i + 1];
                      const endA = screeningEndMin(s);
                      const startB = timeToMinutes(next.start);
                      const gapMin = startB - endA;

                      if (gapMin <= 0) {
                        const overlapMin = Math.abs(gapMin);
                        const seamY = yPos(startB, gridStart, metrics.pxPerMin);
                        return (
                          <div
                            key={`gap-${s.id}-${next.id}`}
                            className="pointer-events-none absolute inset-x-0 z-[5] flex justify-end px-2"
                            style={{
                              top: seamY,
                              transform: "translateY(calc(-100% - 3px))",
                            }}
                          >
                            <OverlapConflictBadge overlapMin={overlapMin} />
                          </div>
                        );
                      }

                      const gapTop = yPos(endA, gridStart, metrics.pxPerMin);
                      const gapBottom = yPos(startB, gridStart, metrics.pxPerMin);
                      const gapH = Math.max(gapBottom - gapTop, 1);
                      const gap = computeGap(
                        s,
                        next,
                        matrix,
                        cinemasById,
                        travelModes
                      );

                      return (
                        <div
                          key={`gap-${s.id}-${next.id}`}
                          className="pointer-events-none absolute inset-x-0 z-[2]"
                          style={{ top: gapTop, height: gapH }}
                        >
                          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed cm-cal-line" />
                          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-1">
                            <TransitBadge gap={gap} compact />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </div>

        {/* Soft paper bleed — same language as map gate */}
        <div
          className="pointer-events-none absolute inset-0 z-[35] rounded-2xl"
          aria-hidden
        >
          <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_8%,transparent)]" />
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_center,transparent_56%,color-mix(in_srgb,var(--paper)_42%,transparent)_100%)]" />
          <div className="absolute inset-x-0 top-0 h-8 rounded-t-2xl bg-gradient-to-b from-paper/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-7 rounded-b-2xl bg-gradient-to-t from-paper/35 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-5 rounded-l-2xl bg-gradient-to-r from-paper/30 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-5 rounded-r-2xl bg-gradient-to-l from-paper/30 to-transparent" />
          <span className="absolute left-2 top-2 h-2.5 w-2.5 border-l-2 border-t-2 border-ink/20" />
          <span className="absolute right-2 top-2 h-2.5 w-2.5 border-r-2 border-t-2 border-ink/20" />
          <span className="absolute bottom-2 left-2 h-2.5 w-2.5 border-b-2 border-l-2 border-ink/20" />
          <span className="absolute bottom-2 right-2 h-2.5 w-2.5 border-b-2 border-r-2 border-ink/20" />
        </div>
      </div>
    </div>
  );
}
