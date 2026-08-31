"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { track } from "@/lib/analytics";

type WantState = {
  wanted: Record<string, true>;
  isWanted: (filmId: string) => boolean;
  toggleWant: (filmId: string) => void;
  setWanted: (filmId: string, wanted: boolean) => void;
};

export const useWantStore = create<WantState>()(
  persist(
    (set, get) => ({
      wanted: {},

      isWanted: (filmId) => Boolean(get().wanted[filmId]),

      setWanted: (filmId, wanted) => {
        const wasWanted = Boolean(get().wanted[filmId]);
        set((s) => {
          const next = { ...s.wanted };
          if (wanted) next[filmId] = true;
          else delete next[filmId];
          return { wanted: next };
        });
        if (wanted && !wasWanted) {
          track("film_want", { filmId });
        } else if (!wanted && wasWanted) {
          track("film_unwant", { filmId });
        }
      },

      toggleWant: (filmId) => {
        get().setWanted(filmId, !get().isWanted(filmId));
      },
    }),
    {
      name: "cinemap-want-v1",
      version: 2,
      migrate: (persisted) => {
        try {
          const raw = persisted as {
            wanted?: Record<string, true>;
            ratings?: Record<string, number>;
          };
          if (raw?.wanted && !raw.ratings) {
            return { wanted: raw.wanted };
          }
          const wanted: Record<string, true> = { ...(raw?.wanted ?? {}) };
          if (raw?.ratings) {
            for (const [id, rating] of Object.entries(raw.ratings)) {
              if (rating > 0) wanted[id] = true;
            }
          }
          return { wanted };
        } catch {
          return { wanted: {} };
        }
      },
      partialize: (s) => ({ wanted: s.wanted }),
    }
  )
);
