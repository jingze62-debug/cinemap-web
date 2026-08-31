"use client";

import { useEffect, useMemo, useState } from "react";
import { Clapperboard } from "lucide-react";
import { FilmCard } from "@/components/catalog/FilmCard";
import {
  CatalogSearchPanel,
  type CatalogFilterValues,
} from "@/components/catalog/CatalogSearchPanel";
import { useFestivalData } from "@/hooks/useFestivalData";
import { useScheduleStore } from "@/hooks/useScheduleStore";
import { useWantStore } from "@/hooks/useWantStore";
import { useScrollHideChrome } from "@/hooks/useScrollHideChrome";
import { ScrollHideChrome } from "@/components/shell/ScrollHideChrome";
import type { Screening } from "@/types/film";
import {
  collectDirectorOptions,
  filmHasDirector,
} from "@/utils/directors";
import { wouldConflict } from "@/utils/transitEngine";
import { cn } from "@/lib/utils";

/** Mobile-first page size; refined on mount for wide screens. */
const MOBILE_PAGE = 12;
const DESKTOP_PAGE = 24;

const EMPTY_FILTERS: CatalogFilterValues = {
  query: "",
  date: "全部",
  cinemaId: "全部",
  section: "全部",
  director: "全部",
};

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function CatalogView() {
  const festival = useFestivalData();
  const activePlanId = useScheduleStore((s) => s.activePlanId);
  const plans = useScheduleStore((s) => s.plans);
  const addScreening = useScheduleStore((s) => s.addScreening);
  const removeScreening = useScheduleStore((s) => s.removeScreening);
  const wanted = useWantStore((s) => s.wanted);
  const toggleWant = useWantStore((s) => s.toggleWant);

  const [listScope, setListScope] = useState<"all" | "wanted">("all");
  const [filters, setFilters] = useState<CatalogFilterValues>(EMPTY_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conflictHintId, setConflictHintId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(MOBILE_PAGE);
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE);
  const { filtersHidden, onScroll: onListScrollHide, showFilters } =
    useScrollHideChrome();

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setPageSize(DESKTOP_PAGE);
      setVisibleCount((n) => Math.max(n, DESKTOP_PAGE));
    }
  }, []);

  useEffect(() => {
    showFilters();
  }, [filters, listScope, showFilters]);


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

  const wantedCount = Object.keys(wanted).length;

  const readyFilms =
    festival.status === "ready" ? festival.data.films : null;
  const readyCinemas =
    festival.status === "ready" ? festival.data.cinemas : null;
  const cinemasById =
    festival.status === "ready" ? festival.data.cinemasById : null;

  const [directors, setDirectors] = useState<string[]>([]);
  useEffect(() => {
    if (!readyFilms) {
      setDirectors([]);
      return;
    }
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      setDirectors(collectDirectorOptions(readyFilms));
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 1200 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const t = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [readyFilms]);

  const filterOptions = useMemo(() => {
    if (!readyFilms || !readyCinemas) {
      return { dates: [] as string[], cinemas: [], directors: [] as string[] };
    }
    const dateSet = new Set<string>();
    for (const film of readyFilms) {
      for (const s of film.screenings) dateSet.add(s.date);
    }
    return {
      dates: Array.from(dateSet).sort(),
      cinemas: [...readyCinemas]
        .sort((a, b) => a.nameZh.localeCompare(b.nameZh, "zh"))
        .map((c) => ({
          value: c.id,
          label: c.nameEn ? `${c.nameZh} / ${c.nameEn}` : c.nameZh,
        })),
      directors,
    };
  }, [readyFilms, readyCinemas, directors]);

  const filtered = useMemo(() => {
    if (!readyFilms || !cinemasById) return [];
    const q = normalizeSearch(filters.query);

    return readyFilms.filter((film) => {
      if (listScope === "wanted" && !wanted[film.id]) return false;
      if (filters.section !== "全部" && film.section !== filters.section) {
        return false;
      }
      if (
        filters.director !== "全部" &&
        !filmHasDirector(film.director, filters.director)
      ) {
        return false;
      }
      if (filters.date !== "全部") {
        if (!film.screenings.some((s) => s.date === filters.date)) return false;
      }
      if (filters.cinemaId !== "全部") {
        if (!film.screenings.some((s) => s.cinemaId === filters.cinemaId)) {
          return false;
        }
      }
      if (!q) return true;

      const cinemaBits = film.screenings.flatMap((s) => {
        const c = cinemasById.get(s.cinemaId);
        return c ? [c.nameZh, c.nameEn ?? ""] : [];
      });
      const hay = normalizeSearch(
        [
          film.titleZh,
          film.titleEn,
          film.director,
          film.section,
          ...cinemaBits,
        ].join(" ")
      );
      return hay.includes(q);
    });
    // films are pre-sorted at load — preserve order
  }, [readyFilms, cinemasById, filters, listScope, wanted]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [filters, listScope, pageSize]);

  useEffect(() => {
    if (selectedId && !filtered.some((f) => f.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    } else if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const visibleFilms = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const selectedFilm = useMemo(
    () => filtered.find((f) => f.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const toggleScreening = (screening: Screening) => {
    if (addedSet.has(screening.id)) {
      removeScreening(screening.id);
      setConflictHintId(null);
      return;
    }

    if (festival.status === "ready" && activePlan) {
      const existing = activePlan.screeningIds
        .map((id) => festival.data.screeningsById.get(id))
        .filter((s): s is Screening => Boolean(s));
      if (wouldConflict(existing, screening)) {
        setConflictHintId(screening.id);
      } else {
        setConflictHintId(null);
      }
    }
    addScreening(screening.id);
  };

  if (festival.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center px-5 font-mono text-sm text-ink/45">
        正在加载片单…
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

  const { dataset, cinemasById: cinemasMap } = festival.data;
  const hasActiveFilter =
    Boolean(filters.query.trim()) ||
    filters.date !== "全部" ||
    filters.cinemaId !== "全部" ||
    filters.section !== "全部" ||
    filters.director !== "全部" ||
    listScope === "wanted";

  const header = (
    <div className="flex items-start gap-3">
      <div className="cm-frost flex h-12 w-12 shrink-0 items-center justify-center border-2 border-ink font-display text-xl font-black tracking-tight lg:h-14 lg:w-14 lg:text-2xl">
        01
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-bold tracking-[0.12em] text-ink/50">
          <span className="text-accent">{"//"}</span> 选电影 · Side A ·{" "}
          {dataset.editionLabel}
        </p>
        <h1 className="mt-1 font-display text-[1.55rem] font-black leading-[1.15] tracking-tight text-ink lg:text-[1.75rem]">
          浏览
          <span className="bg-accent px-1.5 text-white">片单</span>
        </h1>
        <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wide text-ink/45">
          <span className="cm-status-dot" />
          共 {festival.data.films.length} 部 · 当前 {filtered.length} 部
        </p>
      </div>
    </div>
  );

  const searchPanel = (
    <CatalogSearchPanel
      values={filters}
      onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
      dates={filterOptions.dates}
      cinemas={filterOptions.cinemas}
      sections={dataset.sections}
      directors={filterOptions.directors}
      listScope={listScope}
      onListScopeChange={setListScope}
      wantedCount={wantedCount}
    />
  );

  const emptyState = (
    <div className="cm-frost-soft rounded-xl border-2 border-dashed border-ink/20 px-4 py-14 text-center">
      <p className="font-mono text-sm font-semibold text-ink/45">
        {listScope === "wanted"
          ? "还没有想看影片"
          : hasActiveFilter
            ? "没有符合筛选条件的影片"
            : "暂无影片"}
      </p>
      <p className="mt-1 font-mono text-[11px] text-ink/30">
        {listScope === "wanted"
          ? "点卡片上的「想看」收藏"
          : hasActiveFilter
            ? "放宽筛选或点「清除」重新浏览"
            : "稍后再来看看"}
      </p>
    </div>
  );

  const cardProps = (filmId: string) => ({
    cinemasById: cinemasMap,
    isScreeningAdded: (id: string) => addedSet.has(id),
    onToggleScreening: toggleScreening,
    bookedCountOf: (id: string) => bookedCounts.get(id) ?? 0,
    conflictHintId:
      expandedId === filmId || selectedId === filmId ? conflictHintId : null,
    wanted: Boolean(wanted[filmId]),
    onToggleWant: () => toggleWant(filmId),
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-ink lg:flex-row lg:gap-4 lg:px-4 lg:pb-4 lg:pt-4">
      {/* Mobile column / desktop left */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          "lg:w-[min(100%,26rem)] lg:shrink-0"
        )}
      >
        <header className="shrink-0 px-5 pb-2 pt-5 lg:px-0 lg:pb-3 lg:pt-0">
          {header}
        </header>
        <ScrollHideChrome hidden={filtersHidden} className="px-3 lg:px-0">
          {searchPanel}
        </ScrollHideChrome>
        {filtersHidden && (
          <button
            type="button"
            onClick={showFilters}
            className="mx-3 mb-1 shrink-0 rounded-md border border-ink/10 bg-panel-raised/70 px-2.5 py-1 font-mono text-[10px] font-bold text-ink/45 transition hover:border-accent/35 hover:text-accent lg:hidden"
          >
            <span className="text-accent">{"//"}</span> 筛选 · 展开
          </button>
        )}
        <div
          onScroll={onListScrollHide}
          className="cm-scroll-auto mt-2 min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-5 pb-6 [-webkit-overflow-scrolling:touch] lg:mt-3 lg:px-0 lg:pb-0"
        >
          {filtered.length === 0
            ? emptyState
            : visibleFilms.map((film) => (
                <FilmCard
                  key={film.id}
                  film={film}
                  {...cardProps(film.id)}
                  selected={selectedId === film.id}
                  hideExpandOnLg
                  isExpanded={expandedId === film.id}
                  onToggleExpand={() => {
                    setSelectedId(film.id);
                    setExpandedId((id) => (id === film.id ? null : film.id));
                  }}
                />
              ))}
          {visibleCount < filtered.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + pageSize)}
              className="w-full rounded-lg border border-ink/12 bg-panel-raised/60 py-3 font-mono text-[12px] font-bold text-ink/60 hover:border-accent/40 hover:text-accent"
            >
              加载更多（还有 {filtered.length - visibleCount} 部）
            </button>
          )}
        </div>
      </div>

      {/* Desktop detail pane */}
      <aside className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-ink/12 bg-panel-raised/30 lg:flex">
        <p className="shrink-0 border-b border-ink/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">
          <span className="text-accent">{"//"}</span> 影片详情 · 场次
        </p>
        <div className="cm-scroll-auto min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {selectedFilm ? (
            <FilmCard
              film={selectedFilm}
              {...cardProps(selectedFilm.id)}
              selected
              isExpanded
              onToggleExpand={() => undefined}
            />
          ) : (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 text-ink/35">
              <Clapperboard className="h-8 w-8" />
              <p className="font-mono text-[12px]">在左侧点选一部影片</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
