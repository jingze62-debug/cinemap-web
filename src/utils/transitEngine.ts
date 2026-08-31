import type { Cinema } from "@/types/cinema";
import type { Screening } from "@/types/film";
import type { PlanStats } from "@/types/plan";
import type {
  TransitMatrix,
  TravelModesMatrix,
} from "@/utils/dataLoader";

/** Minutes from midnight; supports 24+ for late-night festival slots */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToLabel(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Combine date + clock into comparable absolute minutes from a festival epoch day */
export function screeningStartAbs(s: Screening): number {
  const day = Date.parse(`${s.date}T00:00:00`);
  return day / 60000 + timeToMinutes(s.start);
}

export function screeningEndAbs(s: Screening): number {
  const day = Date.parse(`${s.date}T00:00:00`);
  let end = timeToMinutes(s.end);
  const start = timeToMinutes(s.start);
  // end past midnight relative to start
  if (end < start) end += 24 * 60;
  return day / 60000 + end;
}

export function sessionsOverlap(a: Screening, b: Screening): boolean {
  const a0 = screeningStartAbs(a);
  const a1 = screeningEndAbs(a);
  const b0 = screeningStartAbs(b);
  const b1 = screeningEndAbs(b);
  return a0 < b1 && b0 < a1;
}

export function getTransitMinutes(
  fromCinemaId: string,
  toCinemaId: string,
  matrix: TransitMatrix
): number {
  if (fromCinemaId === toCinemaId) return 0;
  const direct = matrix[fromCinemaId]?.[toCinemaId];
  if (typeof direct === "number") return direct;
  const reverse = matrix[toCinemaId]?.[fromCinemaId];
  if (typeof reverse === "number") return reverse;
  return 45; // conservative fallback
}

/** Straight-line km between two WGS84 points */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type TravelModes = {
  sameVenue: boolean;
  /** Road-ish km (straight line × 1.25) */
  distanceKm: number;
  walkMin: number;
  bikeMin: number;
  /** Public transit from matrix (地铁/公交综合) */
  metroMin: number;
  taxiMin: number;
};

/**
 * Travel times between venues.
 * Prefer ORS-precomputed walk/bike/taxi when available; metro from curated matrix.
 */
export function estimateTravelModes(
  fromCinemaId: string,
  toCinemaId: string,
  matrix: TransitMatrix,
  cinemasById: Map<string, Cinema>,
  travelModes?: TravelModesMatrix
): TravelModes {
  if (fromCinemaId === toCinemaId) {
    return {
      sameVenue: true,
      distanceKm: 0,
      walkMin: 0,
      bikeMin: 0,
      metroMin: 0,
      taxiMin: 0,
    };
  }

  const metroMin = getTransitMinutes(fromCinemaId, toCinemaId, matrix);
  const ors = travelModes?.[fromCinemaId]?.[toCinemaId];
  if (ors) {
    return {
      sameVenue: false,
      distanceKm: ors.distanceKm ?? 0,
      walkMin: ors.walk,
      bikeMin: ors.bike,
      metroMin: typeof ors.metro === "number" ? ors.metro : metroMin,
      taxiMin: ors.taxi,
    };
  }

  const fromC = cinemasById.get(fromCinemaId);
  const toC = cinemasById.get(toCinemaId);

  if (
    !fromC ||
    !toC ||
    !Number.isFinite(fromC.lat) ||
    !Number.isFinite(toC.lat)
  ) {
    return {
      sameVenue: false,
      distanceKm: 0,
      walkMin: Math.max(metroMin * 3, metroMin + 20),
      bikeMin: Math.round(metroMin * 1.35),
      metroMin,
      taxiMin: Math.max(8, Math.round(metroMin * 0.7)),
    };
  }

  const straight = haversineKm(fromC.lat, fromC.lng, toC.lat, toC.lng);
  const roadKm = straight * 1.25;
  const walkMin = Math.max(5, Math.round((roadKm / 4.5) * 60));
  const bikeMin = Math.max(5, Math.round((roadKm / 14) * 60));
  const taxiMin = Math.max(8, Math.round((roadKm / 22) * 60) + 5);

  return {
    sameVenue: false,
    distanceKm: Math.round(roadKm * 10) / 10,
    walkMin,
    bikeMin,
    metroMin,
    taxiMin,
  };
}

export type MarginLevel = "conflict" | "tight" | "ok" | "loose";

export type TransitGap = {
  from: Screening;
  to: Screening;
  gapMin: number;
  transitMin: number;
  marginMin: number;
  level: MarginLevel;
  crossDistrict: boolean;
  modes: TravelModes;
};

export function classifyMargin(marginMin: number): MarginLevel {
  if (marginMin < 0) return "conflict";
  if (marginMin < 10) return "tight";
  if (marginMin < 25) return "ok";
  return "loose";
}

export function marginLabel(level: MarginLevel): string {
  switch (level) {
    case "conflict":
      return "冲突";
    case "tight":
      return "较紧凑";
    case "ok":
      return "适中";
    case "loose":
      return "宽松";
  }
}

export function computeGap(
  from: Screening,
  to: Screening,
  matrix: TransitMatrix,
  cinemasById: Map<string, Cinema>,
  travelModes?: TravelModesMatrix
): TransitGap {
  const gapMin = screeningStartAbs(to) - screeningEndAbs(from);
  const modes = estimateTravelModes(
    from.cinemaId,
    to.cinemaId,
    matrix,
    cinemasById,
    travelModes
  );
  const transitMin = modes.metroMin;
  const marginMin = gapMin - transitMin;
  const fromC = cinemasById.get(from.cinemaId);
  const toC = cinemasById.get(to.cinemaId);
  const crossDistrict = Boolean(
    fromC && toC && fromC.district !== toC.district
  );
  return {
    from,
    to,
    gapMin,
    transitMin,
    marginMin,
    level: classifyMargin(marginMin),
    crossDistrict,
    modes,
  };
}

export function sortScreenings(list: Screening[]): Screening[] {
  return [...list].sort(
    (a, b) => screeningStartAbs(a) - screeningStartAbs(b)
  );
}

export function findOverlaps(list: Screening[]): [Screening, Screening][] {
  const sorted = sortScreenings(list);
  const pairs: [Screening, Screening][] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sessionsOverlap(sorted[i], sorted[j])) {
        pairs.push([sorted[i], sorted[j]]);
      } else if (screeningStartAbs(sorted[j]) >= screeningEndAbs(sorted[i])) {
        break;
      }
    }
  }
  return pairs;
}

