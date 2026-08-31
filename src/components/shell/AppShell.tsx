"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { CatalogView } from "@/components/catalog/CatalogView";
import { SessionsView } from "@/components/sessions/SessionsView";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { MapView } from "@/components/map/MapView";
import { FestivalPicker } from "@/components/home/FestivalPicker";
import { BottomTabBar, type MainTab } from "@/components/shell/BottomTabBar";
import { ThemeSwitcher } from "@/components/shell/ThemeSwitcher";
import type { FestivalEntry } from "@/types/festival";

const STORAGE_KEY = "cinemap-active-festival-v1";

export function AppShell() {
  const [festival, setFestival] = useState<FestivalEntry | null>(null);
  const [tab, setTab] = useState<MainTab>("catalog");

  // Restore last festival after mount — never block first paint
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FestivalEntry;
      if (parsed?.id && parsed.available) setFestival(parsed);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const enterFestival = (f: FestivalEntry) => {
    setFestival(f);
    setTab("catalog");
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f));
    } catch {
      /* private mode etc. */
    }
  };

  const leaveFestival = () => {
    setFestival(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  if (!festival) {
    return <FestivalPicker onSelect={enterFestival} />;
  }

  return (
    <div
      className={
        tab === "map" || tab === "sessions"
          ? "relative mx-auto flex h-dvh w-full max-w-lg min-w-0 flex-col overflow-hidden sm:my-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-2xl sm:border sm:border-ink/10 sm:shadow-[0_12px_40px_color-mix(in_srgb,var(--ink)_14%,transparent)]"
          : "relative mx-auto flex min-h-dvh w-full max-w-lg min-w-0 flex-col overflow-x-hidden"
      }
    >
      <div className="safe-top sticky top-0 z-[700] border-b border-ink/10 bg-panel-raised/78 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 py-2">
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
            </p>
            <p className="truncate font-display text-sm font-black tracking-tight text-ink">
              {festival.title}
            </p>
          </div>
          <ThemeSwitcher compact className="shrink-0" />
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-ink/40">
            <span className="cm-status-dot" />
            Live
          </span>
        </div>
      </div>
      <main
        className={
          tab === "map" || tab === "sessions"
            ? "min-h-0 min-w-0 flex-1 overflow-hidden"
            : "safe-main min-w-0 flex-1"
        }
      >
        {tab === "catalog" && <CatalogView />}
        {tab === "sessions" && <SessionsView />}
        {tab === "schedule" && <ScheduleView />}
        {tab === "map" && <MapView />}
      </main>
      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  );
}
