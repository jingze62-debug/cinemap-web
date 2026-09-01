"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  hidden: boolean;
  children: ReactNode;
  className?: string;
};

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * Filter chrome slides/fades as one block when the list scrolls.
 * Uses grid row animation for smooth height — no abrupt max-height snap.
 */
export function ScrollHideChrome({ hidden, children, className }: Props) {
  return (
    <div
      className={cn(
        "grid shrink-0 transition-[grid-template-rows] duration-300 motion-reduce:transition-none lg:!grid-rows-[1fr]",
        hidden ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
        className
      )}
      style={{ transitionTimingFunction: EASE }}
      aria-hidden={hidden || undefined}
    >
      <div className="overflow-hidden lg:overflow-visible">
        <div
          className={cn(
            "origin-top transition-[opacity,transform] duration-300 motion-reduce:transition-none motion-reduce:transform-none lg:!translate-y-0 lg:!opacity-100 lg:!pointer-events-auto",
            hidden
              ? "pointer-events-none -translate-y-1 opacity-0"
              : "translate-y-0 opacity-100"
          )}
          style={{ transitionTimingFunction: EASE }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
