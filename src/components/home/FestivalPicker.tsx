"use client";

import { useEffect, useMemo, useState } from "react";
import type { FestivalEntry } from "@/types/festival";
import { ThemeSwitcher } from "@/components/shell/ThemeSwitcher";

type FestivalPickerProps = {
  onSelect: (festival: FestivalEntry) => void;
};

function shortName(f: FestivalEntry): string {
  if (f.art === "siff") return "上海国际电影节";
  if (f.id === "dust_in_heart_2026") return "尘埃中的心：德国电影史选映";
  return f.title;
}

/** Days from today to festival window (0 if ongoing). Smaller = closer. */
function festivalDistanceDays(f: FestivalEntry, today = new Date()): number {
  const start = f.startDate ? new Date(`${f.startDate}T12:00:00`) : null;
  const end = f.endDate ? new Date(`${f.endDate}T12:00:00`) : start;
  if (!start || Number.isNaN(start.getTime())) return Number.POSITIVE_INFINITY;
  const t = new Date(today);
  t.setHours(12, 0, 0, 0);
  const endSafe =
    end && !Number.isNaN(end.getTime()) ? end : start;
  if (t >= start && t <= endSafe) return 0;
  const msDay = 86400000;
  if (t < start) return (start.getTime() - t.getTime()) / msDay;
  return (t.getTime() - endSafe.getTime()) / msDay;
}

function sortFestivalsByProximity(list: FestivalEntry[]): FestivalEntry[] {
  return [...list].sort((a, b) => {
    const da = festivalDistanceDays(a);
    const db = festivalDistanceDays(b);
    if (da !== db) return da - db;
    return (a.startDate ?? "").localeCompare(b.startDate ?? "");
  });
}

