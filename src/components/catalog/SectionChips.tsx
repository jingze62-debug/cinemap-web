"use client";

import { cn } from "@/lib/utils";

type SectionChipsProps = {
  sections: string[];
  active: string;
  onChange: (section: string) => void;
};

export function SectionChips({
  sections,
  active,
  onChange,
}: SectionChipsProps) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto overscroll-x-contain pb-2 pt-0.5",
        "touch-pan-x [-webkit-overflow-scrolling:touch]",
        "snap-x snap-mandatory",
        "[scrollbar-width:thin] [scrollbar-color:rgba(26,26,26,0.25)_transparent]"
      )}
      role="tablist"
      aria-label="策展单元"
    >
      {sections.map((section) => {
        const isActive = section === active;
        return (
          <button
            key={section}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(section)}
            className={cn(
              "snap-start shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-medium tracking-wide transition-colors whitespace-nowrap",
              isActive
                ? "border-accent bg-accent text-white"
                : "border-ink/15 bg-white/70 text-ink/70 hover:border-ink/30 hover:text-ink"
            )}
          >
            {section}
          </button>
        );
      })}
    </div>
  );
}
