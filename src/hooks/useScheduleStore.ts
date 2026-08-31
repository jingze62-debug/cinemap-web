"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Plan } from "@/types/plan";
import { track } from "@/lib/analytics";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

type ScheduleState = {
  plans: Plan[];
  activePlanId: string;
  setActivePlan: (id: string) => void;
  addPlan: (name?: string) => string;
  renamePlan: (id: string, name: string) => void;
  clonePlan: (id: string) => string | null;
  removePlan: (id: string) => void;
  addScreening: (screeningId: string) => void;
  removeScreening: (screeningId: string) => void;
  hasScreening: (screeningId: string) => boolean;
  getActivePlan: () => Plan | undefined;
};

const defaultPlans: Plan[] = [
  {
    id: "plan_primary",
    name: "方案一",
    starred: true,
    screeningIds: [],
  },
  {
    id: "plan_backup",
    name: "方案二",
    starred: false,
    screeningIds: [],
  },
];

function cleanPlanName(name: string): string {
  return name
    .replace(/：主力$/u, "")
    .replace(/：保底$/u, "")
    .trim();
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      plans: defaultPlans,
      activePlanId: "plan_primary",

      setActivePlan: (id) => {
        if (get().plans.some((p) => p.id === id)) {
          set({ activePlanId: id });
        }
      },

      addPlan: (name) => {
        const id = uid("plan");
        const count = get().plans.length + 1;
        const plan: Plan = {
          id,
          name: name ?? `方案${count}`,
          screeningIds: [],
        };
        set((s) => ({
          plans: [...s.plans, plan],
          activePlanId: id,
        }));
        return id;
      },

      renamePlan: (id, name) => {
        set((s) => ({
          plans: s.plans.map((p) => (p.id === id ? { ...p, name } : p)),
        }));
      },

      clonePlan: (id) => {
        const source = get().plans.find((p) => p.id === id);
        if (!source) return null;
        const newId = uid("plan");
        const clone: Plan = {
          id: newId,
          name: `${source.name}（副本）`,
          screeningIds: [...source.screeningIds],
        };
        set((s) => ({
          plans: [...s.plans, clone],
          activePlanId: newId,
        }));
        return newId;
      },

      removePlan: (id) => {
        const { plans, activePlanId } = get();
        if (plans.length <= 1) return;
        const next = plans.filter((p) => p.id !== id);
        set({
          plans: next,
          activePlanId:
            activePlanId === id ? next[0].id : activePlanId,
        });
      },

      addScreening: (screeningId) => {
        const { activePlanId, plans } = get();
        const plan = plans.find((p) => p.id === activePlanId);
        if (plan?.screeningIds.includes(screeningId)) return;
        set({
          plans: plans.map((p) => {
            if (p.id !== activePlanId) return p;
            return { ...p, screeningIds: [...p.screeningIds, screeningId] };
          }),
        });
        track("screening_add", { screeningId, planId: activePlanId });
      },

      removeScreening: (screeningId) => {
        const { activePlanId, plans } = get();
        const plan = plans.find((p) => p.id === activePlanId);
        if (!plan?.screeningIds.includes(screeningId)) return;
        set({
          plans: plans.map((p) =>
            p.id === activePlanId
              ? {
                  ...p,
                  screeningIds: p.screeningIds.filter(
                    (id) => id !== screeningId
                  ),
                }
              : p
          ),
        });
        track("screening_remove", { screeningId, planId: activePlanId });
      },

      hasScreening: (screeningId) => {
        const plan = get().plans.find((p) => p.id === get().activePlanId);
        return Boolean(plan?.screeningIds.includes(screeningId));
      },

      getActivePlan: () => {
        const { plans, activePlanId } = get();
        return plans.find((p) => p.id === activePlanId);
      },
    }),
    {
      name: "cinemap-schedule-v3",
      version: 1,
      migrate: (persisted, fromVersion) => {
        try {
          const state = persisted as {
            plans?: Plan[];
            activePlanId?: string;
          };
          if (!state?.plans) return state as never;
          if (fromVersion < 1) {
            state.plans = state.plans.map((p) => ({
              ...p,
              name: cleanPlanName(p.name ?? ""),
            }));
          }
          return state as never;
        } catch {
          return persisted as never;
        }
      },
      partialize: (s) => ({
        plans: s.plans,
        activePlanId: s.activePlanId,
      }),
    }
  )
);
