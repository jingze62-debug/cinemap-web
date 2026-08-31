"use client";

import { Bike, CarFront, Footprints, TrainFront } from "lucide-react";
import type { TransitGap } from "@/utils/transitEngine";
import { cn } from "@/lib/utils";

type TransitBadgeProps = {
  gap: TransitGap;
  /** Tighter padding for calendar column gaps */
  compact?: boolean;
};

/** Minimal label when two screenings overlap — no transit row */
export function OverlapConflictBadge({
  overlapMin,
  className,
}: {
  overlapMin: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-[#e03a1a]/30 bg-panel-raised/[0.94] px-1.5 py-px font-mono text-[8px] font-bold shadow-sm backdrop-blur-md",
        className
      )}
    >
      <span className="h-1 w-1 shrink-0 rounded-full bg-[#e03a1a]" aria-hidden />
      {overlapMin > 0 && (
        <span className="text-ink/45">重叠 {overlapMin}′ ·</span>
      )}
      <span className="text-[#e03a1a]">冲突</span>
    </span>
  );
}

/** Shared frosted shell — readable on colored screening blocks */
const FROST_SHELL =
  "border border-ink/12 bg-panel-raised/[0.94] shadow-[0_2px_10px_color-mix(in_srgb,var(--ink)_9%,transparent)] backdrop-blur-md";

const FROST_BOX = "";

/** Schedule overlap — red status accent only */
const OVERLAP = {
  box: "",
  dot: "bg-[#e03a1a]",
  status: "font-black text-[#e03a1a]",
} as const;

const LEVEL_STYLE: Record<
  TransitGap["level"],
  {
    box: string;
    label: string;
    dot: string;
    status: string;
    rail?: string;
  }
> = {
  conflict: {
    box: FROST_BOX,
    label: "赶不上",
    dot: "bg-[#e03a1a]",
    status: "font-black text-[#e03a1a]",
    rail: "border-l-[3px] border-l-[#e03a1a]",
  },
  tight: {
    box: FROST_BOX,
    label: "较紧",
    dot: "bg-[#d97706]",
    status: "font-bold text-[#c2410c]",
    rail: "border-l-[3px] border-l-[#d97706]",
  },
  ok: {
    box: FROST_BOX,
    label: "够用",
    dot: "bg-signal",
    status: "font-bold text-signal-dim",
  },
  loose: {
    box: FROST_BOX,
    label: "充裕",
    dot: "bg-signal",
    status: "font-bold text-signal-dim",
  },
};

function ModeChip({
  icon: Icon,
  label,
  minutes,
  warn,
  compact,
}: {
  icon: typeof Footprints;
  label: string;
  minutes: number;
  warn?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded border font-mono font-semibold tabular-nums",
        compact ? "px-0.5 py-px text-[7px]" : "px-1 py-px text-[8px]",
        warn
          ? "border-[color:rgba(224,58,26,0.35)] bg-[rgba(224,58,26,0.1)] text-[#e03a1a]"
          : "border-ink/12 bg-panel-raised text-ink/60 shadow-[0_1px_0_color-mix(in_srgb,var(--ink)_5%,transparent)]"
      )}
      title={`${label}约 ${minutes} 分钟`}
    >
      <Icon
        className={cn("shrink-0 opacity-70", compact ? "h-2 w-2" : "h-2.5 w-2.5")}
        aria-hidden
      />
      {minutes}′
    </span>
  );
}

