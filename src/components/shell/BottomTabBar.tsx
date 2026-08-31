"use client";

import { Clapperboard, Clock3, CalendarDays, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export type MainTab = "catalog" | "sessions" | "schedule" | "map";

const TABS: {
  id: MainTab;
  label: string;
  code: string;
  icon: typeof Clapperboard;
}[] = [
  { id: "catalog", label: "选电影", code: "01", icon: Clapperboard },
  { id: "sessions", label: "挑场次", code: "02", icon: Clock3 },
  { id: "schedule", label: "排片", code: "03", icon: CalendarDays },
  { id: "map", label: "影院地图", code: "04", icon: MapPin },
];

type BottomTabBarProps = {
  active: MainTab;
  onChange: (tab: MainTab) => void;
};

export function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-[600] border-t border-ink/15 bg-panel-raised/82 backdrop-blur-xl"
      aria-label="主导航"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-0.5">
        {TABS.map(({ id, label, code, icon: Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                isActive ? "text-accent" : "text-ink/45 hover:text-ink/75"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "font-mono text-[8px] font-bold tracking-[0.12em]",
                  isActive ? "text-signal-dim" : "text-ink/35"
                )}
              >
                {code}
              </span>
              <Icon
                className={cn("h-[18px] w-[18px]", isActive && "stroke-[2.4]")}
                aria-hidden
              />
              <span className="font-mono text-[10px] font-bold tracking-wide">
                {label}
              </span>
              {isActive && (
                <span className="mt-0.5 h-0.5 w-5 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
