"use client";

import { Check, ChevronDown, Heart, Plus } from "lucide-react";
import type { Cinema } from "@/types/cinema";
import type { Film, Screening } from "@/types/film";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  formatScore,
  resolveFilmScores,
} from "@/utils/filmRatings";
import {
  formatDirectorCredit,
  formatDirectorList,
  splitDirectorNames,
} from "@/utils/directors";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatRuntime(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatSessionDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return `${md} ${WEEKDAYS[d.getDay()]}`;
}

function WantButton({
  wanted,
  onToggle,
  size = "sm",
}: {
  wanted: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-pressed={wanted}
      aria-label={wanted ? "取消想看" : "标记想看"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-mono font-bold tracking-wide transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        wanted
          ? "border-accent/50 bg-accent text-white"
          : "border-ink/15 cm-frost-soft text-ink/55 hover:border-accent/40 hover:text-accent"
      )}
    >
      <Heart
        className={cn(
          size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
          wanted && "fill-current"
        )}
      />
      想看
    </button>
  );
}

type FilmCardProps = {
  film: Film;
  cinemasById: Map<string, Cinema>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isScreeningAdded: (screeningId: string) => boolean;
  onToggleScreening: (screening: Screening) => void;
  /** How many local plans include this screening */
  bookedCountOf?: (screeningId: string) => number;
  conflictHintId?: string | null;
  wanted: boolean;
  onToggleWant: () => void;
  /** Desktop list: highlight as selected (detail shown elsewhere) */
  selected?: boolean;
  /** Hide inline expand body from lg up (detail lives in side pane) */
  hideExpandOnLg?: boolean;
};

export function FilmCard({
  film,
  cinemasById,
  isExpanded,
  onToggleExpand,
  isScreeningAdded,
  onToggleScreening,
  bookedCountOf,
  conflictHintId,
  wanted,
  onToggleWant,
  selected = false,
  hideExpandOnLg = false,
}: FilmCardProps) {
  const [from, to] = film.posterGradient ?? ["#c4b8a4", "#e85d33"];
  const meta = [
    String(film.year ?? ""),
    (film.countries ?? []).join("/") || "—",
    formatRuntime(film.runtimeMin),
  ].join(" · ");
  const scores = resolveFilmScores(film);

  return (
    <article
      className={cn(
        "cm-frost-card overflow-hidden rounded-lg border-2 transition-colors",
        isExpanded || selected
          ? "border-accent/50 shadow-[inset_3px_0_0_0_var(--accent)]"
          : wanted
            ? "border-accent/25"
            : "border-ink/10 hover:border-ink/20"
      )}
    >
      <div className="h-1 w-full cm-hazard" aria-hidden />
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full gap-3 p-3 text-left"
        aria-expanded={isExpanded}
      >
        <div
          className="relative h-[5.5rem] w-[3.75rem] shrink-0 overflow-hidden rounded-md border border-ink/10 bg-chassis"
          style={
            film.poster
              ? undefined
              : {
                  background: `linear-gradient(160deg, ${from} 0%, ${to} 100%)`,
                }
          }
          aria-hidden={!film.poster}
        >
          {film.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={film.poster}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate font-display text-[16px] font-black tracking-tight text-ink">
                {film.titleZh}
              </h2>
              <p className="truncate font-mono text-[11px] font-semibold text-ink/40">
                {film.titleEn}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 text-ink/35 transition-transform",
                isExpanded && "rotate-180 text-accent"
              )}
            />
          </div>
          <p className="mt-1 font-mono text-[11px] font-medium leading-relaxed text-ink/55">
            {meta}
            <span className="mx-1 text-ink/20">·</span>
            Dir {formatDirectorCredit(film.director)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-ink/12 bg-chassis/50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink/60">
              {film.section}
            </span>
            <span className="font-mono text-[10px] font-bold text-ink/45">
              豆 {formatScore(scores.douban)} · IMDb {formatScore(scores.imdb)}{" "}
              · LB {formatScore(scores.letterboxd)}
            </span>
          </div>
          {!isExpanded && (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink/35">
                {film.screenings.length} sessions
              </p>
              <WantButton wanted={wanted} onToggle={onToggleWant} />
            </div>
          )}
        </div>
      </button>

      {isExpanded && (
        <div
          className={cn(
            "space-y-2 border-t border-ink/8 bg-panel/80 px-3 pb-3 pt-2",
            hideExpandOnLg && "lg:hidden"
          )}
        >          {splitDirectorNames(film.director).length > 1 && (
            <p className="font-mono text-[10px] leading-relaxed text-ink/50">
              <span className="font-bold uppercase tracking-[0.12em] text-ink/40">
                <span className="text-accent">{"//"}</span> Directors
              </span>
              <span className="mt-1 block text-[11px] text-ink/65">
                {formatDirectorList(film.director)}
              </span>
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">
              <span className="text-accent">{"//"}</span> Sessions
            </p>
            <WantButton wanted={wanted} onToggle={onToggleWant} size="md" />
          </div>
          {film.screenings.map((s) => {
            const cinema = cinemasById.get(s.cinemaId);
            const added = isScreeningAdded(s.id);
            const conflict = conflictHintId === s.id;
            return (
              <div
                key={s.id}
                className={cn(
                  "rounded-md border px-2.5 py-2",
                  added
                    ? "border-signal/40 bg-signal/10"
                    : "border-ink/10 cm-frost-soft"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[12px] font-bold text-ink">
                      {formatSessionDate(s.date)}
                      <span className="mx-1.5 text-ink/25">·</span>
                      <span className="text-signal-dim">
                        {s.start} – {s.end}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] font-medium text-ink/55">
                      {cinema?.nameZh ?? s.cinemaId}
                      {s.hall ? ` · ${s.hall}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {s.price > 0 ? (
                        <span className="font-mono text-[13px] font-black text-accent">
                          ¥{s.price}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] font-bold text-ink/40">
                          票价以现场为准
                        </span>
                      )}
                      {(s.techTags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="rounded border border-ink/12 bg-chassis/40 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ink/55"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={added ? "accent" : "outline"}
                      className={cn(
                        "h-8 px-2.5 font-mono text-[10px] font-bold uppercase tracking-wide",
                        added &&
                          "border-signal bg-signal text-white hover:bg-signal-dim"
                      )}
                      onClick={() => onToggleScreening(s)}
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
                    </Button>
                    <span className="font-mono text-[9px] font-semibold text-ink/35">
                      {bookedCountOf?.(s.id) ?? 0} booked
                    </span>
                  </div>
                </div>
                {conflict && (
                  <p className="mt-1.5 font-mono text-[10px] font-semibold text-accent">
                    与已排场次时间冲突，仍可加入但排片页会标红。
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
