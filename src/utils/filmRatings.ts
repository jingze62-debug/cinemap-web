import type { Film } from "@/types/film";

export type CriticScores = {
  /** 豆瓣 · 10 分制 */
  douban: number;
  /** IMDb · 10 分制 */
  imdb: number;
  /** Letterboxd · 5 分制 */
  letterboxd: number;
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function scoreFrom(seed: string, min: number, max: number): number {
  const t = (hashStr(seed) % 1000) / 1000;
  return Math.round((min + t * (max - min)) * 10) / 10;
}

/** Normalize Letterboxd to native /5 (if stored as /10, halve it). */
export function letterboxdToFive(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const five = raw > 5 ? raw / 2 : raw;
  return Math.min(5, Math.round(five * 10) / 10);
}

/**
 * Prefer JSON-provided scores; otherwise stable demo placeholders.
 * Douban / IMDb are /10; Letterboxd is /5.
 */
export function resolveFilmScores(film: Film): CriticScores {
  const r = film.ratings;
  const lbRaw = r?.letterboxd ?? scoreFrom(`${film.id}:lb`, 2.8, 4.4);
  return {
    douban: r?.douban ?? scoreFrom(`${film.id}:db`, 5.8, 9.2),
    imdb: r?.imdb ?? scoreFrom(`${film.id}:im`, 5.5, 8.8),
    letterboxd: letterboxdToFive(lbRaw),
  };
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}
