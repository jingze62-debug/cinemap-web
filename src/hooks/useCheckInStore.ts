"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CheckIn } from "@/types/checkIn";
import { track } from "@/lib/analytics";

type CheckInState = {
  checkIns: Record<string, CheckIn>;
  isCheckedIn: (cinemaId: string) => boolean;
  checkIn: (cinemaId: string, note?: string) => void;
  checkOut: (cinemaId: string) => void;
  toggleCheckIn: (cinemaId: string, note?: string) => void;
};

export const useCheckInStore = create<CheckInState>()(
  persist(
    (set, get) => ({
      checkIns: {},

      isCheckedIn: (cinemaId) => Boolean(get().checkIns[cinemaId]),

      checkIn: (cinemaId, note) => {
        if (get().isCheckedIn(cinemaId)) return;
        set((s) => ({
          checkIns: {
            ...s.checkIns,
            [cinemaId]: {
              cinemaId,
              checkedAt: new Date().toISOString(),
              note,
            },
          },
        }));
        track("venue_check_in", { cinemaId });
      },

      checkOut: (cinemaId) => {
        if (!get().isCheckedIn(cinemaId)) return;
        set((s) => {
          const next = { ...s.checkIns };
          delete next[cinemaId];
          return { checkIns: next };
        });
        track("venue_check_out", { cinemaId });
      },

      toggleCheckIn: (cinemaId, note) => {
        if (get().isCheckedIn(cinemaId)) {
          get().checkOut(cinemaId);
        } else {
          get().checkIn(cinemaId, note);
        }
      },
    }),
    {
      name: "cinemap-checkin-v2",
      partialize: (s) => ({ checkIns: s.checkIns }),
    }
  )
);
