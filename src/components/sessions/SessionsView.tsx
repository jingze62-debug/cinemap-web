"use client";

import { memo, useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { Check, ChevronDown, Plus, Search, Star, Trash2 } from "lucide-react";
import { useFestivalData } from "@/hooks/useFestivalData";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useScheduleStore } from "@/hooks/useScheduleStore";
import { useWantStore } from "@/hooks/useWantStore";
import type { Film, Screening } from "@/types/film";
import { resolveFilmScores } from "@/utils/filmRatings";
import { screeningStartAbs, wouldConflict } from "@/utils/transitEngine";
import {
  filmHasDirector,
  formatDirectorCredit,
  splitDirectorNames,
} from "@/utils/directors";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { ScrollHideChrome } from "@/components/shell/ScrollHideChrome";
import { useScrollHideChrome } from "@/hooks/useScrollHideChrome";
import { cn } from "@/lib/utils";
import { formatTicketPrice } from "@/utils/price";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const ROWS_PER_DAY = 16;
const zhCollator = new Intl.Collator("zh");

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()} 周${WEEKDAYS[d.getDay()]}`;
}

function formatDateParts(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return {
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekday: WEEKDAYS[d.getDay()],
  };
}

function formatRuntime(min?: number): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

type ChipOption = { value: string; label: string; count?: number };

type ChipRowProps = {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (v: string) => void;
};

function ChipRow({ label, options, value, onChange }: ChipRowProps) {
  const { ref, dragging, suppressClickIfDragged } = useDragScroll("x", {
    target: "self",
  });

  return (
    <div className="min-w-0">
      <p className="mb-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-ink/40 lg:mb-1 lg:text-[9px] lg:tracking-[0.14em]">
        <span className="text-accent">{"//"}</span> {label}
      </p>
      <div
        ref={ref}
        onClickCapture={suppressClickIfDragged}
        className={cn(
          "flex gap-1 overflow-x-auto overscroll-x-contain pb-0.5 scrollbar-none select-none lg:gap-1.5",
          dragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap transition-colors lg:px-2.5 lg:py-1 lg:text-[11px]",
                active
                  ? "border-accent bg-accent text-white"
                  : "border-ink/12 cm-frost-soft text-ink/65 hover:border-accent/35 hover:text-accent"
              )}
            >
              {opt.label}
              {typeof opt.count === "number" && (
                <span
                  className={cn(
                    "ml-1 tabular-nums lg:ml-1.5",
                    active ? "text-white/75" : "text-ink/30"
                  )}
                >
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Film-sprocket perforations — signature of the run sheet */
function SprocketRail() {
  return (
    <div
      className="flex w-2.5 shrink-0 flex-col justify-around gap-2 py-2"
      aria-hidden
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="mx-auto h-1.5 w-1.5 rounded-[1px] bg-ink/18"
        />
      ))}
    </div>
  );
}

type SessionRowProps = {
  screening: Screening;
  film: Film;
  cinemaName: string;
  added: boolean;
  conflict: boolean;
  booked: number;
  wanted: boolean;
  onToggle: () => void;
  onToggleWant: () => void;
};

const SessionRow = memo(function SessionRow({
  screening,
  film,
  cinemaName,
  added,
  conflict,
  booked,
  wanted,
  onToggle,
  onToggleWant,
}: SessionRowProps) {
  const scores = resolveFilmScores(film);
  const techTag = screening.techTags?.[0];
  const countries = film.countries?.join("/") ?? "—";
  const priceLabel = formatTicketPrice(screening.price);

  return (
    <article
      className={cn(
        "group relative flex overflow-hidden rounded-lg border-2 cm-frost-card transition-colors",
        added
          ? "border-signal/40 shadow-[inset_3px_0_0_0_var(--signal)]"
          : conflict
            ? "border-accent/35 shadow-[inset_3px_0_0_0_var(--accent)]"
            : "border-ink/10 hover:border-ink/20"
      )}
    >
      <SprocketRail />

      {/* Time + date block */}
      <div className="flex w-[4.1rem] shrink-0 flex-col items-center justify-center border-r border-dashed border-ink/12 bg-panel/60 px-1 py-2.5">
        <span className="mb-1.5 font-mono text-[9px] font-bold tabular-nums tracking-wide text-accent">
          {formatDateLabel(screening.date)}
        </span>
        <span className="font-mono text-[13px] font-black tabular-nums leading-none text-ink">
          {screening.start}
        </span>
        <span className="my-1.5 h-4 w-px bg-ink/20" aria-hidden />
        <span className="font-mono text-[11px] font-semibold tabular-nums text-ink/45">
          {screening.end}
        </span>
      </div>

      <div className="min-w-0 flex-1 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[15px] font-black leading-snug tracking-tight text-ink">
              {film.titleZh}
              {techTag ? (
                <span className="ml-1 font-mono text-[11px] font-bold text-accent">
                  ({techTag})
                </span>
              ) : null}
            </h3>
            <p className="mt-0.5 truncate font-mono text-[10px] text-ink/40">
              {film.year} · {countries} · {formatRuntime(film.runtimeMin)} ·
              Dir {formatDirectorCredit(film.director)}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleWant}
            className={cn(
              "shrink-0 rounded-md border p-1.5 transition-colors",
              wanted
                ? "border-amber-400/50 bg-amber-400/15 text-amber-500"
                : "border-ink/10 text-ink/25 hover:border-amber-400/40 hover:text-amber-400"
            )}
            aria-label={wanted ? "取消标星" : "标星"}
          >
            <Star className={cn("h-3.5 w-3.5", wanted && "fill-current")} />
          </button>
        </div>

        <p className="mt-1.5 truncate font-mono text-[11px] font-semibold text-ink/55">
          {cinemaName}
          {screening.hall ? ` · ${screening.hall}` : ""}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {priceLabel ? (
            <span className="font-mono text-[13px] font-black text-accent">
              {priceLabel}
            </span>
          ) : (
            <span className="font-mono text-[11px] font-bold text-ink/40">
              票价以现场为准
            </span>
          )}
          {(screening.techTags ?? []).slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded border border-ink/12 bg-chassis/40 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-ink/55"
            >
              {t}
            </span>
          ))}
          <span className="font-mono text-[9px] font-medium text-ink/35">
            豆 {scores.douban.toFixed(1)} · IMDb {scores.imdb.toFixed(1)} · LB{" "}
            {scores.letterboxd.toFixed(1)}
          </span>
          {wanted && (
            <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-700">
              已标星
            </span>
          )}
          {conflict && !added && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-accent">
              时间冲突
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-stretch justify-center gap-1 border-l border-ink/8 bg-panel/40 px-2.5 py-2">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1 rounded-md border px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors",
            added
              ? "border-signal bg-signal text-white hover:bg-signal-dim"
              : "border-ink/15 cm-frost-soft text-ink/70 hover:border-accent hover:text-accent"
          )}
        >
          {added ? (
            <>
              <Check className="h-3.5 w-3.5" />
              已加入
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              加入
            </>
          )}
        </button>
        {added && (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-ink/12 bg-paper/50 font-mono text-[9px] font-bold text-ink/45 transition-colors hover:border-accent/40 hover:text-accent"
            aria-label="从日程删除"
          >
            <Trash2 className="h-3 w-3" />
            删除
          </button>
        )}
        <span className="text-center font-mono text-[9px] font-semibold text-ink/35">
          {booked} booked
        </span>
      </div>
    </article>
  );
});

export function SessionsView() {
  const festival = useFestivalData();
  const activePlanId = useScheduleStore((s) => s.activePlanId);
  const plans = useScheduleStore((s) => s.plans);
  const addScreening = useScheduleStore((s) => s.addScreening);
  const removeScreening = useScheduleStore((s) => s.removeScreening);
  const wanted = useWantStore((s) => s.wanted);
  const toggleWant = useWantStore((s) => s.toggleWant);

  const [query, setQuery] = useState("");
  const [date, setDate] = useState("全部");
  const [cinemaId, setCinemaId] = useState("全部");
  const [section, setSection] = useState("全部");
  const [director, setDirector] = useState("全部");
  const [scope, setScope] = useState<"all" | "wanted">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>(
    {}
  );
  const [visibleByDate, setVisibleByDate] = useState<Record<string, number>>(
    {}
  );
  const [scheduledCollapsed, setScheduledCollapsed] = useState(false);
  const [listScrolling, setListScrolling] = useState(false);
  const listScrollTimer = useRef(0);
  const {
    ref: dragRef,
    dragging,
    suppressClickIfDragged,
  } = useDragScroll("y", { target: "self" });
  const { filtersHidden, onScroll: onScrollHideFilters, showFilters } =
    useScrollHideChrome();

  const onListScroll = (e: UIEvent<HTMLElement>) => {
    onScrollHideFilters(e);
    setListScrolling(true);
    window.clearTimeout(listScrollTimer.current);
    listScrollTimer.current = window.setTimeout(
      () => setListScrolling(false),
      700
    );
  };

  const toggleDateCollapsed = (dateKey: string, defaultCollapsed: boolean) => {
    setCollapsedDates((prev) => {
      const current = prev[dateKey] ?? defaultCollapsed;
      return { ...prev, [dateKey]: !current };
    });
  };

  const loadMoreForDate = (dateKey: string, total: number) => {
    setVisibleByDate((prev) => ({
      ...prev,
      [dateKey]: Math.min((prev[dateKey] ?? ROWS_PER_DAY) + ROWS_PER_DAY, total),
    }));
  };

  const activePlan = plans.find((p) => p.id === activePlanId);
  const addedSet = useMemo(
    () => new Set(activePlan?.screeningIds ?? []),
    [activePlan?.screeningIds]
  );

  const bookedCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const plan of plans) {
      for (const id of plan.screeningIds) {
        map.set(id, (map.get(id) ?? 0) + 1);
      }
    }
    return map;
  }, [plans]);

  const existingScreenings = useMemo(() => {
    if (festival.status !== "ready" || !activePlan) return [];
    return activePlan.screeningIds
      .map((id) => festival.data.screeningsById.get(id))
      .filter((s): s is Screening => Boolean(s));
  }, [festival, activePlan]);

  const allRows = useMemo(() => {
    if (festival.status !== "ready") return [];
    const { films, screeningsById } = festival.data;
    const rows: { screening: Screening; film: Film }[] = [];
    const seen = new Set<string>();
    for (const film of films) {
      for (const s of film.screenings) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        rows.push({ screening: s, film });
      }
    }
    if (rows.length === 0) {
      for (const s of Array.from(screeningsById.values())) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        const film = festival.data.filmsById.get(s.filmId);
        if (film) rows.push({ screening: s, film });
      }
    }
    return rows;
  }, [festival]);

  const filterMeta = useMemo(() => {
    const dateCounts = new Map<string, number>();
    const cinemaCounts = new Map<string, number>();
    const sectionCounts = new Map<string, number>();
    const directorCounts = new Map<string, number>();

    for (const { screening: s, film } of allRows) {
      dateCounts.set(s.date, (dateCounts.get(s.date) ?? 0) + 1);
      cinemaCounts.set(s.cinemaId, (cinemaCounts.get(s.cinemaId) ?? 0) + 1);
      sectionCounts.set(
        film.section,
        (sectionCounts.get(film.section) ?? 0) + 1
      );
      const d = film.director?.trim();
      if (d && d !== "待补充") {
        for (const name of splitDirectorNames(d)) {
          directorCounts.set(name, (directorCounts.get(name) ?? 0) + 1);
        }
      }
    }

    return { dateCounts, cinemaCounts, sectionCounts, directorCounts };
  }, [allRows]);

  const filtered = useMemo(() => {
    if (festival.status !== "ready") return [];
    const q = normalizeSearch(query);
    const { cinemasById } = festival.data;

    const list = allRows.filter(({ screening: s, film }) => {
      if (scope === "wanted" && !wanted[film.id]) return false;
      if (date !== "全部" && s.date !== date) return false;
      if (cinemaId !== "全部" && s.cinemaId !== cinemaId) return false;
      if (section !== "全部" && film.section !== section) return false;
      if (director !== "全部" && !filmHasDirector(film.director, director))
        return false;
      if (!q) return true;
      const cinema = cinemasById.get(s.cinemaId);
      const hay = normalizeSearch(
        [
          film.titleZh,
          film.titleEn,
          film.director,
          film.section,
          cinema?.nameZh ?? "",
          cinema?.nameEn ?? "",
          s.hall,
        ].join(" ")
      );
      return hay.includes(q);
    });

    return [...list].sort((a, b) => {
      const dateCmp = a.screening.date.localeCompare(b.screening.date);
      if (dateCmp !== 0) return dateCmp;
      return screeningStartAbs(a.screening) - screeningStartAbs(b.screening);
    });
  }, [
    festival,
    allRows,
    query,
    date,
    cinemaId,
    section,
    director,
    scope,
    wanted,
  ]);

  const scheduledRows = useMemo(() => {
    if (festival.status !== "ready" || addedSet.size === 0) return [];
    const { screeningsById, filmsById } = festival.data;
    const rows: { screening: Screening; film: Film }[] = [];
    for (const id of Array.from(addedSet)) {
      const s = screeningsById.get(id);
      if (!s) continue;
      const film = filmsById.get(s.filmId);
      if (!film) continue;
      if (scope === "wanted" && !wanted[film.id]) continue;
      rows.push({ screening: s, film });
    }
    return rows.sort(
      (a, b) =>
        screeningStartAbs(a.screening) - screeningStartAbs(b.screening)
    );
  }, [festival, addedSet, scope, wanted]);

  const byDateGroups = useMemo(() => {
    const map = new Map<string, { screening: Screening; film: Film }[]>();
    for (const row of filtered) {
      const list = map.get(row.screening.date) ?? [];
      list.push(row);
      map.set(row.screening.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  useEffect(() => {
    setVisibleByDate({});
    showFilters();
  }, [query, date, cinemaId, section, director, scope, showFilters]);

  const total = allRows.length;

  const dateOptions = useMemo((): ChipOption[] => {
    if (festival.status !== "ready") return [];
    return [
      { value: "全部", label: "全部日期", count: total },
      ...Array.from(filterMeta.dateCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([d, n]) => ({
          value: d,
          label: formatDateLabel(d),
          count: n,
        })),
    ];
  }, [festival.status, filterMeta.dateCounts, total]);

  const cinemaOptions = useMemo((): ChipOption[] => {
    if (festival.status !== "ready") return [];
    const { cinemas } = festival.data;
    return [
      { value: "全部", label: "全部影院", count: total },
      ...[...cinemas]
        .sort(
          (a, b) =>
            (filterMeta.cinemaCounts.get(b.id) ?? 0) -
            (filterMeta.cinemaCounts.get(a.id) ?? 0)
        )
        .filter((c) => filterMeta.cinemaCounts.has(c.id))
        .map((c) => ({
          value: c.id,
          label: c.nameZh,
          count: filterMeta.cinemaCounts.get(c.id) ?? 0,
        })),
    ];
  }, [festival, filterMeta.cinemaCounts, total]);

  const sectionOptions = useMemo((): ChipOption[] => {
    if (festival.status !== "ready") return [];
    const { dataset } = festival.data;
    return [
      { value: "全部", label: "全部单元", count: total },
      ...dataset.sections
        .filter((s) => s !== "全部" && filterMeta.sectionCounts.has(s))
        .map((s) => ({
          value: s,
          label: s,
          count: filterMeta.sectionCounts.get(s) ?? 0,
        })),
    ];
  }, [festival, filterMeta.sectionCounts, total]);

  const directorOptions = useMemo((): ChipOption[] => {
    if (festival.status !== "ready") return [];
    return [
      { value: "全部", label: "全部导演", count: total },
      ...Array.from(filterMeta.directorCounts.entries())
        .sort((a, b) => zhCollator.compare(a[0], b[0]))
        .map(([d, n]) => ({ value: d, label: d, count: n })),
    ];
  }, [festival.status, filterMeta.directorCounts, total]);

  const hasActiveFilter =
    date !== "全部" ||
    cinemaId !== "全部" ||
    section !== "全部" ||
    director !== "全部" ||
    query.trim().length > 0 ||
    scope === "wanted";

  const clearFilters = () => {
    setQuery("");
    setDate("全部");
    setCinemaId("全部");
    setSection("全部");
    setDirector("全部");
    setScope("all");
  };

  const toggle = (s: Screening) => {
    if (addedSet.has(s.id)) {
      removeScreening(s.id);
      return;
    }
    addScreening(s.id);
  };

  if (festival.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center px-5 font-mono text-sm text-ink/45">
        正在加载场次…
      </div>
    );
  }

  if (festival.status === "error") {
    return (
      <div className="flex h-full items-center justify-center px-5 font-mono text-sm text-accent">
        {festival.message}
      </div>
    );
  }

  const { dataset, cinemasById } = festival.data;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-paper text-ink lg:flex-row lg:gap-4 lg:px-4 lg:pb-4 lg:pt-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 px-5 pb-3 pt-5 lg:px-0 lg:pt-0">
          <div className="flex items-start gap-3">
            <div className="cm-frost flex h-12 w-12 shrink-0 items-center justify-center border-2 border-ink font-display text-xl font-black tracking-tight lg:h-14 lg:w-14 lg:text-2xl">
              02
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] font-bold tracking-[0.12em] text-ink/50">
                <span className="text-accent">{"//"}</span> 挑场次 · Side B ·{" "}
                {dataset.editionLabel}
              </p>
              <h1 className="mt-1 font-display text-[1.55rem] font-black leading-[1.15] tracking-tight text-ink lg:text-[1.75rem]">
                挑选
                <span className="bg-accent px-1.5 text-white">场次</span>
              </h1>
              <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wide text-ink/45">
                <span className="cm-status-dot" />
                共 {total} 场 · 当前 {filtered.length} 场
                <span className="text-signal-dim">
                  · 已排 {scheduledRows.length}
                </span>
              </p>
            </div>
          </div>
        </header>

        <ScrollHideChrome hidden={filtersHidden}>
          <div className="px-3 lg:px-0">
            <div className="cm-frost rounded-lg border border-ink/10 lg:rounded-xl lg:border-2">
              <div className="h-0.5 w-full cm-hazard lg:h-1" aria-hidden />
              <div className="space-y-1.5 p-2 lg:space-y-2.5 lg:p-3">
                <p className="font-mono text-[9px] font-bold tracking-[0.1em] text-ink/40 lg:text-[10px] lg:tracking-[0.12em]">
                  <span className="text-accent">{"//"}</span> 筛选 · Find
                </p>
                <label className="relative block">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-ink/35 lg:left-2.5 lg:h-3.5 lg:w-3.5"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜片名、导演、影院..."
                    className="h-8 w-full rounded-md border border-ink/12 bg-paper/60 pl-7 pr-2.5 font-mono text-[12px] text-ink placeholder:text-ink/35 outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 lg:h-9 lg:pl-8 lg:pr-3 lg:text-[13px]"
                  />
                </label>

                <div className="flex flex-wrap gap-1 lg:gap-1.5">
                  {(
                    [
                      { id: "all" as const, label: "全部场次" },
                      { id: "wanted" as const, label: "已标星影片" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setScope(tab.id)}
                      className={cn(
                        "rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold transition-colors lg:px-2.5 lg:py-1 lg:text-[11px]",
                        scope === tab.id
                          ? "border-ink bg-ink text-paper"
                          : "border-ink/12 bg-paper/50 text-ink/55 hover:border-ink/25"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold transition-colors lg:gap-1 lg:px-2.5 lg:py-1 lg:text-[11px]",
                      filtersOpen
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-ink/12 bg-paper/50 text-ink/55"
                    )}
                  >
                    筛选
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform lg:h-3.5 lg:w-3.5",
                        filtersOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {hasActiveFilter && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-md border border-ink/12 px-2 py-0.5 font-mono text-[10px] font-bold text-ink/45 hover:border-accent/40 hover:text-accent lg:px-2.5 lg:py-1 lg:text-[11px]"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-1.5 space-y-1.5 border-y border-ink/10 bg-chassis/35 px-3 py-2 lg:mt-2 lg:space-y-2 lg:rounded-lg lg:border lg:px-3 lg:py-2.5">
              <ChipRow
                label="日期"
                options={dateOptions}
                value={date}
                onChange={setDate}
              />
              <ChipRow
                label="影院"
                options={cinemaOptions}
                value={cinemaId}
                onChange={setCinemaId}
              />
              <ChipRow
                label="单元"
                options={sectionOptions}
                value={section}
                onChange={setSection}
              />
              <FilterSelect
                field="Director"
                label="全部导演"
                value={director}
                options={directorOptions}
                onChange={setDirector}
                searchableAbove={0}
                compact
              />
            </div>
          )}
        </ScrollHideChrome>

        <div
          ref={dragRef}
          onClickCapture={suppressClickIfDragged}
          onScroll={onListScroll}
          className={cn(
            "cm-scroll-auto mt-2 min-h-0 flex-1 select-none overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [&_input]:cursor-text [&_input]:select-text lg:mt-3",
            dragging ? "cursor-grabbing" : "cursor-grab",
            (listScrolling || dragging) && "is-scrolling"
          )}
        >
          <div className="space-y-6 px-5 pb-4 pt-1 lg:px-0 lg:pb-2">
            {scheduledRows.length > 0 && (
              <section className="animate-fade-up lg:hidden">
                <header className="mb-2.5 flex items-end justify-between gap-3 border-b-2 border-signal/25 pb-2">
                  <div className="min-w-0 pb-0.5">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">
                      <span className="text-signal">{"//"}</span> In Plan ·
                      已排入
                    </p>
                    <p className="font-mono text-[12px] font-bold text-ink/60">
                      当前方案场次
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
                    <span className="cm-frost-soft rounded-full border border-signal/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-signal-dim">
                      {scheduledRows.length} 场
                    </span>
                    <button
                      type="button"
                      onClick={() => setScheduledCollapsed((v) => !v)}
                      aria-expanded={!scheduledCollapsed}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink/12 bg-paper/60 text-ink/50"
                    >
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          scheduledCollapsed && "-rotate-90"
                        )}
                      />
                    </button>
                  </div>
                </header>
                {!scheduledCollapsed && (
                  <div className="space-y-2">
                    {scheduledRows.map(({ screening: s, film }) => {
                      const cinema = cinemasById.get(s.cinemaId);
                      return (
                        <SessionRow
                          key={`plan-${s.id}`}
                          screening={s}
                          film={film}
                          cinemaName={cinema?.nameZh ?? s.cinemaId}
                          added
                          conflict={false}
                          booked={bookedCounts.get(s.id) ?? 0}
                          wanted={Boolean(wanted[film.id])}
                          onToggle={() => toggle(s)}
                          onToggleWant={() => toggleWant(film.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {byDateGroups.length === 0 ? (
              scheduledRows.length === 0 && (
                <div className="cm-frost-soft rounded-xl border-2 border-dashed border-ink/20 px-4 py-14 text-center">
                  <p className="font-mono text-sm font-semibold text-ink/45">
                    没有匹配的场次
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-ink/30">
                    放宽筛选或点「清除」重新浏览
                  </p>
                </div>
              )
            ) : (
              byDateGroups.map(([d, rows], groupIndex) => {
                const parts = formatDateParts(d);
                const defaultCollapsed = groupIndex !== 0;
                const collapsed = collapsedDates[d] ?? defaultCollapsed;
                const visibleLimit = visibleByDate[d] ?? ROWS_PER_DAY;
                const visibleRows = rows.slice(0, visibleLimit);
                const hasMore = rows.length > visibleLimit;

                return (
                  <section key={d} className="animate-fade-up">
                    <header className="mb-2.5 flex items-end justify-between gap-3 border-b-2 border-ink/10 pb-2">
                      <div className="flex min-w-0 items-end gap-2.5">
                        <span className="font-display text-3xl font-black leading-none tabular-nums text-ink">
                          {parts.day}
                        </span>
                        <div className="pb-0.5">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">
                            <span className="text-accent">{"//"}</span> {d}
                          </p>
                          <p className="font-mono text-[12px] font-bold text-ink/60">
                            {parts.month}月 · 星期{parts.weekday}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
                        <span className="cm-frost-soft rounded-full border border-ink/12 px-2.5 py-0.5 font-mono text-[10px] font-bold text-ink/50">
                          {rows.length} 场
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleDateCollapsed(d, defaultCollapsed)}
                          aria-expanded={!collapsed}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink/12 bg-paper/60 text-ink/50 hover:border-accent/40 hover:text-accent"
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition-transform duration-200",
                              collapsed && "-rotate-90"
                            )}
                          />
                        </button>
                      </div>
                    </header>

                    {!collapsed && (
                      <div className="space-y-2">
                        {visibleRows.map(({ screening: s, film }) => {
                          const cinema = cinemasById.get(s.cinemaId);
                          const added = addedSet.has(s.id);
                          const conflict =
                            !added && wouldConflict(existingScreenings, s);
                          return (
                            <SessionRow
                              key={s.id}
                              screening={s}
                              film={film}
                              cinemaName={cinema?.nameZh ?? s.cinemaId}
                              added={added}
                              conflict={conflict}
                              booked={bookedCounts.get(s.id) ?? 0}
                              wanted={Boolean(wanted[film.id])}
                              onToggle={() => toggle(s)}
                              onToggleWant={() => toggleWant(film.id)}
                            />
                          );
                        })}
                        {hasMore && (
                          <button
                            type="button"
                            onClick={() => loadMoreForDate(d, rows.length)}
                            className="w-full rounded-lg border border-dashed border-ink/20 bg-paper/40 py-2.5 font-mono text-[11px] font-bold text-ink/50 transition-colors hover:border-accent/40 hover:text-accent"
                          >
                            加载更多（还有 {rows.length - visibleLimit} 场）
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
        </div>
      </div>

      <aside className="hidden min-h-0 w-[min(100%,24rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-ink/12 bg-panel-raised/30 lg:flex">
        <div className="shrink-0 border-b border-ink/10 px-3 py-2.5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">
            <span className="text-signal">{"//"}</span> In Plan · 已排入
          </p>
          <p className="mt-1 font-mono text-[12px] font-bold text-ink/65">
            当前方案 · {scheduledRows.length} 场
          </p>
        </div>
        <div className="cm-scroll-auto min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
          {scheduledRows.length === 0 ? (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 px-3 text-center text-ink/35">
              <Plus className="h-6 w-6" />
              <p className="font-mono text-[12px] leading-relaxed">
                在左侧点「加入」，场次会出现在这里
              </p>
            </div>
          ) : (
            scheduledRows.map(({ screening: s, film }) => {
              const cinema = cinemasById.get(s.cinemaId);
              return (
                <SessionRow
                  key={`desk-plan-${s.id}`}
                  screening={s}
                  film={film}
                  cinemaName={cinema?.nameZh ?? s.cinemaId}
                  added
                  conflict={false}
                  booked={bookedCounts.get(s.id) ?? 0}
                  wanted={Boolean(wanted[film.id])}
                  onToggle={() => toggle(s)}
                  onToggleWant={() => toggleWant(film.id)}
                />
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
