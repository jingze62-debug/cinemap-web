"use client";

import type { Cinema } from "@/types/cinema";
import type { Film, Screening } from "@/types/film";
import type { MatchDiff } from "@/utils/matchCompressor";
import { cn } from "@/lib/utils";

type DiffReportProps = {
  diff: MatchDiff;
  myName: string;
  theirName: string;
  screeningsById: Map<string, Screening>;
  filmsById: Map<string, Film>;
  cinemasById: Map<string, Cinema>;
};

function SessionLine({
  id,
  screeningsById,
  filmsById,
  cinemasById,
}: {
  id: string;
  screeningsById: Map<string, Screening>;
  filmsById: Map<string, Film>;
  cinemasById: Map<string, Cinema>;
}) {
  const s = screeningsById.get(id);
  if (!s) {
    return (
      <li className="rounded-lg border border-dashed border-ink/15 px-3 py-2 text-xs text-ink/40">
        未知场次 {id}
      </li>
    );
  }
  const film = filmsById.get(s.filmId);
  const cinema = cinemasById.get(s.cinemaId);
  return (
    <li className="rounded-lg border border-ink/10 bg-white/60 px-3 py-2 text-xs">
      <p className="font-medium text-ink">{film?.titleZh ?? s.filmId}</p>
      <p className="mt-0.5 text-ink/50">
        {s.date} {s.start}–{s.end} · {cinema?.nameZh}
      </p>
    </li>
  );
}

export function DiffReport({
  diff,
  myName,
  theirName,
  screeningsById,
  filmsById,
  cinemasById,
}: DiffReportProps) {
  const sections: {
    key: keyof MatchDiff;
    title: string;
    tone: string;
  }[] = [
    { key: "both", title: `共同场次 · ${diff.both.length}`, tone: "border-emerald-200 bg-emerald-50/50" },
    { key: "onlyMine", title: `仅 ${myName} · ${diff.onlyMine.length}`, tone: "border-sky-200 bg-sky-50/50" },
    { key: "onlyTheirs", title: `仅 ${theirName} · ${diff.onlyTheirs.length}`, tone: "border-amber-200 bg-amber-50/50" },
  ];

  return (
    <div className="space-y-4">
      {sections.map((sec) => (
        <section
          key={sec.key}
          className={cn("rounded-2xl border p-3", sec.tone)}
        >
          <h3 className="text-xs font-semibold tracking-wide text-ink/70">
            {sec.title}
          </h3>
          {diff[sec.key].length === 0 ? (
            <p className="mt-2 text-xs text-ink/40">无</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {diff[sec.key].map((id) => (
                <SessionLine
                  key={id}
                  id={id}
                  screeningsById={screeningsById}
                  filmsById={filmsById}
                  cinemasById={cinemasById}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
