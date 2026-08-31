"use client";

import { Heart, Search, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterSelect } from "@/components/ui/FilterSelect";

export type CatalogFilterValues = {
  query: string;
  date: string;
  cinemaId: string;
  section: string;
  director: string;
};

type Option = { value: string; label: string };

type CatalogSearchPanelProps = {
  values: CatalogFilterValues;
  onChange: (next: Partial<CatalogFilterValues>) => void;
  dates: string[];
  cinemas: Option[];
  sections: string[];
  directors: string[];
  listScope: "all" | "wanted";
  onListScopeChange: (scope: "all" | "wanted") => void;
  wantedCount: number;
};

function formatDateLabel(iso: string): string {
  if (iso === "全部") return "全部日期";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${m}月${d}日`;
}

export function CatalogSearchPanel({
  values,
  onChange,
  dates,
  cinemas,
  sections,
  directors,
  listScope,
  onListScopeChange,
  wantedCount,
}: CatalogSearchPanelProps) {
  const dateOptions: Option[] = [
    { value: "全部", label: "全部日期" },
    ...dates.map((d) => ({ value: d, label: formatDateLabel(d) })),
  ];
  const cinemaOptions: Option[] = [
    { value: "全部", label: "全部影院" },
    ...cinemas,
  ];
  const sectionOptions: Option[] = [
    { value: "全部", label: "全部单元" },
    ...sections
      .filter((s) => s !== "全部")
      .map((s) => ({ value: s, label: s })),
  ];
  const directorOptions: Option[] = [
    { value: "全部", label: "全部导演" },
    ...directors.map((d) => ({ value: d, label: d })),
  ];

  const activeCount = [
    values.date !== "全部",
    values.cinemaId !== "全部",
    values.section !== "全部",
    values.director !== "全部",
    Boolean(values.query.trim()),
  ].filter(Boolean).length;

  const clearAll = () =>
    onChange({
      query: "",
      date: "全部",
      cinemaId: "全部",
      section: "全部",
      director: "全部",
    });

  return (
    <section className="cm-frost rounded-xl border-2 border-ink/10">
      <div className="h-1 w-full cm-hazard" aria-hidden />
      <div className="relative space-y-2.5 p-3 pt-3.5">
        <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink/40">
              <span className="text-accent">{"//"}</span> 筛选 · Find
            </p>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded-md border border-ink/12 bg-paper/60 px-2 py-0.5 font-mono text-[10px] font-bold text-ink/45 transition-colors hover:border-accent/40 hover:text-accent"
            >
              <RotateCcw className="h-3 w-3" />
              清除 {activeCount}
            </button>
          ) : null}
        </div>

        <div className="flex gap-1.5" role="tablist" aria-label="片单范围">
          <button
            type="button"
            role="tab"
            aria-selected={listScope === "all"}
            onClick={() => onListScopeChange("all")}
            className={cn(
              "rounded-md border px-2.5 py-1.5 font-mono text-[11px] font-bold transition-colors",
              listScope === "all"
                ? "border-ink bg-ink text-paper"
                : "border-ink/12 bg-paper/50 text-ink/55 hover:border-ink/25"
            )}
          >
            全部影片
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={listScope === "wanted"}
            onClick={() => onListScopeChange("wanted")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-mono text-[11px] font-bold transition-colors",
              listScope === "wanted"
                ? "border-accent bg-accent text-white"
                : "border-ink/12 bg-paper/50 text-ink/55 hover:border-accent/40 hover:text-accent"
            )}
          >
            <Heart
              className={cn(
                "h-3 w-3",
                listScope === "wanted" && "fill-current"
              )}
            />
            想看影片
            {wantedCount > 0 ? (
              <span className="opacity-80">· {wantedCount}</span>
            ) : null}
          </button>
        </div>

        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35"
            aria-hidden
          />
          <input
            type="search"
            value={values.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="搜索影片 / 影院 / 导演（中英文）…"
            className={cn(
              "h-9 w-full rounded-md border border-ink/12 bg-paper/60 pl-8 pr-2",
              "font-mono text-[13px] text-ink placeholder:text-ink/35",
              "outline-none transition-[border-color,box-shadow]",
              "focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
            )}
          />
        </label>

        <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 pt-0.5">
          <FilterSelect
            field="Date"
            label="全部日期"
            value={values.date}
            options={dateOptions}
            onChange={(date) => onChange({ date })}
          />
          <FilterSelect
            field="Cinema"
            label="全部影院"
            value={values.cinemaId}
            options={cinemaOptions}
            onChange={(cinemaId) => onChange({ cinemaId })}
            expand="end"
          />
          <FilterSelect
            field="Section"
            label="全部单元"
            value={values.section}
            options={sectionOptions}
            onChange={(section) => onChange({ section })}
          />
          <FilterSelect
            field="Director"
            label="全部导演"
            value={values.director}
            options={directorOptions}
            onChange={(director) => onChange({ director })}
            expand="end"
            searchableAbove={0}
          />
        </div>
      </div>
    </section>
  );
}
