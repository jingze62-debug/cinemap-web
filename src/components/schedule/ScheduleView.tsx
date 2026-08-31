"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  Clapperboard,
  Handshake,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { PlanTabs } from "@/components/schedule/PlanTabs";
import { ScheduleCalendarView } from "@/components/schedule/ScheduleCalendarView";
import { PosterModal } from "@/components/schedule/PosterModal";
import { useFestivalData } from "@/hooks/useFestivalData";
import { useScheduleStore } from "@/hooks/useScheduleStore";
import { computePlanStats, sortScreenings } from "@/utils/transitEngine";
import { buildIcsCalendar, downloadIcs } from "@/utils/icsGenerator";
import type { Screening } from "@/types/film";
import { cn } from "@/lib/utils";

export function ScheduleView() {
  const festival = useFestivalData();
  const plans = useScheduleStore((s) => s.plans);
  const activePlanId = useScheduleStore((s) => s.activePlanId);
  const setActivePlan = useScheduleStore((s) => s.setActivePlan);
  const addPlan = useScheduleStore((s) => s.addPlan);
  const clonePlan = useScheduleStore((s) => s.clonePlan);
  const removePlan = useScheduleStore((s) => s.removePlan);
  const removeScreening = useScheduleStore((s) => s.removeScreening);
  const [toast, setToast] = useState<string | null>(null);
  const [posterOpen, setPosterOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const activePlan = plans.find((p) => p.id === activePlanId);

  const screenings: Screening[] = useMemo(() => {
    if (festival.status !== "ready" || !activePlan) return [];
    return activePlan.screeningIds
      .map((id) => festival.data.screeningsById.get(id))
      .filter((s): s is Screening => Boolean(s));
  }, [festival, activePlan]);

  const sorted = useMemo(() => sortScreenings(screenings), [screenings]);

  const posterItems = useMemo(() => {
    if (festival.status !== "ready") return [];
    return sorted
      .map((s) => ({
        screening: s,
        film: festival.data.filmsById.get(s.filmId)!,
        cinema: festival.data.cinemasById.get(s.cinemaId),
      }))
      .filter((x) => x.film);
  }, [festival, sorted]);

  const stats = useMemo(() => {
    if (festival.status !== "ready") return null;
    const filmIds = new Set(sorted.map((s) => s.filmId));
    return computePlanStats(
      sorted,
      festival.data.matrix,
      festival.data.cinemasById,
      filmIds,
      festival.data.travelModes
    );
  }, [festival, sorted]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const exportIcs = () => {
    if (festival.status !== "ready" || posterItems.length === 0) {
      showToast("当前方案没有场次");
      return;
    }
    const ics = buildIcsCalendar(
      posterItems,
      activePlan?.name ?? "CineMap 排片"
    );
    downloadIcs(ics);
    showToast("已下载 .ics 日历文件");
  };

  if (festival.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center px-5 font-mono text-sm text-ink/45">
        正在加载排片…
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

  return (
    <div className="relative flex h-full flex-col overflow-hidden text-ink lg:flex-row lg:gap-4 lg:px-4 lg:pb-4 lg:pt-4">
      <aside className="flex max-h-[42%] shrink-0 flex-col gap-3 overflow-hidden px-5 pb-2 pt-5 lg:max-h-none lg:h-full lg:w-[min(100%,22rem)] lg:px-0 lg:pb-0 lg:pt-0">
        <ScheduleHeader
          stats={stats}
          edition={festival.data.dataset.editionLabel}
          compact
        />
        <PlanTabs
          plans={plans}
          activePlanId={activePlanId}
          onSelect={setActivePlan}
          onAdd={() => addPlan()}
          onClone={(id) => clonePlan(id)}
          onRemove={(id) => removePlan(id)}
        />
        <div className="cm-frost overflow-hidden rounded-xl border-2 border-ink/10">
          <div className="h-1 w-full cm-hazard" aria-hidden />
          <div className="flex gap-1.5 p-2.5">
            <Link
              href="/match"
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-ink/12 bg-paper/60 px-2 py-2 font-mono text-[11px] font-bold tracking-wide text-ink/65 hover:border-accent/40 hover:text-accent"
            >
              <Handshake className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">碰场</span>
            </Link>
            <QuickAction
              icon={ImageIcon}
              label="排片表"
              onClick={() => setPosterOpen(true)}
            />
            <QuickAction icon={CalendarPlus} label="日历" onClick={exportIcs} />
          </div>
        </div>

        <div className="cm-frost hidden min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-ink/12 lg:flex">
          <div className="h-1 w-full shrink-0 cm-hazard" aria-hidden />
          <p className="shrink-0 border-b border-ink/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">
            <span className="text-accent">{"//"}</span> 场次清单 · {sorted.length}{" "}
            场
          </p>
          <div className="cm-scroll-auto min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
            {sorted.length === 0 && (
              <p className="flex items-center justify-center gap-1.5 px-2 py-8 font-mono text-[11px] text-ink/35">
                <Clapperboard className="h-3.5 w-3.5" />
                去「选电影 / 挑场次」加入场次
              </p>
            )}
            {sorted.map((s) => {
              const film = festival.data.filmsById.get(s.filmId);
              const cinema = festival.data.cinemasById.get(s.cinemaId);
              const active = focusId === s.id;
              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setFocusId(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setFocusId(s.id);
                    }
                  }}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-accent/50 bg-accent/10"
                      : "border-ink/8 bg-paper/50 hover:border-ink/15"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[13px] font-bold text-ink">
                      {film?.titleZh ?? s.filmId}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] font-medium text-ink/50">
                      {s.date} {s.start}–{s.end}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-ink/40">
                      {cinema?.nameZh ?? s.cinemaId}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="移除场次"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeScreening(s.id);
                      if (focusId === s.id) setFocusId(null);
                    }}
                    className="shrink-0 rounded border border-ink/10 p-1.5 text-ink/40 hover:border-accent/40 hover:text-accent"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-5 pb-6 lg:rounded-xl lg:border lg:border-ink/12 lg:bg-panel-raised/30 lg:px-0 lg:pb-0">
        <p className="hidden shrink-0 border-b border-ink/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40 lg:block">
          <span className="text-accent">{"//"}</span> 时间轴画布
          {focusId ? " · 已高亮左侧所选" : ""}
        </p>
        <div className="cm-scroll-auto min-h-0 flex-1 overflow-auto lg:p-3">
          <ScheduleCalendarView
            screenings={screenings}
            filmsById={festival.data.filmsById}
            cinemasById={festival.data.cinemasById}
            matrix={festival.data.matrix}
            travelModes={festival.data.travelModes}
            onRemove={removeScreening}
            highlightId={focusId}
          />
          {screenings.length === 0 && (
            <p className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[11px] text-ink/35 lg:mt-6">
              <Clapperboard className="h-3.5 w-3.5" />
              点 × 删除方案 · 双击方案名可克隆副本
            </p>
          )}
        </div>
      </section>

      <PosterModal
        open={posterOpen}
        planName={activePlan?.name ?? "我的方案"}
        items={posterItems}
        totalPrice={stats?.totalPrice ?? 0}
        cinemasById={festival.data.cinemasById}
        matrix={festival.data.matrix}
        travelModes={festival.data.travelModes}
        onClose={() => setPosterOpen(false)}
      />

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8">
          <p className="rounded-full border-2 border-ink/15 bg-panel-raised px-4 py-2 font-mono text-xs font-bold text-ink shadow-lg">
            {toast}
          </p>
        </div>
      )}
    </div>
  );
}

function ScheduleHeader({
  stats,
  edition,
  compact,
}: {
  stats: {
    filmCount: number;
    totalPrice: number;
    tightnessLabel: string;
  } | null;
  edition: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "cm-frost flex shrink-0 items-center justify-center border-2 border-ink font-display font-black tracking-tight",
          compact ? "h-12 w-12 text-xl" : "h-14 w-14 text-2xl"
        )}
      >
        03
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-bold tracking-[0.12em] text-ink/50">
          <span className="text-accent">{"//"}</span> 排片 · Side B · {edition}
        </p>
        <h1 className="mt-1 font-display text-[1.55rem] font-black leading-[1.15] tracking-tight text-ink lg:text-[1.35rem]">
          我的
          <span className="bg-accent px-1.5 text-white">排片</span>
        </h1>
        {stats && (
          <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wide text-ink/45">
            <span className="cm-status-dot" />
            {stats.filmCount} 部 · ¥{stats.totalPrice} · {stats.tightnessLabel}
          </p>
        )}
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ImageIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-ink/12 bg-paper/60 px-2 py-2 font-mono text-[11px] font-bold tracking-wide text-ink/65 hover:border-accent/40 hover:text-accent"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
