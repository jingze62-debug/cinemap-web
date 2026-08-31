"use client";

import type { Cinema } from "@/types/cinema";
import type { Film, Screening } from "@/types/film";

type CommemorativeTicketProps = {
  planName: string;
  items: Array<{
    screening: Screening;
    film: Film;
    cinema?: Cinema;
  }>;
};

/** 16:10 commemorative ticket surface */
export function CommemorativeTicket({
  planName,
  items,
}: CommemorativeTicketProps) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-ink/15 bg-[#f7f1e6] text-ink shadow-sm"
      style={{ aspectRatio: "16 / 10" }}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-28deg, transparent, transparent 10px, rgba(44,36,28,0.04) 10px, rgba(44,36,28,0.04) 20px)",
        }}
      />
      <div className="relative flex h-full flex-col p-[4%]">
        <div className="flex items-start justify-between gap-2 border-b border-dashed border-ink/20 pb-2">
          <div>
            <p className="text-[9px] tracking-[0.22em] text-ink/40">
              CINEMAP · 2026
            </p>
            <h3 className="mt-0.5 font-display text-base font-semibold sm:text-lg">
              纪念票根
            </h3>
          </div>
          <p className="max-w-[40%] truncate text-right text-[10px] text-ink/50">
            {planName}
          </p>
        </div>
        <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-hidden">
          {items.slice(0, 5).map(({ screening: s, film, cinema }) => (
            <li
              key={s.id}
              className="flex items-baseline justify-between gap-2 text-[10px] sm:text-[11px]"
            >
              <span className="min-w-0 truncate font-medium">
                {film.titleZh}
              </span>
              <span className="shrink-0 text-ink/45">
                {s.start} · {cinema?.nameZh ?? ""}
              </span>
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-[11px] text-ink/35">暂无场次</li>
          )}
          {items.length > 5 && (
            <li className="text-[10px] text-ink/35">
              另有 {items.length - 5} 场…
            </li>
          )}
        </ul>
        <p className="mt-auto border-t border-dashed border-ink/15 pt-2 text-[9px] tracking-wide text-ink/35">
          LOCAL-FIRST · 免登录影展伴侣
        </p>
      </div>
    </div>
  );
}
