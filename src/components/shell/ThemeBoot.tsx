"use client";

import { useEffect } from "react";
import { applyThemeToDocument, useThemeStore } from "@/hooks/useThemeStore";

/** Applies persisted theme on any route without blocking first paint. */
export function ThemeBoot() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);
  return null;
}
