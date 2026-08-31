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
  /** bottom = mobile dock; top = desktop header strip */
  variant?: "bottom" | "top";
};

export function BottomTabBar({
  active,
  onChange,
  variant = "bottom",
}: BottomTabBarProps) {
  if (variant === "top") {
    return (
      <nav className="flex h-11 items-stretch gap-0.5" aria-label="主导航">
        {TABS.map(({ id, label, code, icon: Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-2 px-2 font-mono text-[12px] font-bold transition-colors",
                isActive
                  ? "border-b-2 border-accent text-accent"
                  : "border-b-2 border-transparent text-ink/45 hover:text-ink/75"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "text-[9px] tracking-[0.12em]",
                  isActive ? "text-signal-dim" : "text-ink/35"
                )}
              >
                {code}
              </span>
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate tracking-wide">{label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      className="safe-bottom shrink-0 border-t border-ink/15 bg-panel-raised/92 backdrop-blur-xl"
      aria-label="主导航"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-0.5 pt-1.5 pb-1.5">
        {TABS.map(({ id, label, code, icon: Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 pb-1.5 pt-0.5 transition-colors",
                isActive ? "text-accent" : "text-ink/45 hover:text-ink/75"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "font-mono text-[8px] font-bold leading-none tracking-[0.12em]",
                  isActive ? "text-signal-dim" : "text-ink/35"
                )}
              >
                {code}
              </span>
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  isActive && "stroke-[2.4]"
                )}
                aria-hidden
              />
              <span className="max-w-full truncate px-0.5 font-mono text-[10px] font-bold leading-none tracking-wide">
                {label}
              </span>
              {isActive && (
                <span
                  className="absolute bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-accent"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
