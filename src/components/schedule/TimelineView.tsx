"use client";

import { Trash2 } from "lucide-react";
import type { Cinema } from "@/types/cinema";
import type { Film, Screening } from "@/types/film";
import { TransitBadge } from "@/components/schedule/TransitBadge";
import {
  computeGap,
  sortScreenings,
  type TransitGap,
} from "@/utils/transitEngine";
import type { TransitMatrix, TravelModesMatrix } from "@/utils/dataLoader";

type TimelineViewProps = {
  screenings: Screening[];
  filmsById: Map<string, Film>;
  cinemasById: Map<string, Cinema>;
  matrix: TransitMatrix;
  travelModes?: TravelModesMatrix;
  onRemove: (screeningId: string) => void;
};

export function TimelineView({
  screenings,
  filmsById,
  cinemasById,
  matrix,
  travelModes,
  onRemove,
}: TimelineViewProps) {
  const sorted = sortScreenings(screenings);

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-ink/20 bg-panel-raised/60 px-4 py-12 text-center font-mono text-sm font-semibold text-ink/40">
        还没有场次。去「选电影」加入日程吧。
      </div>
    );
  }

  const items: Array<
    | { type: "session"; screening: Screening }
    | { type: "gap"; gap: TransitGap }
  > = [];

  sorted.forEach((s, i) => {
    items.push({ type: "session", screening: s });
    if (i < sorted.length - 1) {
      items.push({
        type: "gap",
        gap: computeGap(
          s,
          sorted[i + 1],
          matrix,
          cinemasById,
          travelModes
        ),
      });
    }
  });

  return (
    <div className="space-y-2">
      {items.map((item) => {
        if (item.type === "gap") {
          return (
            <TransitBadge
              key={`gap-${item.gap.from.id}-${item.gap.to.id}`}
              gap={item.gap}
            />
          );
        }
        const s = item.screening;
        const film = filmsById.get(s.filmId);
        const cinema = cinemasById.get(s.cinemaId);

        return (
          <article
            key={s.id}
            className="relative overflow-hidden rounded-xl border-2 border-ink/10 bg-panel-raised text-ink"
          >
            <div className="h-1 w-full cm-hazard" aria-hidden />
            <div className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">
                    <span className="text-accent">{"//"}</span> {s.date}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-black tracking-tight">
                    {film?.titleZh ?? s.filmId}
                  </h3>
                  <p className="mt-1 font-mono text-[13px] font-semibold text-ink/65">
                    <span className="text-signal-dim">
                      {s.start} – {s.end}
                    </span>
                    <span className="mx-1.5 opacity-40">·</span>
                    {cinema?.nameZh ?? s.cinemaId}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.techTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-ink/15 bg-chassis/60 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(s.id)}
                  className="rounded-md border-2 border-ink/10 bg-panel p-2 text-ink/50 hover:border-accent/50 hover:text-accent"
                  aria-label="移出场次"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
