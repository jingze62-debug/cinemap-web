"use client";

import { useEffect, useMemo, useState } from "react";
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

export type FestivalData = {
  dataset: FilmsDataset;
  films: Film[];
  cinemas: Cinema[];
  matrix: TransitMatrix;
  travelModes: TravelModesMatrix;
  screeningsById: Map<string, Screening>;
  filmsById: Map<string, Film>;
  cinemasById: Map<string, Cinema>;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: FestivalData };

export function useFestivalData(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dataset, cinemas, matrix, travelModes] = await Promise.all([
          loadFilms(),
          loadCinemas(),
          loadTransitMatrix(),
          loadTravelModes(),
        ]);
        if (cancelled) return;
        const films = dataset.films;
        const enriched = enrichCinemaStats(cinemas, films);
        setState({
          status: "ready",
          data: {
            dataset,
            films,
            cinemas: enriched,
            matrix,
            travelModes,
            screeningsById: indexScreenings(films),
            filmsById: indexFilms(films),
            cinemasById: indexCinemas(enriched),
          },
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "数据加载失败",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
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
