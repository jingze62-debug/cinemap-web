"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  Clapperboard,
  Handshake,
  ImageIcon,
} from "lucide-react";
import { PlanTabs } from "@/components/schedule/PlanTabs";
import { ScheduleCalendarView } from "@/components/schedule/ScheduleCalendarView";
import { PosterModal } from "@/components/schedule/PosterModal";
import { useFestivalData } from "@/hooks/useFestivalData";
import { useScheduleStore } from "@/hooks/useScheduleStore";
import { computePlanStats, sortScreenings } from "@/utils/transitEngine";
import { buildIcsCalendar, downloadIcs } from "@/utils/icsGenerator";
import type { Screening } from "@/types/film";

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

  const activePlan = plans.find((p) => p.id === activePlanId);

  const screenings: Screening[] = useMemo(() => {
    if (festival.status !== "ready" || !activePlan) return [];
    return activePlan.screeningIds
      .map((id) => festival.data.screeningsById.get(id))
      .filter((s): s is Screening => Boolean(s));
  }, [festival, activePlan]);

  const posterItems = useMemo(() => {
    if (festival.status !== "ready") return [];
    return sortScreenings(screenings)
      .map((s) => ({
        screening: s,
        film: festival.data.filmsById.get(s.filmId)!,
        cinema: festival.data.cinemasById.get(s.cinemaId),
      }))
      .filter((x) => x.film);
  }, [festival, screenings]);

  const stats = useMemo(() => {
    if (festival.status !== "ready") return null;
    const sorted = sortScreenings(screenings);
    const filmIds = new Set(sorted.map((s) => s.filmId));
    return computePlanStats(
      sorted,
      festival.data.matrix,
      festival.data.cinemasById,
      filmIds,
      festival.data.travelModes
    );
  }, [festival, screenings]);

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
      <div className="px-5 py-16 text-center font-mono text-sm text-ink/45">
        正在加载排片…
      </div>
    );
  }

  if (festival.status === "error") {
    return (
      <div className="px-5 py-16 text-center font-mono text-sm text-accent">
        {festival.message}
      </div>
    );
  }

  return (
    <div className="relative min-h-full text-ink">
      <header className="px-5 pb-3 pt-6">
        <div className="flex items-start gap-3">
          <div className="cm-frost flex h-14 w-14 shrink-0 items-center justify-center border-2 border-ink font-display text-2xl font-black tracking-tight">
            03
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-bold tracking-[0.12em] text-ink/50">
              <span className="text-accent">{"//"}</span> 排片 · Side B ·{" "}
              {festival.data.dataset.editionLabel}
            </p>
            <h1 className="mt-1.5 font-display text-[1.85rem] font-black leading-[1.15] tracking-tight text-ink">
              我的
              <span className="bg-accent px-1.5 text-white">排片</span>
            </h1>
            <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">
              My · Schedule
            </p>
            {stats && (
              <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wide text-ink/45">
                <span className="cm-status-dot" />
                {stats.filmCount} 部 · ¥{stats.totalPrice} ·{" "}
                {stats.tightnessLabel}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="mt-1 px-5">
        <PlanTabs
          plans={plans}
          activePlanId={activePlanId}
          onSelect={setActivePlan}
          onAdd={() => addPlan()}
          onClone={(id) => clonePlan(id)}
          onRemove={(id) => removePlan(id)}
        />
      </div>

      <div className="mt-3 px-5">
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
            <QuickAction
              icon={CalendarPlus}
              label="日历"
              onClick={exportIcs}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 px-5 pb-8">
        <ScheduleCalendarView
          screenings={screenings}
          filmsById={festival.data.filmsById}
          cinemasById={festival.data.cinemasById}
          matrix={festival.data.matrix}
          travelModes={festival.data.travelModes}
          onRemove={removeScreening}
        />
        {screenings.length === 0 && (
          <p className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[11px] text-ink/35">
            <Clapperboard className="h-3.5 w-3.5" />
            点 × 删除方案 · 双击方案名可克隆副本
          </p>
        )}
      </div>

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
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <p className="rounded-full border-2 border-ink/15 bg-panel-raised px-4 py-2 font-mono text-xs font-bold text-ink shadow-lg">
            {toast}
          </p>
        </div>
      )}
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