export function FestivalPicker({ onSelect }: FestivalPickerProps) {
  const [festivals, setFestivals] = useState<FestivalEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bootLine, setBootLine] = useState(0);
  /** Client-only — avoid SSR/client clock mismatch (hydration error). */
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    setClock(fmt());
    const id = window.setInterval(() => setClock(fmt()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/festivals.json")
      .then((r) => {
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((data: { festivals: FestivalEntry[] }) => {
        if (cancelled) return;
        const sorted = sortFestivalsByProximity(data.festivals);
        setFestivals(sorted);
        const first = sorted.find((f) => f.available);
        setSelectedId(first?.id ?? null);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (bootLine >= 2) return;
    const t = window.setTimeout(() => setBootLine((n) => n + 1), 160);
    return () => window.clearTimeout(t);
  }, [bootLine]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return festivals;
    return festivals.filter((f) => {
      const hay = `${f.id} ${f.title} ${shortName(f)} ${f.dateRange}`.toLowerCase();
      return hay.includes(q);
    });
  }, [festivals, query]);

  const runSelected = () => {
    const target =
      festivals.find((f) => f.id === selectedId && f.available) ??
      festivals.find((f) => f.available);
    if (target) onSelect(target);
  };

  return (
    <div className="festival-term relative mx-auto min-h-dvh w-full max-w-lg text-ink">
      <div className="safe-top relative px-4 pb-10 pt-6 font-mono text-[14px] leading-relaxed">
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink/15 pb-3 text-[11px] font-semibold tracking-[0.08em] text-ink/55">
          <span className="inline-flex items-center gap-2">
            <span className="cm-status-dot" />
            <span className="text-signal-dim">信号 · Ok</span>
          </span>
          <span className="text-ink/70">{clock}</span>
          <span className="text-accent">入口 · 01</span>
        </div>

        <header className="mt-6 animate-fade-up">
          <div className="flex items-start gap-3">
            <div className="cm-frost flex h-14 w-14 shrink-0 items-center justify-center border-2 border-ink font-display text-2xl font-black tracking-tight text-ink">
              00
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-ink/50">
                <span className="text-accent">{"//"}</span> 启动 · 选择电影节/展
              </p>
              <h1 className="mt-1.5 font-display text-[1.75rem] font-black leading-[1.15] tracking-tight text-ink sm:text-[1.85rem]">
                进入<span className="text-accent">影展</span>
                <span className="ml-1.5 font-mono text-[0.55em] font-bold uppercase tracking-[0.08em] text-ink/35">
                  Enter Festival
                </span>
              </h1>
              <p className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-ink/50">
                <span className="cm-status-dot" />
                等待选择 · Ready
              </p>
            </div>
          </div>
        </header>

        <div className="mt-5 h-0.5 w-full bg-gradient-to-r from-accent via-accent/50 to-transparent" />

        <div className="mt-5 space-y-1 text-[13px] font-medium text-ink/55">
          {bootLine >= 1 && (
            <p>
              <span className="font-bold text-signal-dim">ok</span> 检索 → 选择{" "}
              <span className="font-bold text-accent">电影节/展</span> → 进入
            </p>
          )}
          {bootLine >= 2 && (
            <p>
              <span className="font-bold text-signal-dim">就绪</span>
              <span className="term-cursor ml-1 inline-block h-3.5 w-2 translate-y-[2px] bg-accent" />
            </p>
          )}
        </div>

        <div className="cm-frost mt-6 rounded-xl border-2 border-ink/12 p-4">
          <p className="text-[12px] font-semibold text-ink/60">
            <span className="text-accent">{"//"}</span> 搜索电影节/展
          </p>

          <div className="mt-3 flex items-end gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">搜索电影节/展</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSelected();
                }}
                placeholder="输入名称或关键词…"
                spellCheck={false}
                autoComplete="off"
                className="w-full border-0 border-b-2 border-ink/20 bg-transparent pb-1 font-mono text-[15px] font-semibold text-ink outline-none placeholder:text-ink/30 focus:border-accent"
              />
            </label>
            <button
              type="button"
              onClick={runSelected}
              className="shrink-0 border-2 border-accent bg-accent px-3.5 py-1 font-mono text-[12px] font-bold tracking-wider text-white transition hover:bg-accent-soft"
            >
              进入
            </button>
          </div>
        </div>

        <p className="mt-6 text-[11px] font-semibold tracking-[0.12em] text-ink/45">
          <span className="text-accent">{"//"}</span> A 面 · 可选电影节/展
        </p>

        {status === "loading" && (
          <p className="mt-4 animate-pulse font-semibold text-ink/45">
            正在加载电影节/展列表…
          </p>
        )}
        {status === "error" && (
          <p className="mt-4 font-semibold text-accent">
            加载失败，请刷新重试
          </p>
        )}

        {status === "ready" && (
          <>
            <ul className="mt-3 space-y-3">
              {filtered.length === 0 && (
                <li className="text-ink/35"># 无匹配结果</li>
              )}
              {filtered
                .filter((f) => f.available)
                .map((f, i) => {
                  const label = shortName(f);
                  const idx = String(i + 1).padStart(2, "0");
                  const poster = f.poster ?? `/posters/${f.id}.svg`;

                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(f.id);
                          onSelect(f);
                        }}
                        className="group cm-frost-card flex w-full items-stretch gap-3 rounded-lg border-2 border-ink/10 p-2.5 text-left text-ink/75 transition-colors hover:border-ink/25 hover:text-ink"
                      >
                        <div className="relative h-[5.5rem] w-[4.1rem] shrink-0 overflow-hidden rounded-md border border-ink/12 bg-chassis">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={poster}
                            alt={`${label} 海报`}
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                          <div>
                            <p className="font-mono text-[12px] font-bold">
                              <span className="text-ink/30">{idx}</span>
                              <span className="mx-1.5 text-ink/20">·</span>
                              <span>{f.id}</span>
                            </p>
                            <p className="mt-1 truncate font-display text-[16px] font-black leading-tight">
                              {label}
                            </p>
                            <p className="mt-1 font-mono text-[11px] font-semibold text-ink/45">
                              [{f.dateRange}]
                              {f.editionLabel ? ` · ${f.editionLabel}` : ""}
                            </p>
                          </div>
                          <span className="self-end font-mono text-[11px] font-bold tracking-wider text-ink/30 group-hover:text-ink/60">
                            进入
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
            </ul>

            {!query.trim() && (
              <div className="mt-5 border border-dashed border-ink/15 px-4 py-5 text-center">
                <p className="font-display text-[15px] font-black tracking-tight text-ink/40">
                  敬请期待
                </p>
                <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink/30">
                  Pretty soon
                </p>
                <p className="mt-2 font-mono text-[10px] font-semibold text-ink/25">
                  {"// more festivals incoming"}
                </p>
              </div>
            )}
          </>
        )}

        <div className="mt-8">
          <ThemeSwitcher />
        </div>

        <footer className="mt-8 border-t-2 border-ink/10 pt-4 font-mono text-[10px] font-semibold tracking-[0.12em] text-ink/35">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href="/analytics/"
              className="inline-flex items-center gap-1.5 text-ink/30 transition hover:text-accent"
              title="内部数据"
              aria-label="内部数据"
            >
              <span className="cm-status-dot opacity-60" />
              Live
            </a>
            <span className="text-accent/70">信号结束</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
