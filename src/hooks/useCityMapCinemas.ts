"use client";

import { useEffect, useState } from "react";
import type { Cinema } from "@/types/cinema";
import { loadCityMapCinemas } from "@/utils/dataLoader";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; cinemas: Cinema[] };

/**
 * City map / check-in: venues from every available festival, not just the
 * currently selected one.
 */
export function useCityMapCinemas(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadCityMapCinemas()
      .then((cinemas) => {
        if (cancelled) return;
        setState({
          status: "ready",
          cinemas: [...cinemas].sort(
            (a, b) => b.screeningCount - a.screeningCount
          ),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "影院数据加载失败",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
