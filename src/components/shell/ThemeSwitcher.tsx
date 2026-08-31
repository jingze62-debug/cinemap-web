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
      if (!trigger) return;
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
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
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

  return (
    <div className={cn("relative", className)}>
      {compact ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 cm-frost-soft px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink/65 hover:border-accent/40 hover:text-accent"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label="切换界面颜色"
          >
            <span
              className="h-3 w-3 rounded-full border border-ink/20"
              style={{
                background: THEMES.find((t) => t.id === theme)?.swatch,
              }}
            />
            配色
          </button>
          {mounted &&
            open &&
            createPortal(
              <div
                ref={panelRef}
                className="cm-frost fixed z-[800] min-w-[11rem] rounded-lg border border-ink/15 p-2 shadow-lg"
                style={{
                  top: panelPos.top,
                  right: panelPos.right,
                }}
                role="listbox"
                aria-label="界面颜色"
              >
                <ThemeSwatches theme={theme} onPick={pickTheme} />
              </div>,
              document.body
            )}
        </>
      ) : (
        <div className="space-y-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
            <span className="text-accent">{"//"}</span> Theme · 界面配色
          </p>
          <ThemeSwatches theme={theme} onPick={setTheme} />
        </div>
      )}
    </div>
  );
}

function ThemeSwatches({
  theme,
  onPick,
}: {
  theme: ThemeId;
  onPick: (id: ThemeId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
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
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition",
              active
                ? "border-accent bg-accent/10 text-ink"
                : "border-ink/15 bg-panel text-ink/70 hover:border-ink/30"
            )}
          >
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-ink/20 shadow-inner"
              style={{
                background: t.swatch,
                boxShadow: active ? `0 0 0 2px ${t.ring}` : undefined,
              }}
            />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
