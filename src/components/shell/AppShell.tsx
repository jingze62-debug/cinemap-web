"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CatalogView } from "@/components/catalog/CatalogView";
import { SessionsView } from "@/components/sessions/SessionsView";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { MapView } from "@/components/map/MapView";
import { FestivalPicker } from "@/components/home/FestivalPicker";
import { BottomTabBar, type MainTab } from "@/components/shell/BottomTabBar";
import { ThemeSwitcher } from "@/components/shell/ThemeSwitcher";
import type { FestivalEntry } from "@/types/festival";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "cinemap-active-festival-v1";

export function AppShell() {
  const [festival, setFestival] = useState<FestivalEntry | null>(null);
  const [tab, setTab] = useState<MainTab>("catalog");

  useEffect(() => {
    track("app_open");
  }, []);

  // Restore last festival after mount — never block first paint
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FestivalEntry;
      if (parsed?.id && parsed.available) {
        setFestival(parsed);
        track("festival_enter", {
          festivalId: parsed.id,
          source: "session_restore",
        });
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const enterFestival = (f: FestivalEntry) => {
    setFestival(f);
    setTab("catalog");
    track("festival_enter", { festivalId: f.id, source: "picker" });
    track("tab_view", { tab: "catalog" });
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f));
    } catch {
      /* private mode etc. */
    }
  };

  const leaveFestival = () => {
    if (festival) {
      track("festival_leave", { festivalId: festival.id });
    }
    setFestival(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const changeTab = (next: MainTab) => {
    setTab(next);
    track("tab_view", { tab: next });
  };

  if (!festival) {
    return <FestivalPicker onSelect={enterFestival} />;
  }

  /** Map / sessions / schedule / catalog fill viewport */
  const lockViewport =
    tab === "map" ||
    tab === "sessions" ||
    tab === "schedule" ||
    tab === "catalog";

  return (
    <div
      className={cn(
        "relative mx-auto flex w-full min-w-0 flex-col",
        "max-w-lg lg:max-w-6xl xl:max-w-7xl",
        lockViewport
          ? cn(
              "h-dvh overflow-hidden",
              "sm:my-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-2xl sm:border sm:border-ink/10 sm:shadow-[0_12px_40px_color-mix(in_srgb,var(--ink)_14%,transparent)]",
              "lg:my-0 lg:h-dvh lg:rounded-none lg:border-0 lg:shadow-none"
            )
          : "min-h-dvh overflow-x-hidden lg:min-h-dvh"
      )}
    >
      <div className="safe-top sticky top-0 z-[700] border-b border-ink/10 bg-panel-raised/78 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 py-2 lg:px-4">
          <button
            type="button"
            onClick={leaveFestival}
            className="inline-flex items-center gap-0.5 rounded-md border border-ink/15 bg-white/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink/60 transition hover:border-accent/40 hover:text-accent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Exit
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">
              <span className="text-accent">{"//"}</span> Channel Active
              <span className="ml-2 hidden font-normal normal-case tracking-normal text-ink/35 lg:inline">
                · 大屏双栏
              </span>
            </p>
            <p className="truncate font-display text-sm font-black tracking-tight text-ink">
              {festival.title}
            </p>
          </div>
          <ThemeSwitcher compact className="shrink-0" />
          <Link
            href="/analytics/"
            className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-ink/40 transition hover:text-accent"
            title="埋点与行为漏斗"
          >
            <span className="cm-status-dot" />
            Live
          </Link>
        </div>
        {/* Desktop top tabs — same destinations as bottom bar */}
        <div className="hidden border-t border-ink/8 px-2 lg:block">
          <BottomTabBar active={tab} onChange={changeTab} variant="top" />
        </div>
      </div>
      <main
        className={cn(
          "min-w-0 flex-1",
          lockViewport
            ? "min-h-0 overflow-hidden"
            : "safe-main lg:pb-0"
        )}
      >
        {tab === "catalog" && <CatalogView />}
        {tab === "sessions" && <SessionsView />}
        {tab === "schedule" && <ScheduleView />}
        {tab === "map" && <MapView />}
      </main>
      <div className="lg:hidden">
        <BottomTabBar active={tab} onChange={changeTab} variant="bottom" />
      </div>
    </div>
  );
}
