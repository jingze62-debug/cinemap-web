"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterSelectOption = {
  value: string;
  label: string;
  count?: number;
};

type FilterSelectProps = {
  field: string;
  label: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  expand?: "start" | "end";
  /** Show typeahead when option count exceeds this (default 12). Set 0 to always show. */
  searchableAbove?: number;
  /** Tighter control height — used on mobile catalog filters. */
  compact?: boolean;
};

export function FilterSelect({
  field,
  label,
  value,
  options,
  onChange,
  expand = "start",
  searchableAbove = 12,
  compact = false,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const active = options.find((o) => o.value === value);
  const isFiltered = value !== "全部";
  const searchable =
    searchableAbove === 0 || options.length > searchableAbove;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
    else if (searchable) {
      window.setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open, searchable]);

  const placeMenu = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const ideal = Math.max(r.width, Math.min(320, window.innerWidth - 24));
    let left = expand === "end" ? r.right - ideal : r.left;
    left = Math.max(12, Math.min(left, window.innerWidth - ideal - 12));
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(
      320,
      Math.max(160, preferBelow ? spaceBelow : spaceAbove)
    );
    const top = preferBelow
      ? r.bottom + 4
      : Math.max(12, r.top - 4 - maxHeight);
    setMenuPos({ top, left, width: ideal, maxHeight });
  };

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    placeMenu();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReposition = () => placeMenu();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expand]);

  const menu =
    open && menuPos && mounted
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
            className="cm-frost z-[900] flex flex-col overflow-hidden rounded-md border-2 border-ink/12 shadow-[0_16px_40px_-12px_rgba(17,17,17,0.4)]"
          >
            {searchable && (
              <div className="shrink-0 border-b border-ink/10 p-1.5">
                <label className="relative block">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索…"
                    className="h-8 w-full rounded border border-ink/10 bg-paper/50 pl-7 pr-2 font-mono text-[12px] text-ink outline-none placeholder:text-ink/35 focus:border-accent/40"
                  />
                </label>
              </div>
            )}
            <ul
              id={listId}
              role="listbox"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            >
              {filtered.length === 0 && (
                <li className="px-3 py-3 font-mono text-[11px] text-ink/40">
                  无匹配
                </li>
              )}
              {filtered.map((o) => {
                const selected = o.value === value;
                return (
                  <li key={o.value} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-mono text-[12px] transition-colors",
                        selected
                          ? "bg-accent/10 font-bold text-accent"
                          : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                      )}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 truncate">{o.label}</span>
                      {typeof o.count === "number" && (
                        <span
                          className={cn(
                            "shrink-0 tabular-nums text-[10px]",
                            selected ? "text-accent/70" : "text-ink/30"
                          )}
                        >
                          {o.count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative min-w-0 overflow-visible" ref={rootRef}>
      <p
        className={cn(
          "overflow-visible font-mono font-bold uppercase leading-[1.35] tracking-[0.14em] text-ink/40",
          compact ? "mb-0.5 pt-0 text-[8px]" : "mb-1 pt-px text-[9px]"
        )}
      >
        <span className="text-accent">{"//"}</span> {field}
      </p>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-1 rounded-md border text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
          compact
            ? "min-h-7 px-1.5 py-1 text-[11px] leading-[1.3] lg:min-h-9 lg:px-2 lg:py-1.5 lg:text-[12px] lg:leading-[1.45]"
            : "min-h-9 px-2 py-1.5 text-[12px] leading-[1.45]",
          isFiltered
            ? "border-accent/50 bg-accent/10 font-bold text-accent"
            : open
              ? "border-ink/30 bg-paper/70 font-semibold text-ink"
              : "border-ink/12 bg-paper/50 font-semibold text-ink/65 hover:border-ink/25 hover:text-ink"
        )}
      >
        <span className="min-w-0 flex-1 truncate leading-[1.45]">
          {active?.label ?? label}
        </span>
        <ChevronDown
          className={cn(
            "shrink-0 text-ink/35 transition-transform duration-200",
            compact ? "h-2.5 w-2.5 lg:h-3 lg:w-3" : "h-3 w-3",
            open && "rotate-180 text-accent"
          )}
        />
      </button>
      {menu}
    </div>
  );
}
