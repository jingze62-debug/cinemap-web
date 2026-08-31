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

/** Match ScheduleCalendarView proportions for the exported grid */
const PX_PER_MIN = 1.15;
const COL_WIDTH = 168;
const GUTTER_WIDTH = 40;
const HEADER_HEIGHT = 36;
const DAY_START = 8 * 60;
const DAY_END_DEFAULT = 24 * 60;
const DAY_END_MAX = 28 * 60;
const END_PAD_MIN = 45;

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
  return `${d.getMonth() + 1}/${d.getDate()} 周${WEEKDAYS[d.getDay()]}`;
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

/** Fixed preview viewport — both styles share the same compact box */
const PREVIEW_VIEWPORT =
  "h-[min(58dvh,640px)] w-full touch-none select-none overflow-auto rounded-xl border border-ink/8 bg-paper/30 scrollbar-none";

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
      className="min-h-full w-full rounded-xl border px-3.5 py-4"
      style={{
        background: theme.surface,
        borderColor: theme.border,
        color: theme.ink,
      }}
    >
      <div
        className="border-b border-dashed pb-3"
        style={{ borderColor: theme.dashed }}
      >
        <p
          className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{ color: theme.inkFaint }}
        >
          CineMap · Schedule
        </p>
        <p className="mt-1 font-display text-lg font-black tracking-tight">
          {planName}
        </p>
        <p
          className="mt-1 font-mono text-[11px]"
          style={{ color: theme.inkMuted }}
        >
          {items.length} 场 · ¥{totalPrice} · 按时间顺序
        </p>
      </div>
      <ul className="mt-3 space-y-0">
        {items.map(({ screening: s, film, cinema }, i) => (
          <li
            key={s.id}
            className={cn("flex gap-3 py-2.5", i > 0 && "border-t")}
            style={i > 0 ? { borderColor: theme.borderLight } : undefined}
          >
            <div
              className="w-[4.5rem] shrink-0 font-mono text-[11px] leading-snug"
              style={{ color: theme.inkMuted }}
            >
              <p className="font-bold" style={{ color: theme.ink }}>
                {s.date.slice(5).replace("-", "/")}
              </p>
              <p>
                {s.start}
                <span style={{ color: theme.inkFaint }}>–</span>
                {s.end}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-snug">{film.titleZh}</p>
              <p
                className="mt-0.5 truncate font-mono text-[10px]"
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
        className="mt-3 border-t border-dashed pt-2 font-mono text-[9px]"
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
    for (let m = gridStart; m <= gridEnd; m += 60) marks.push(m);
    return marks;
  }, [gridStart, gridEnd]);

  const gridHeight = (gridEnd - gridStart) * PX_PER_MIN;

  return (
    <div
      className="min-h-full w-fit rounded-xl border"
      style={{
        background: theme.surface,
        borderColor: theme.border,
        color: theme.ink,
      }}
    >
      <div
        className="border-b border-dashed px-3.5 py-3"
        style={{ borderColor: theme.dashed }}
      >
        <p
          className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{ color: theme.inkFaint }}
        >
          CineMap · Calendar
        </p>
        <p className="mt-1 font-display text-lg font-black tracking-tight">
          {planName}
        </p>
        <p
          className="mt-1 font-mono text-[11px]"
          style={{ color: theme.inkMuted }}
        >
          {items.length} 场 · {dates.length} 天 · ¥{totalPrice}
        </p>
      </div>

      {dates.length === 0 ? (
        <p
          className="px-3.5 py-8 text-center font-mono text-xs"
          style={{ color: theme.inkFaint }}
        >
          暂无场次
        </p>
      ) : (
        <div className="overflow-hidden px-2 pb-2 pt-2">
          <div
            className="relative rounded-lg border"
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
                  className="flex shrink-0 items-center justify-center border-r font-mono text-[11px] font-semibold"
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
                    className="absolute right-1.5 font-mono text-[9px] font-medium leading-none"
                    style={{
                      top: HEADER_HEIGHT + yPos(m, gridStart),
                      color: nextDay ? theme.overnight : theme.inkFaint,
                      transform: isFirst
                        ? "translateY(3px)"
                        : isLast
                          ? "translateY(calc(-100% - 2px))"
                          : "translateY(-50%)",
                    }}
                  >
                    {formatHourLabel(m)}
                    {nextDay ? (
                      <span className="ml-0.5 text-[7px] opacity-80">+1</span>
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
                        const height = Math.max((end - start) * PX_PER_MIN, 48);
                        const film = filmsById.get(s.filmId);
                        const cinema = cinemasById.get(s.cinemaId);
                        const accent = accentFor(s.filmId);
                        const tags = s.techTags.filter(Boolean);
                        const titleExtra =
                          tags.length > 0 ? ` (${tags[0]})` : "";

                        return (
                          <article
                            key={s.id}
                            className="absolute left-1.5 right-1.5 z-[1] overflow-hidden rounded-lg border"
                            style={{
                              top,
                              height,
                              background: accent.bg,
                              borderColor: theme.borderLight,
                              borderLeftWidth: 3,
                              borderLeftColor: accent.border,
                            }}
                          >
                            <div className="flex h-full min-h-0 flex-col gap-0.5 p-1.5">
                              <h3
                                className="line-clamp-2 text-[11px] font-bold leading-snug"
                                style={{ color: accent.text }}
                              >
                                {film?.titleZh ?? s.filmId}
                                {titleExtra}
                              </h3>
                              <p
                                className="font-mono text-[9px] font-medium"
                                style={{ color: theme.inkMuted }}
                              >
                                {s.start}-{s.end}
                              </p>
                              {height >= 64 && (
                                <p
                                  className="truncate text-[9px] leading-snug"
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
      )}

      <p
        className="border-t border-dashed px-3.5 py-2 font-mono text-[9px]"
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<PosterLayout>("calendar");
  const [themeId, setThemeId] = useState<PosterThemeId>("cream");
  const theme = posterThemeById(themeId);
  const {
    ref: bindPreviewDrag,
    dragging,
    suppressClickIfDragged,
  } = useDragScroll("both", { target: "self" });
  const previewScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      previewElRef.current = node;
      bindPreviewDrag(node);
    },
    [bindPreviewDrag]
  );

  useEffect(() => {
    const el = previewElRef.current;
    if (!el || !open) return;

    const onWheel = (e: WheelEvent) => {
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

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

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

  return (
    <div className="fixed inset-0 z-[700] flex items-end justify-center bg-ink/40 p-3 sm:items-center sm:p-4">
      <div className="cm-frost max-h-[92dvh] w-full max-w-[min(92vw,28rem)] overflow-y-auto rounded-2xl border border-ink/12 p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">
              <span className="text-accent">{"//"}</span> Export · Image
            </p>
            <h3 className="mt-1 font-display text-lg font-black tracking-tight">
              导出排片表
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ink/10 p-1.5 text-ink/40 hover:bg-ink/5"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="mt-3 grid grid-cols-2 gap-1.5"
          role="radiogroup"
          aria-label="排片表版式"
        >
          <button
            type="button"
            role="radio"
            aria-checked={layout === "calendar"}
            onClick={() => setLayout("calendar")}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
              layout === "calendar"
                ? "border-accent bg-accent/10 text-accent"
                : "border-ink/12 bg-paper/50 text-ink/60 hover:border-ink/25"
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block font-mono text-[11px] font-bold">
                日历式
              </span>
              <span className="block font-mono text-[9px] opacity-70">
                时间轴网格
              </span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={layout === "list"}
            onClick={() => setLayout("list")}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
              layout === "list"
                ? "border-accent bg-accent/10 text-accent"
                : "border-ink/12 bg-paper/50 text-ink/60 hover:border-ink/25"
            )}
          >
            <ListOrdered className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block font-mono text-[11px] font-bold">
                时间列表
              </span>
              <span className="block font-mono text-[9px] opacity-70">
                从上到下
              </span>
            </span>
          </button>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink/45">
            导出样式
          </p>
          <div
            className="grid grid-cols-3 gap-1.5 sm:grid-cols-5"
            role="radiogroup"
            aria-label="导出样式"
          >
            {POSTER_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={themeId === t.id}
                onClick={() => setThemeId(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 transition-colors",
                  themeId === t.id
                    ? "border-accent bg-accent/10"
                    : "border-ink/12 bg-paper/50 hover:border-ink/25"
                )}
              >
                <span
                  className="h-5 w-full rounded border"
                  style={{ background: t.swatch, borderColor: t.swatchBorder }}
                  aria-hidden
                />
                <span className="font-mono text-[9px] font-bold leading-tight text-ink/70">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div
            ref={previewScrollRef}
            onClickCapture={suppressClickIfDragged}
            className={cn(
              PREVIEW_VIEWPORT,
              dragging ? "cursor-grabbing" : "cursor-grab"
            )}
          >
            <div
              ref={receiptRef}
              className={cn(
                "mx-auto",
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

          {error && <p className="font-mono text-xs text-accent">{error}</p>}

          <Button
            type="button"
            variant="accent"
            className="w-full font-mono text-xs uppercase tracking-wider"
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
