"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  THEMES,
  applyThemeToDocument,
  useThemeStore,
  type ThemeId,
} from "@/hooks/useThemeStore";

type ThemeSwitcherProps = {
  compact?: boolean;
  className?: string;
};

export function ThemeSwitcher({ compact, className }: ThemeSwitcherProps) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (!open) return;

    const updatePos = () => {
      const trigger = triggerRef.current;
      if (!trigger || !compact) return;
      const rect = trigger.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };

    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, compact]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pickTheme = (id: ThemeId) => {
    setTheme(id);
    setOpen(false);
  };

  const current = THEMES.find((t) => t.id === theme);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {compact ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-ink/15 cm-frost-soft px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink/65 hover:border-accent/40 hover:text-accent"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label="切换界面颜色"
          >
            <span
              className="h-2.5 w-2.5 rounded-full border border-ink/20"
              style={{ background: current?.swatch }}
            />
            配色
          </button>
          {mounted &&
            open &&
            createPortal(
              <div
                ref={panelRef}
                className="cm-frost fixed z-[800] min-w-[10rem] rounded-lg border border-ink/15 p-1.5 shadow-lg"
                style={{
                  top: panelPos.top,
                  right: panelPos.right,
                }}
                role="listbox"
                aria-label="界面颜色"
              >
                <ThemeSwatches theme={theme} onPick={pickTheme} compact />
              </div>,
              document.body
            )}
        </>
      ) : (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-ink/10 bg-paper/40 px-2 py-1.5 text-left transition-colors hover:border-ink/20"
          >
            <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-ink/45">
              <span className="text-accent">{"//"}</span>
              Theme · 界面配色
              <span
                className="ml-0.5 h-2.5 w-2.5 shrink-0 rounded-full border border-ink/20"
                style={{ background: current?.swatch }}
                aria-hidden
              />
              <span className="truncate font-normal normal-case tracking-normal text-ink/35">
                {current?.label}
              </span>
            </span>
            <span
              className={cn(
                "font-mono text-[9px] text-ink/35 transition-transform",
                open && "rotate-180"
              )}
              aria-hidden
            >
              ▾
            </span>
          </button>
          {open ? (
            <div
              className="rounded-md border border-ink/10 bg-paper/50 p-1.5"
              role="listbox"
              aria-label="界面颜色"
            >
              <ThemeSwatches theme={theme} onPick={pickTheme} compact />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ThemeSwatches({
  theme,
  onPick,
  compact,
}: {
  theme: ThemeId;
  onPick: (id: ThemeId) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-1.5")}>
      {THEMES.map((t) => {
        const active = t.id === theme;
        return (
          <button
            key={t.id}
            type="button"
            role="option"
            aria-selected={active}
            title={t.label}
            onClick={() => onPick(t.id)}
            className={cn(
              "inline-flex cursor-pointer items-center rounded-full border font-mono transition",
              compact
                ? "gap-1 px-1.5 py-0.5 text-[10px]"
                : "gap-1.5 px-2 py-1 text-[11px]",
              active
                ? "border-accent bg-accent/10 text-ink"
                : "border-ink/15 bg-panel text-ink/70 hover:border-ink/30"
            )}
          >
            <span
              className={cn(
                "shrink-0 rounded-full border border-ink/20 shadow-inner",
                compact ? "h-2.5 w-2.5" : "h-3 w-3"
              )}
              style={{
                background: t.swatch,
                boxShadow: active ? `0 0 0 1.5px ${t.ring}` : undefined,
              }}
            />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
