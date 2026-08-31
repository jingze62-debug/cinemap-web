"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  hidden: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Whole filter module fades opacity together.
 * Height does not tween — it only collapses after the fade (delay),
 * and expands instantly when shown again.
 */
export function ScrollHideChrome({ hidden, children, className }: Props) {
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden",
        // Collapse only after fade finishes; expand with no delay
        hidden
          ? "max-h-0 transition-[max-height] duration-0 delay-300 motion-reduce:delay-0"
          : "max-h-[40rem] transition-[max-height] duration-0 delay-0",
        "lg:!max-h-none lg:!overflow-visible lg:delay-0",
        className
      )}
      aria-hidden={hidden || undefined}
    >
      <div
        className={cn(
          "transition-opacity duration-300 ease-out motion-reduce:transition-none",
          "lg:!opacity-100 lg:!pointer-events-auto",
          hidden ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        {children}
      </div>
    </div>
  );
}
