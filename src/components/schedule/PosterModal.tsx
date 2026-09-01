"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { CalendarDays, Download, ListOrdered, X } from "lucide-react";
import type { Cinema } from "@/types/cinema";
import type { Film, Screening } from "@/types/film";
import { Button } from "@/components/ui/button";
import { TransitBadge, OverlapConflictBadge } from "@/components/schedule/TransitBadge";
import { cn } from "@/lib/utils";
import {
  computeGap,
  sortScreenings,
  timeToMinutes,
} from "@/utils/transitEngine";
import type { TransitMatrix, TravelModesMatrix } from "@/utils/dataLoader";
import { useDragScroll } from "@/hooks/useDragScroll";
import {
  POSTER_THEMES,
  posterThemeById,
  type PosterLayout,
  type PosterTheme,
  type PosterThemeId,
} from "@/components/schedule/posterThemes";

type PosterItem = {
  screening: Screening;
  film: Film;
  cinema?: Cinema;
};

type PosterModalProps = {
  open: boolean;
  planName: string;
  items: PosterItem[];
  totalPrice: number;
  cinemasById: Map<string, Cinema>;
  matrix: TransitMatrix;
  travelModes?: TravelModesMatrix;
  onClose: () => void;
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** Export calendar: wide day columns + short time rows → horizontal 2h cells */
const PX_PER_MIN = 0.44;
const COL_WIDTH = 128;
const GUTTER_WIDTH = 28;
const HEADER_HEIGHT = 24;
const DAY_START = 8 * 60;
const DAY_END_DEFAULT = 24 * 60;
const DAY_END_MAX = 28 * 60;
const END_PAD_MIN = 45;
/** Export calendar grid: label + line every 2 hours */
const GRID_HOUR_STEP = 120;

const ACCENTS = [
  { border: "#e85d33", text: "#c4451a", bg: "rgba(232,93,51,0.11)" },
  { border: "#8a9a3a", text: "#6b7a28", bg: "rgba(138,154,58,0.12)" },
  { border: "#2f6fad", text: "#1e4f7a", bg: "rgba(47,111,173,0.11)" },
  { border: "#c45a8a", text: "#9a3d68", bg: "rgba(196,90,138,0.11)" },
  { border: "#3d8b6e", text: "#2a6b54", bg: "rgba(61,139,110,0.11)" },
] as const;

function accentFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

function screeningEndMin(s: Screening): number {
  let end = timeToMinutes(s.end);
  const start = timeToMinutes(s.start);
  if (end < start) end += 24 * 60;
  return end;
}

function formatDateHeader(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS[d.getDay()]}`;
}

function formatHourLabel(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

function isNextDayHour(totalMin: number): boolean {
  return totalMin >= 24 * 60;
}

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

function yPos(minOfDay: number, gridStart: number) {
  return (minOfDay - gridStart) * PX_PER_MIN;
}

/** Preview fills leftover modal space. touch-none: pan via useDragScroll(includeTouch). */
const PREVIEW_VIEWPORT =
  "h-full min-h-[12rem] w-full touch-none select-none overflow-auto overscroll-contain rounded-lg border scrollbar-none [-webkit-overflow-scrolling:touch] lg:min-h-[min(52vh,520px)]";

const PREVIEW_ZOOM_MIN = 0.45;
const PREVIEW_ZOOM_MAX = 2.8;
const PREVIEW_ZOOM_STEP = 0.15;
/** Calendar preview: 60% mobile, 90% desktop (lg). */
const CALENDAR_DEFAULT_ZOOM_MOBILE = 0.6;
const CALENDAR_DEFAULT_ZOOM_DESKTOP = 0.9;

function calendarDefaultZoom(): number {
  if (typeof window === "undefined") return CALENDAR_DEFAULT_ZOOM_MOBILE;
  return window.matchMedia("(min-width: 1024px)").matches
    ? CALENDAR_DEFAULT_ZOOM_DESKTOP
    : CALENDAR_DEFAULT_ZOOM_MOBILE;
}

function clampZoom(n: number) {
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, n));
}

function ListPoster({
  planName,
  items,
  totalPrice,
  theme,
}: {
  planName: string;
  items: PosterItem[];
  totalPrice: number;
  theme: PosterTheme;
}) {
  return (
    <div
      className="min-h-full w-full min-w-[21rem] max-w-[26rem] rounded-xl border px-5 py-5"
      style={{
        background: theme.surface,
        borderColor: theme.border,
        color: theme.ink,
      }}
    >
      <div
        className="border-b border-dashed pb-3.5"
        style={{ borderColor: theme.dashed }}
      >
        <p
          className="font-mono text-[9px] font-bold uppercase tracking-[0.16em]"
          style={{ color: theme.inkFaint }}
        >
          CineMap · Schedule
        </p>
        <p className="mt-1 font-display text-xl font-black leading-tight tracking-tight">
          {planName}
        </p>
        <p
          className="mt-1.5 font-mono text-[11px] leading-relaxed"
          style={{ color: theme.inkMuted }}
        >
          {items.length} 场 · ¥{totalPrice} · 按时间顺序
        </p>
      </div>
      <ul className="mt-3">
        {items.map(({ screening: s, film, cinema }, i) => (
          <li
            key={s.id}
            className={cn("flex gap-4 py-3.5", i > 0 && "border-t")}
            style={i > 0 ? { borderColor: theme.borderLight } : undefined}
          >
            <div
              className="w-[5.25rem] shrink-0 font-mono text-[11px] leading-relaxed"
              style={{ color: theme.inkMuted }}
            >
              <p className="text-[13px] font-bold leading-none" style={{ color: theme.ink }}>
                {s.date.slice(5).replace("-", "/")}
              </p>
              <p className="mt-1.5 whitespace-nowrap">
                {s.start}
                <span className="px-0.5" style={{ color: theme.inkFaint }}>
                  –
                </span>
                {s.end}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-snug tracking-tight">
                {film.titleZh}
              </p>
              <p
                className="mt-1.5 break-words font-mono text-[10px] leading-relaxed"
                style={{ color: theme.inkMuted }}
              >
                {cinema?.nameZh ?? s.cinemaId}
                {s.hall ? ` · ${s.hall}` : ""}
                {typeof s.price === "number" ? ` · ¥${s.price}` : ""}
              </p>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li
            className="py-6 text-center font-mono text-xs"
            style={{ color: theme.inkFaint }}
          >
            暂无场次
          </li>
        )}
      </ul>
      <p
        className="mt-4 border-t border-dashed pt-2.5 font-mono text-[9px]"
        style={{ borderColor: theme.dashed, color: theme.inkFaint }}
      >
        Generated locally · CineMap
      </p>
    </div>
  );
}

function CalendarPoster({
  planName,
  items,
  totalPrice,
  cinemasById,
  matrix,
  travelModes,
  theme,
}: {
  planName: string;
  items: PosterItem[];
  totalPrice: number;
  cinemasById: Map<string, Cinema>;
  matrix: TransitMatrix;
  travelModes?: TravelModesMatrix;
  theme: PosterTheme;
}) {
  const screenings = useMemo(
    () => sortScreenings(items.map((i) => i.screening)),
    [items]
  );

  const filmsById = useMemo(() => {
    const map = new Map<string, Film>();
    for (const item of items) map.set(item.film.id, item.film);
    return map;
  }, [items]);

  const byDate = useMemo(() => {
    const map = new Map<string, Screening[]>();
    for (const s of screenings) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [screenings]);

  const dates = useMemo(
    () => dateRangeInclusive(Array.from(byDate.keys())),
    [byDate]
  );

  const { gridStart, gridEnd } = useMemo(() => {
    let start = DAY_START;
    let end = DAY_END_DEFAULT;
    for (const s of screenings) {
      start = Math.min(start, Math.floor(timeToMinutes(s.start) / 60) * 60);
      end = Math.max(
        end,
        Math.min(DAY_END_MAX, Math.ceil(screeningEndMin(s) / 60) * 60 + END_PAD_MIN)
      );
    }
    return { gridStart: start, gridEnd: end };
  }, [screenings]);

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = gridStart; m <= gridEnd; m += GRID_HOUR_STEP) marks.push(m);
    return marks;
  }, [gridStart, gridEnd]);

  const gridHeight = (gridEnd - gridStart) * PX_PER_MIN;

  return (
    <div
      className="min-h-full w-fit rounded-lg border"
      style={{
        background: theme.surface,
        borderColor: theme.border,
        color: theme.ink,
      }}
    >
      <div
        className="border-b border-dashed px-2.5 py-2"
        style={{ borderColor: theme.dashed }}
      >
        <p
          className="font-mono text-[8px] font-bold uppercase tracking-[0.16em]"
          style={{ color: theme.inkFaint }}
        >
          CineMap · Calendar
        </p>
        <p className="mt-0.5 font-display text-base font-black tracking-tight">
          {planName}
        </p>
        <p
          className="mt-0.5 font-mono text-[10px]"
          style={{ color: theme.inkMuted }}
        >
          {items.length} 场 · {dates.length} 天 · ¥{totalPrice}
        </p>
      </div>

      {dates.length === 0 ? (
        <p
          className="px-2.5 py-6 text-center font-mono text-xs"
          style={{ color: theme.inkFaint }}
        >
          暂无场次
        </p>
      ) : (
        <div className="overflow-hidden px-1.5 pb-1.5 pt-1.5">
          <div
            className="relative rounded-md border"
            style={{
              width: GUTTER_WIDTH + dates.length * COL_WIDTH,
              height: HEADER_HEIGHT + gridHeight,
              background: theme.grid,
              borderColor: theme.border,
            }}
          >
            <div
              className="absolute left-0 right-0 top-0 z-10 flex border-b"
              style={{
                height: HEADER_HEIGHT,
                paddingLeft: GUTTER_WIDTH,
                background: theme.gridHeader,
                borderColor: theme.border,
              }}
            >
              {dates.map((date) => (
                <div
                  key={date}
                  className="flex shrink-0 items-center justify-center border-r font-mono text-[9px] font-semibold"
                  style={{
                    width: COL_WIDTH,
                    borderColor: theme.borderLight,
                    color: theme.inkMuted,
                  }}
                >
                  {formatDateHeader(date)}
                </div>
              ))}
            </div>

            <div
              className="absolute left-0 top-0 z-10 border-r"
              style={{
                width: GUTTER_WIDTH,
                height: HEADER_HEIGHT + gridHeight,
                paddingTop: HEADER_HEIGHT,
                background: theme.gridHeader,
                borderColor: theme.border,
              }}
            >
              {hourMarks.map((m) => {
                const isFirst = m === gridStart;
                const isLast = m === gridEnd;
                const nextDay = isNextDayHour(m);
                return (
                  <span
                    key={m}
                    className="absolute right-1 font-mono text-[8px] font-medium leading-none"
                    style={{
                      top: HEADER_HEIGHT + yPos(m, gridStart),
                      color: nextDay ? theme.overnight : theme.inkFaint,
                      transform: isFirst
                        ? "translateY(2px)"
                        : isLast
                          ? "translateY(calc(-100% - 1px))"
                          : "translateY(-50%)",
                    }}
                  >
                    {formatHourLabel(m)}
                    {nextDay ? (
                      <span className="ml-0.5 text-[6px] opacity-80">+1</span>
                    ) : null}
                  </span>
                );
              })}
            </div>

            <div
              className="absolute left-0 top-0"
              style={{
                paddingLeft: GUTTER_WIDTH,
                paddingTop: HEADER_HEIGHT,
                height: HEADER_HEIGHT + gridHeight,
              }}
            >
              <div className="relative flex" style={{ height: gridHeight }}>
                {dates.map((date) => {
                  const dayScreenings = byDate.get(date) ?? [];
                  return (
                    <div
                      key={date}
                      className="relative shrink-0 border-r"
                      style={{
                        width: COL_WIDTH,
                        height: gridHeight,
                        background: theme.gridCell,
                        borderColor: theme.borderLight,
                      }}
                    >
                      {hourMarks.map((m) => (
                        <div
                          key={m}
                          className="pointer-events-none absolute inset-x-0 border-t"
                          style={{
                            top: yPos(m, gridStart),
                            borderColor: theme.borderLight,
                          }}
                        />
                      ))}

                      {dayScreenings.map((s) => {
                        const start = timeToMinutes(s.start);
                        const end = screeningEndMin(s);
                        const top = yPos(start, gridStart);
                        const height = Math.max((end - start) * PX_PER_MIN, 28);
                        const film = filmsById.get(s.filmId);
                        const cinema = cinemasById.get(s.cinemaId);
                        const accent = accentFor(s.filmId);
                        const tags = s.techTags.filter(Boolean);
                        const titleExtra =
                          tags.length > 0 ? ` (${tags[0]})` : "";

                        return (
                          <article
                            key={s.id}
                            className="absolute left-1 right-1 z-[1] overflow-hidden rounded-md border"
                            style={{
                              top,
                              height,
                              background: accent.bg,
                              borderColor: theme.borderLight,
                              borderLeftWidth: 2,
                              borderLeftColor: accent.border,
                            }}
                          >
                            <div className="flex h-full min-h-0 flex-col gap-0.5 p-1">
                              <h3
                                className="line-clamp-2 text-[9px] font-bold leading-snug"
                                style={{ color: accent.text }}
                              >
                                {film?.titleZh ?? s.filmId}
                                {titleExtra}
                              </h3>
                              <p
                                className="font-mono text-[8px] font-medium"
                                style={{ color: theme.inkMuted }}
                              >
                                {s.start}-{s.end}
                              </p>
                              {height >= 52 && (
                                <p
                                  className="truncate text-[8px] leading-snug"
                                  style={{ color: theme.inkFaint }}
                                >
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
                          const seamY = yPos(startB, gridStart);
                          return (
                            <div
                              key={`gap-${s.id}-${next.id}`}
                              className="pointer-events-none absolute inset-x-0 z-[5] flex justify-end px-1"
                              style={{
                                top: seamY,
                                transform: "translateY(calc(-100% - 2px))",
                              }}
                            >
                              <OverlapConflictBadge overlapMin={overlapMin} />
                            </div>
                          );
                        }

                        const gapTop = yPos(endA, gridStart);
                        const gapBottom = yPos(startB, gridStart);
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
                            <div
                              className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed"
                              style={{ borderColor: theme.border }}
                            />
                            <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-0.5">
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
      )}

      <p
        className="border-t border-dashed px-2.5 py-1.5 font-mono text-[8px]"
        style={{ borderColor: theme.dashed, color: theme.inkFaint }}
      >
        Generated locally · CineMap
      </p>
    </div>
  );
}

export function PosterModal({
  open,
  planName,
  items,
  totalPrice,
  cinemasById,
  matrix,
  travelModes,
  onClose,
}: PosterModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const previewElRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<PosterLayout>("calendar");
  const [themeId, setThemeId] = useState<PosterThemeId>("cream");
  const [zoom, setZoom] = useState(1);
  const [contentSize, setContentSize] = useState({ w: 0, h: 0 });
  const theme = posterThemeById(themeId);
  const panAxis = layout === "calendar" ? "both" : "y";
  const {
    ref: bindPreviewDrag,
    dragging,
    suppressClickIfDragged,
  } = useDragScroll(panAxis, { target: "self", includeTouch: true });
  const previewScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      previewElRef.current = node;
      bindPreviewDrag(node);
    },
    [bindPreviewDrag]
  );

  const applyZoom = useCallback((next: number) => {
    const z = clampZoom(next);
    zoomRef.current = z;
    setZoom(z);
  }, []);

  const userZoomedRef = useRef(false);

  const resetCalendarZoom = useCallback(() => {
    applyZoom(calendarDefaultZoom());
    const viewport = previewElRef.current;
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
  }, [applyZoom]);

  useEffect(() => {
    if (!open) return;
    userZoomedRef.current = false;
    if (layout === "list") applyZoom(1);
    else applyZoom(calendarDefaultZoom());
  }, [open, layout, themeId, applyZoom]);

  useEffect(() => {
    if (!open) return;
    const el = receiptRef.current;
    if (!el) return;
    const measure = () => {
      setContentSize({ w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, layout, themeId, items, planName, totalPrice]);

  useEffect(() => {
    if (!open || userZoomedRef.current) return;
    if (layout === "list") {
      applyZoom(1);
      return;
    }
    resetCalendarZoom();
  }, [open, layout, themeId, contentSize, applyZoom, resetCalendarZoom]);

  const bumpZoom = useCallback(
    (next: number) => {
      userZoomedRef.current = true;
      applyZoom(next);
    },
    [applyZoom]
  );

  useEffect(() => {
    const el = previewElRef.current;
    if (!el || !open) return;

    const onWheel = (e: WheelEvent) => {
      if (layout === "calendar" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        userZoomedRef.current = true;
        const delta =
          e.deltaY > 0 ? -PREVIEW_ZOOM_STEP / 2 : PREVIEW_ZOOM_STEP / 2;
        applyZoom(zoomRef.current + delta);
        return;
      }
      const canX = layout === "calendar" && el.scrollWidth > el.clientWidth;
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
      if (layout !== "calendar" || e.touches.length !== 2) {
        pinchRef.current = null;
        return;
      }
      pinchRef.current = {
        startDist: touchDist(e.touches),
        startZoom: zoomRef.current,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (layout !== "calendar") return;
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      userZoomedRef.current = true;
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
  }, [open, applyZoom, layout]);

  if (!open) return null;

  const exportPng = async () => {
    if (!receiptRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        pixelRatio: 2.5,
        cacheBust: true,
        backgroundColor: theme.bg,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      const tag = layout === "calendar" ? "calendar" : "list";
      a.download = `cinemap-${tag}-${themeId}-${planName.replace(/\s+/g, "_")}.png`;
      a.click();
    } catch {
      setError("导出失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const effectiveZoom = layout === "list" ? 1 : zoom;
  const scaledW =
    contentSize.w > 0
      ? contentSize.w * effectiveZoom
      : layout === "list"
        ? "100%"
        : "fit-content";
  const scaledH =
    contentSize.h > 0 ? contentSize.h * effectiveZoom : undefined;

  return (
    <div className="fixed inset-0 z-[700] flex items-end justify-center bg-ink/40 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4 lg:p-6">
      <div className="cm-frost flex max-h-[min(94dvh,100%)] w-full max-w-[min(96vw,28rem)] flex-col overflow-hidden rounded-2xl border border-ink/12 shadow-xl sm:max-h-[min(92dvh,820px)] lg:max-h-[min(90dvh,880px)] lg:max-w-[min(92vw,56rem)] lg:rounded-3xl">
        <div className="shrink-0 space-y-2 px-3 pt-3 lg:space-y-3 lg:px-5 lg:pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40 lg:text-[10px]">
                <span className="text-accent">{"//"}</span> Export
              </p>
              <h3 className="font-display text-base font-black tracking-tight lg:text-xl">
                导出排片表
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink/10 text-ink/40 hover:bg-ink/5"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            className="grid grid-cols-2 gap-1"
            role="radiogroup"
            aria-label="排片表版式"
          >
            <button
              type="button"
              role="radio"
              aria-checked={layout === "calendar"}
              onClick={() => setLayout("calendar")}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-md border px-2 font-mono text-[11px] font-bold transition-colors",
                layout === "calendar"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-ink/12 bg-paper/50 text-ink/60 hover:border-ink/25"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              日历式
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={layout === "list"}
              onClick={() => setLayout("list")}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-md border px-2 font-mono text-[11px] font-bold transition-colors",
                layout === "list"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-ink/12 bg-paper/50 text-ink/60 hover:border-ink/25"
              )}
            >
              <ListOrdered className="h-3.5 w-3.5 shrink-0" />
              时间列表
            </button>
          </div>

          <div className="flex items-end gap-1">
            <div
              className="grid min-w-0 flex-1 grid-cols-5 gap-1"
              role="radiogroup"
              aria-label="导出样式"
            >
              {POSTER_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={themeId === t.id}
                  title={t.label}
                  onClick={() => setThemeId(t.id)}
                  className={cn(
                    "flex h-9 flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 transition-colors",
                    themeId === t.id
                      ? "border-accent bg-accent/10"
                      : "border-ink/12 bg-paper/50 hover:border-ink/25"
                  )}
                >
                  <span
                    className="h-3.5 w-full max-w-[2rem] rounded-sm border"
                    style={{
                      background: t.swatch,
                      borderColor: t.swatchBorder,
                    }}
                    aria-hidden
                  />
                  <span className="max-w-full truncate font-mono text-[8px] font-bold leading-none text-ink/65">
                    {t.label}
                  </span>
                </button>
              ))}
            </div>

            {layout === "calendar" ? (
              <div className="flex shrink-0 items-center gap-1 pb-0.5">
                <button
                  type="button"
                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-ink/12 font-mono text-sm text-ink/70 hover:bg-ink/5"
                  aria-label="缩小"
                  onClick={() => bumpZoom(zoomRef.current - PREVIEW_ZOOM_STEP)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 min-w-[2.75rem] items-center justify-center rounded-md border border-ink/12 font-mono text-[10px] font-bold text-ink/60 hover:bg-ink/5"
                  aria-label="重置缩放"
                  onClick={() => {
                    userZoomedRef.current = false;
                    resetCalendarZoom();
                  }}
                >
                  {Math.round(effectiveZoom * 100)}%
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-ink/12 font-mono text-sm text-ink/70 hover:bg-ink/5"
                  aria-label="放大"
                  onClick={() => bumpZoom(zoomRef.current + PREVIEW_ZOOM_STEP)}
                >
                  +
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 px-3 pt-1.5 lg:px-5 lg:pt-2">
          <div
            ref={previewScrollRef}
            onClickCapture={suppressClickIfDragged}
            className={cn(
              PREVIEW_VIEWPORT,
              dragging ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{
              background: theme.bg,
              borderColor: theme.border,
            }}
          >
            <div
              style={{
                width: scaledW,
                height: scaledH && scaledH > 0 ? scaledH : "auto",
                minHeight: scaledH && scaledH > 0 ? scaledH : undefined,
              }}
            >
              <div
                style={{
                  transform: `scale(${effectiveZoom})`,
                  transformOrigin: "top left",
                  width:
                    contentSize.w > 0
                      ? contentSize.w
                      : layout === "list"
                        ? "100%"
                        : "fit-content",
                }}
              >
                <div
                  ref={receiptRef}
                  className={cn(
                    layout === "calendar" ? "min-w-fit w-fit" : "w-full"
                  )}
                >
                  {layout === "calendar" ? (
                    <CalendarPoster
                      planName={planName}
                      items={items}
                      totalPrice={totalPrice}
                      cinemasById={cinemasById}
                      matrix={matrix}
                      travelModes={travelModes}
                      theme={theme}
                    />
                  ) : (
                    <ListPoster
                      planName={planName}
                      items={items}
                      totalPrice={totalPrice}
                      theme={theme}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-ink/8 bg-paper/80 px-3 py-2 backdrop-blur-sm lg:px-5 lg:py-3">
          {error && (
            <p className="mb-1.5 font-mono text-xs text-accent">{error}</p>
          )}
          <Button
            type="button"
            variant="accent"
            className="h-10 w-full font-mono text-xs uppercase tracking-wider lg:h-11 lg:text-sm"
            disabled={busy || items.length === 0}
            onClick={exportPng}
          >
            <Download className="h-4 w-4" />
            {busy ? "导出中…" : "导出 2.5x PNG"}
          </Button>
        </div>
      </div>
    </div>
  );
}
