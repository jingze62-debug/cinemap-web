"use client";

import { cn } from "@/lib/utils";

type FilterGroupProps = {
  label: string;
  options: string[];
  active: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
};

export function FilterGroup({
  label,
  options,
  active,
  onChange,
  ariaLabel,
}: FilterGroupProps) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">
        <span className="text-accent">{"//"}</span> {label}
      </p>
      <div
        className={cn(
          "flex gap-2 overflow-x-auto overscroll-x-contain pb-1.5",
          "touch-pan-x [-webkit-overflow-scrolling:touch]",
          "snap-x snap-mandatory",
          "[scrollbar-width:thin] [scrollbar-color:rgba(26,26,26,0.25)_transparent]"
        )}
        role="tablist"
        aria-label={ariaLabel ?? label}
      >
        {options.map((option) => {
          const isActive = option === active;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(option)}
              className={cn(
                "snap-start shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-medium tracking-wide transition-colors whitespace-nowrap",
                isActive
                  ? "border-accent bg-accent text-white"
                  : "border-ink/15 bg-white/70 text-ink/70 hover:border-ink/30 hover:text-ink"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
