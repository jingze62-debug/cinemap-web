"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Cinema } from "@/types/cinema";
import type { Film, FilmsDataset, Screening } from "@/types/film";
import {
  enrichCinemaStats,
  filmsPathForFestival,
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
  festivalId: string;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: FestivalData };

type Store = {
  state: State;
  loadedKey: string | null;
  loadToken: number;
};

const store: Store = {
  state: { status: "loading" },
  loadedKey: null,
  loadToken: 0,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: State) {
  store.state = next;
  emit();
}

function cinemaScope(all: Cinema[], films: Film[]): Cinema[] {
  const used = new Set<string>();
  for (const film of films) {
    for (const s of film.screenings) used.add(s.cinemaId);
  }
  if (used.size === 0) return all;
  const scoped = all.filter((c) => used.has(c.id));
  return scoped.length > 0 ? scoped : all;
}

async function loadCore(
  festivalId: string,
  filmsPath: string,
  token: number
): Promise<void> {
  const [dataset, cinemas] = await Promise.all([
    loadFilms(festivalId, filmsPath),
    loadCinemas(),
  ]);
  if (token !== store.loadToken) return;

  const films = [...dataset.films].sort(compareFilmsByTitle);
  const scoped = cinemaScope(cinemas, films);
  const enriched = enrichCinemaStats(scoped, films);
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
      festivalId,
    },
  });
  store.loadedKey = `${festivalId}::${filmsPath}`;
}

async function loadTransit(token: number): Promise<void> {
  const [matrix, travelModes] = await Promise.all([
    loadTransitMatrix(),
    loadTravelModes(),
  ]);
  if (token !== store.loadToken) return;
  const current = store.state;
  if (current.status !== "ready") return;
  setState({
    status: "ready",
    data: {
      ...current.data,
      matrix,
      travelModes,
      transitReady: true,
    },
  });
}

/**
 * Load (or switch) festival catalog. Re-fetches when festival/path changes.
 */
export function ensureFestivalData(
  festivalId = "siff_2026",
  filmsPath?: string
) {
  const path = filmsPathForFestival(festivalId, filmsPath);
  const key = `${festivalId}::${path}`;
  if (store.loadedKey === key && store.state.status === "ready") return;

  const token = ++store.loadToken;
  store.loadedKey = null;
  setState({ status: "loading" });

  void (async () => {
    try {
      await loadCore(festivalId, path, token);
      void loadTransit(token).catch(() => {
        /* catalog works without transit */
      });
    } catch (e) {
      if (token !== store.loadToken) return;
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
 * Shared festival dataset — loads once per festival selection.
 * Films/cinemas first; transit matrices fill in afterwards.
 */
export function useFestivalData(): State {
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