/** Always 2 rows: status line + transport chips (no wrap). */
export function TransitBadge({ gap, compact = false }: TransitBadgeProps) {
  const style = LEVEL_STYLE[gap.level];
  const { modes } = gap;

  if (modes.sameVenue) {
    const overlap = gap.gapMin <= 0;
    return (
      <div
        className={cn("flex justify-center", compact ? "my-0.5" : "py-1.5")}
        aria-label={overlap ? "同馆时间冲突" : "同馆间隔"}
      >
        <div
          className={cn(
            "inline-flex flex-col items-center gap-0.5 rounded-lg py-0.5",
            FROST_SHELL,
            overlap ? OVERLAP.box : FROST_BOX,
            compact ? "w-full max-w-full px-2" : "w-full max-w-[90%] px-1.5",
            !compact && "gap-1 px-2 py-1"
          )}
        >
          <p
            className={cn(
              "whitespace-nowrap font-mono text-[9px] font-bold",
              overlap ? "text-ink/55" : "text-ink/55"
            )}
          >
            {overlap ? (
              <>
                同馆 ·{" "}
                {gap.gapMin < 0 && (
                  <span className="text-ink/45">
                    重叠 {Math.abs(gap.gapMin)}′ ·{" "}
                  </span>
                )}
                <span className={OVERLAP.status}>冲突</span>
              </>
            ) : (
              `同馆 · 间隔 ${gap.gapMin}′`
            )}
          </p>
          {!overlap && (
            <p className="whitespace-nowrap font-mono text-[8px] font-semibold text-ink/35">
              无需转场
            </p>
          )}
        </div>
      </div>
    );
  }

  const overlap = gap.gapMin <= 0;
  const statusLabel = overlap ? "冲突" : style.label;
  const lookStyle = overlap ? OVERLAP : style;
  const lookUrgent = !overlap && (gap.level === "conflict" || gap.level === "tight");
  const chipWarn = (minutes: number) =>
    !overlap && gap.gapMin > 0 && minutes > gap.gapMin;

  return (
    <div
      className={cn("flex justify-center", compact ? "my-0.5" : "py-1.5")}
      aria-label={overlap ? "时间冲突" : "转场通勤"}
    >
      <div
        className={cn(
          "inline-flex flex-col items-center gap-0.5 rounded-lg py-0.5",
          FROST_SHELL,
          lookStyle.box,
          !overlap && "rail" in lookStyle && lookStyle.rail,
          compact ? "w-full max-w-full px-2" : "w-full max-w-[90%] px-1.5",
          !compact && "gap-1 px-2 py-1"
        )}
      >
        <div className="flex w-full min-w-0 items-center justify-center gap-1 whitespace-nowrap font-mono text-[9px] font-bold tracking-wide text-ink/55">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              lookStyle.dot,
              lookUrgent && "ring-2 ring-[#e03a1a]/20"
            )}
            aria-hidden
          />
          <span>
            {overlap ? (
              <>
                {gap.gapMin < 0 && (
                  <span className="text-ink/45">
                    重叠 {Math.abs(gap.gapMin)}′ ·{" "}
                  </span>
                )}
                <span className={lookStyle.status}>{statusLabel}</span>
              </>
            ) : (
              <>
                间隔 {gap.gapMin}′ ·{" "}
                <span className={lookStyle.status}>{statusLabel}</span>
              </>
            )}
          </span>
          {gap.crossDistrict && (
            <span
              className={cn(
                "rounded border px-1 py-px text-[8px] font-semibold",
                overlap
                  ? "border-ink/15 text-ink/40"
                  : lookUrgent
                    ? "border-[#e03a1a]/25 text-[#c2410c]"
                    : "border-ink/15 text-ink/40"
              )}
            >
              跨区
            </span>
          )}
        </div>
        <div className="flex w-full min-w-0 flex-nowrap items-center justify-center gap-0.5">
          <ModeChip
            icon={Footprints}
            label="步行"
            minutes={modes.walkMin}
            warn={chipWarn(modes.walkMin)}
            compact={compact}
          />
          <ModeChip
            icon={Bike}
            label="骑行"
            minutes={modes.bikeMin}
            warn={chipWarn(modes.bikeMin)}
            compact={compact}
          />
          <ModeChip
            icon={TrainFront}
            label="地铁"
            minutes={modes.metroMin}
            warn={chipWarn(modes.metroMin)}
            compact={compact}
          />
          <ModeChip
            icon={CarFront}
            label="打车"
            minutes={modes.taxiMin}
            warn={chipWarn(modes.taxiMin)}
            compact={compact}
          />
        </div>
      </div>
    </div>
  );
}
