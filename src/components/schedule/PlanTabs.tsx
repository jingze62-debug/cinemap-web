"use client";

import { Plus, Star, X } from "lucide-react";
import type { Plan } from "@/types/plan";
import { cn } from "@/lib/utils";

type PlanTabsProps = {
  plans: Plan[];
  activePlanId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClone?: (id: string) => void;
  onRemove?: (id: string) => void;
};

export function PlanTabs({
  plans,
  activePlanId,
  onSelect,
  onAdd,
  onClone,
  onRemove,
}: PlanTabsProps) {
  const canRemove = plans.length > 1;

  return (
    <div className="-mx-5 flex items-end gap-1 overflow-x-auto border-b border-ink/10 px-5 scrollbar-none">
      {plans.map((plan) => {
        const active = plan.id === activePlanId;
        return (
          <div
            key={plan.id}
            className={cn(
              "relative flex shrink-0 items-center gap-0.5 px-2.5 pb-2.5 pt-1",
              active ? "font-bold text-ink" : "text-ink/40"
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(plan.id)}
              onDoubleClick={() => onClone?.(plan.id)}
              className={cn(
                "inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wide transition-colors",
                active ? "text-ink" : "hover:text-ink/70"
              )}
            >
              {(plan.starred || active) && (
                <Star
                  className={cn(
                    "h-3 w-3",
                    active ? "fill-accent text-accent" : "text-ink/30"
                  )}
                />
              )}
              {plan.name}
            </button>
            {canRemove && onRemove && (
              <button
                type="button"
                aria-label={`删除${plan.name}`}
                title="删除方案"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(plan.id);
                }}
                className={cn(
                  "rounded p-0.5 transition-colors",
                  active
                    ? "text-ink/35 hover:bg-accent/10 hover:text-accent"
                    : "text-ink/20 hover:bg-ink/5 hover:text-ink/60"
                )}
              >
                <X className="h-3 w-3" />
              </button>
            )}
            {active && (
              <span className="absolute inset-x-2.5 bottom-0 h-0.5 bg-accent" />
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="mb-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-ink/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink/45 hover:border-accent/40 hover:text-accent"
      >
        <Plus className="h-3.5 w-3.5" />
        New
      </button>
    </div>
  );
}
