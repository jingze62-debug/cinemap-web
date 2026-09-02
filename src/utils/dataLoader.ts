import type { Cinema } from "@/types/cinema";
import type { Film, FilmsDataset, Screening } from "@/types/film";
import type { FestivalsDataset } from "@/types/festival";

export type TransitMatrix = Record<string, Record<string, number>>;

/** ORS (or curated) per-pair travel minutes for non-metro modes */
export type TravelModePair = {
  walk: number;
  bike: number;
  taxi: number;
  metro?: number;
  distanceKm?: number;
  source?: string;
};

export type TravelModesMatrix = Record<string, Record<string, TravelModePair>>;

export type TravelModesDataset = {
  generatedAt?: string;
  provider?: string;
  modes: TravelModesMatrix;
};

async function fetchJson<T>(url: string): Promise<T> {
  // Respect CDN Cache-Control (see public/_headers); avoid stale force-cache.
  const res = await fetch(url, { cache: "default" });
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function filmsPathForFestival(festivalId?: string, filmsPath?: string) {
  if (filmsPath) return filmsPath;
  if (festivalId) return `/data/${festivalId}_films.json`;
  return "/data/siff_2026_films.json";
}

export function loadFestivals(): Promise<FestivalsDataset> {
  return fetchJson<FestivalsDataset>("/data/festivals.json");
}

export function loadFilms(
  festivalId?: string,
  filmsPath?: string
): Promise<FilmsDataset> {
  const url = filmsPathForFestival(festivalId, filmsPath);
  return fetchJson<FilmsDataset>(url).then((ds) => ({
    ...ds,
    films: dedupeFilms(ds.films),
  }));
}

/** Union of films across every available festival — for city map / check-in. */
export async function loadAllFestivalFilms(): Promise<Film[]> {
  const { festivals } = await loadFestivals();
  const available = festivals.filter((f) => f.available);
  const datasets = await Promise.all(
    available.map((f) => loadFilms(f.id, f.filmsPath))
  );
  const byId = new Map<string, Film>();
  for (const ds of datasets) {
    for (const film of ds.films) {
      const prev = byId.get(film.id);
      if (!prev) {
        byId.set(film.id, film);
        continue;
      }
      // Merge screenings when same film id appears in multiple festivals
      const seen = new Set(prev.screenings.map((s) => s.id));
      const extra = film.screenings.filter((s) => !seen.has(s.id));
      if (extra.length > 0) {
        byId.set(film.id, {
          ...prev,
          screenings: [...prev.screenings, ...extra],
        });
      }
    }
  }
  return Array.from(byId.values());
}

/** Cinemas that appear in any festival schedule, with aggregated stats. */
export async function loadCityMapCinemas(): Promise<Cinema[]> {
  const [cinemas, films] = await Promise.all([
    loadCinemas(),
    loadAllFestivalFilms(),
  ]);
  const used = new Set<string>();
  for (const film of films) {
    for (const s of film.screenings) used.add(s.cinemaId);
  }
  const scoped =
    used.size > 0 ? cinemas.filter((c) => used.has(c.id)) : cinemas;
  return enrichCinemaStats(scoped.length > 0 ? scoped : cinemas, films);
}

/** Prefer cleaner titles when Excel import produced duplicate film ids.
 *  Encoding twins (・ vs ?) are merged; truly different titles sharing an id
 *  (e.g. 死亡圣器 上/下) stay as separate films with disambiguated ids.
 */
export function dedupeFilms(films: Film[]): Film[] {
  const quality = (t: string) => {
    let q = 0;
    if (!t.includes("?")) q += 2;
    if (/[・•·]/.test(t)) q += 1;
    q += Math.min(t.length, 40) / 40;
    return q;
  };

  const normalizeTitle = (t: string) =>
    t
      .replace(/[?？・•·．.\s]/g, "")
      .replace(/[（(]/g, "(")
      .replace(/[）)]/g, ")")
      .toLowerCase();

  const groups = new Map<string, Film[]>();
  for (const film of films) {
    const list = groups.get(film.id) ?? [];
    list.push(film);
    groups.set(film.id, list);
  }

  const out: Film[] = [];
  for (const [baseId, group] of Array.from(groups.entries())) {
    const byNorm = new Map<string, Film[]>();
    for (const film of group) {
      const key = normalizeTitle(film.titleZh) || film.id;
      const list = byNorm.get(key) ?? [];
      list.push(film);
      byNorm.set(key, list);
    }

    const norms = Array.from(byNorm.keys());
    norms.forEach((norm, idx) => {
      const variants = byNorm.get(norm)!;
      const best = variants.reduce((a, b) =>
        quality(b.titleZh) >= quality(a.titleZh) ? b : a
      );
      const seen = new Set<string>();
      const screenings: Film["screenings"] = [];
      for (const v of variants) {
        for (const s of v.screenings) {
          if (seen.has(s.id)) continue;
          seen.add(s.id);
          screenings.push(s);
        }
      }

      const filmId =
        norms.length === 1 ? baseId : `${baseId}__${idx + 1}`;
      out.push({
        ...best,
        id: filmId,
        screenings: screenings.map((s) =>
          s.filmId === filmId ? s : { ...s, filmId }
        ),
      });
    });
  }

  return out;
}

export function loadCinemas(): Promise<Cinema[]> {
  return fetchJson<Cinema[]>("/data/cinemas.json");
}

export function loadTransitMatrix(): Promise<TransitMatrix> {
  return fetchJson<TransitMatrix>("/data/cinema_transit_matrix.json");
}

/** Optional ORS-precomputed walk/bike/taxi matrix; empty if file missing. */
export async function loadTravelModes(): Promise<TravelModesMatrix> {
  try {
    const ds = await fetchJson<TravelModesDataset>(
      "/data/cinema_travel_modes.json"
    );
    return ds.modes ?? {};
  } catch {
    return {};
  }
}

export function indexScreenings(films: Film[]): Map<string, Screening> {
  const map = new Map<string, Screening>();
  for (const film of films) {
    for (const s of film.screenings) {
      map.set(s.id, s);
    }
  }
  return map;
}

export function indexFilms(films: Film[]): Map<string, Film> {
  return new Map(films.map((f) => [f.id, f]));
}

export function indexCinemas(cinemas: Cinema[]): Map<string, Cinema> {
  return new Map(cinemas.map((c) => [c.id, c]));
}

/** Local YYYY-MM-DD (not UTC) so 「今日」 matches the user's calendar. */
export function localDateISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Recompute venue stats from the schedule you pass in.
 * City map should pass the union of all festival films (cross-festival heat).
 * - screeningCount: total screenings at this cinema (internal / sort)
 * - todayCount: screenings whose date === today (0 if none)
 * - heat: cinema screenings ÷ busiest cinema × 100 (max venue = 100)
 */
export function enrichCinemaStats(
  cinemas: Cinema[],
  films: Film[],
  today = localDateISO()
): Cinema[] {
  const totals = new Map<string, number>();
  const todays = new Map<string, number>();

  for (const film of films) {
    for (const s of film.screenings) {
      totals.set(s.cinemaId, (totals.get(s.cinemaId) ?? 0) + 1);
      if (s.date === today) {
        todays.set(s.cinemaId, (todays.get(s.cinemaId) ?? 0) + 1);
      }
    }
  }

  let maxScreenings = 0;
  for (const n of Array.from(totals.values())) {
    if (n > maxScreenings) maxScreenings = n;
  }
  const denom = maxScreenings > 0 ? maxScreenings : 1;

  return cinemas.map((c) => {
    const screeningCount = totals.get(c.id) ?? 0;
    return {
      ...c,
      screeningCount,
      todayCount: todays.get(c.id) ?? 0,
      heat: Math.min(
        100,
        Math.max(0, Math.round((screeningCount / denom) * 100))
      ),
    };
  });
}
