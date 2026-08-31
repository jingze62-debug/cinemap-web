"use client";

import type { ReactNode } from "react";

type TabPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  dark?: boolean;
  children?: ReactNode;
};

export function TabPlaceholder({
  eyebrow,
  title,
  description,
  dark = false,
  children,
}: TabPlaceholderProps) {
  return (
    <section
      className={
        dark ? "min-h-full bg-map-bg text-paper" : "min-h-full text-ink"
      }
    >
      <header className="px-5 pb-4 pt-6">
        <p
          className={
            dark
              ? "text-xs tracking-[0.18em] text-amber-200/70"
              : "text-xs tracking-[0.18em] text-ink/45"
          }
        >
          {eyebrow}
        </p>
        <h1
          className={
            dark
              ? "mt-2 font-display text-3xl font-semibold tracking-tight text-paper"
              : "mt-2 font-display text-3xl font-semibold tracking-tight text-ink"
          }
        >
          {title}
        </h1>
        <p
          className={
            dark
              ? "mt-3 max-w-sm text-sm leading-relaxed text-paper/65"
              : "mt-3 max-w-sm text-sm leading-relaxed text-ink/55"
          }
        >
          {description}
        </p>
      </header>
      <div
        className={
          dark
            ? "mx-5 mb-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-paper/70"
            : "mx-5 mb-8 rounded-2xl border border-dashed border-ink/15 bg-white/40 px-4 py-6 text-sm text-ink/50"
        }
      >
        {children ?? "本页内容将在后续阶段接入"}
      </div>
    </section>
  );
}
