"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeId = "cream" | "slate" | "white" | "black" | "pink";

export const THEMES: {
  id: ThemeId;
  label: string;
  swatch: string;
  ring: string;
}[] = [
  { id: "cream", label: "米色", swatch: "#ebe7de", ring: "#e04a1c" },
  { id: "slate", label: "灰蓝", swatch: "#9eb6cc", ring: "#3b6ea5" },
  { id: "white", label: "纯白", swatch: "#ffffff", ring: "#111111" },
  { id: "black", label: "纯黑", swatch: "#111111", ring: "#ff6b35" },
  { id: "pink", label: "粉色", swatch: "#f7a8c4", ring: "#e83e8c" },
];

type ThemeState = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
};

export function applyThemeToDocument(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  const swatch = THEMES.find((t) => t.id === theme)?.swatch;
  if (meta && swatch) meta.setAttribute("content", swatch);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "cream",
      setTheme: (id) => {
        applyThemeToDocument(id);
        set({ theme: id });
      },
    }),
    {
      name: "cinemap-theme-v1",
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyThemeToDocument(state.theme);
      },
    }
  )
);
