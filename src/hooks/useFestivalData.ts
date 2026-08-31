"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Cinema } from "@/types/cinema";
import type { Film, FilmsDataset, Screening } from "@/types/film";
import {
  enrichCinemaStats,
  indexCinemas,
  indexFilms,
  indexScreenings,
  loadCinemas,
  loadFilms,
  loadTransitMatrix,
  loadTravelModes,
  type TransitMatrix,
  type TravelModesMatrix,
} from "@/utils/dataLoader";
import { compareFilmsByTitle } from "@/utils/filmSort";

export type FestivalData = {
  dataset: FilmsDataset;
  /** Pre-sorted by title — catalog can filter without re-sorting. */
  films: Film[];
  cinemas: Cinema[];
  matrix: TransitMatrix;
  travelModes: TravelModesMatrix;
  screeningsById: Map<string, Screening>;
  filmsById: Map<string, Film>;
  cinemasById: Map<string, Cinema>;
  /** False until transit matrices finish (schedule/map still usable with defaults). */
  transitReady: boolean;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: FestivalData };

type Store = {
  state: State;
  started: boolean;
};

const store: Store = {
  state: { status: "loading" },
  started: false,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: State) {
  store.state = next;
  emit();
}

async function loadCore(): Promise<void> {
  const [dataset, cinemas] = await Promise.all([loadFilms(), loadCinemas()]);
  const films = [...dataset.films].sort(compareFilmsByTitle);
  const enriched = enrichCinemaStats(cinemas, films);
  setState({
    status: "ready",
    data: {
      dataset: { ...dataset, films },
      films,
      cinemas: enriched,
      matrix: {},
      travelModes: {},
      screeningsById: indexScreenings(films),
      filmsById: indexFilms(films),
      cinemasById: indexCinemas(enriched),
      transitReady: false,
    },
  });
}

async function loadTransit(): Promise<void> {
  const [matrix, travelModes] = await Promise.all([
    loadTransitMatrix(),
    loadTravelModes(),
  ]);
  const cur = store.state;
  if (cur.status !== "ready") return;
  setState({
    status: "ready",
    data: {
      ...cur.data,
      matrix,
      travelModes,
      transitReady: true,
    },
  });
}

/** Kick off once; catalog becomes ready before transit matrices. */
export function ensureFestivalData(): void {
  if (store.started) return;
  store.started = true;
  void (async () => {
    try {
      await loadCore();
      void loadTransit().catch(() => {
        /* catalog works without transit */
      });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "数据加载失败",
      });
    }
  })();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): State {
  return store.state;
}

/**
 * Shared festival dataset — loads once per page session.
 * Films/cinemas first; transit matrices fill in afterwards.
 */
export function useFestivalData(): State {
  useEffect(() => {
    ensureFestivalData();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useScreeningsFromIds(
  ids: string[],
  screeningsById: Map<string, Screening> | undefined
): Screening[] {
  return useMemo(() => {
    if (!screeningsById) return [];
    return ids
      .map((id) => screeningsById.get(id))
      .filter((s): s is Screening => Boolean(s));
  }, [ids, screeningsById]);
}