/** In a time-sorted list, ids of screenings that overlap the one before them. */
export function overlapLowerIds(list: Screening[]): Set<string> {
  const sorted = sortScreenings(list);
  const ids = new Set<string>();
  for (let i = 0; i < sorted.length - 1; i++) {
    if (screeningStartAbs(sorted[i + 1]) < screeningEndAbs(sorted[i])) {
      ids.add(sorted[i + 1].id);
    }
  }
  return ids;
}

export function computePlanStats(
  screenings: Screening[],
  matrix: TransitMatrix,
  cinemasById: Map<string, Cinema>,
  filmIds: Set<string>,
  travelModes?: TravelModesMatrix
): PlanStats {
  const sorted = sortScreenings(screenings);
  let crossDistrictCount = 0;
  let worst: MarginLevel = "loose";
  const rank: Record<MarginLevel, number> = {
    loose: 0,
    ok: 1,
    tight: 2,
    conflict: 3,
  };

  if (findOverlaps(sorted).length > 0) {
    worst = "conflict";
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = computeGap(
      sorted[i],
      sorted[i + 1],
      matrix,
      cinemasById,
      travelModes
    );
    if (gap.crossDistrict) crossDistrictCount += 1;
    if (rank[gap.level] > rank[worst]) worst = gap.level;
  }

  const totalPrice = sorted.reduce((sum, s) => sum + s.price, 0);

  return {
    filmCount: filmIds.size,
    totalPrice,
    crossDistrictCount,
    tightness: worst,
    tightnessLabel: marginLabel(worst),
  };
}

/** True if adding `candidate` conflicts with any existing screening */
export function wouldConflict(
  existing: Screening[],
  candidate: Screening
): boolean {
  return existing.some((s) => sessionsOverlap(s, candidate));
}
