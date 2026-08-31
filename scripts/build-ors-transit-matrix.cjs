/**
 * Precompute walk / bike / driving times between all SIFF cinemas via OpenRouteService Matrix API.
 * Metro/transit stays in cinema_transit_matrix.json (ORS has no good Shanghai transit).
 *
 * Usage:
 *   npm run build:travel
 *
 * Requires ORS_API_KEY in .env.local.
 * If api.openrouteservice.org times out (common in CN), run this with a VPN/proxy.
 */
const fs = require("fs");
const path = require("path");

try {
  const { Agent, setGlobalDispatcher } = require("undici");
  setGlobalDispatcher(
    new Agent({
      connect: { timeout: 60_000 },
      headersTimeout: 120_000,
      bodyTimeout: 120_000,
    })
  );
} catch {
  /* undici may be unavailable; Node fetch defaults apply */
}

const ROOT = path.join(__dirname, "..");
const CINEMAS_PATH = path.join(ROOT, "public/data/cinemas.json");
const METRO_PATH = path.join(ROOT, "public/data/cinema_transit_matrix.json");
const OUT_PATH = path.join(ROOT, "public/data/cinema_travel_modes.json");

const PROFILES = [
  { id: "foot-walking", field: "walk" },
  { id: "cycling-regular", field: "bike" },
  { id: "driving-car", field: "taxi" },
];

/** Free-tier matrix size is limited; chunk if a full square fails. */
const CHUNK = 40;

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchMatrix(apiKey, profile, locations, sources, destinations) {
  const url = `https://api.openrouteservice.org/v2/matrix/${profile}`;
  const body = {
    locations,
    metrics: ["duration", "distance"],
    units: "m",
  };
  if (sources) body.sources = sources;
  if (destinations) body.destinations = destinations;

  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          `ORS ${profile} non-JSON (${res.status}): ${text.slice(0, 200)}`
        );
      }
      if (!res.ok) {
        throw new Error(
          `ORS ${profile} ${res.status}: ${json.error?.message || text.slice(0, 300)}`
        );
      }
      return json;
    } catch (e) {
      lastErr = e;
      console.warn(
        `  ${profile}: attempt ${attempt}/4 failed — ${e.message || e}`
      );
      await sleep(2000 * attempt);
    }
  }
  throw lastErr;
}

async function fillProfile(apiKey, profile, locations, n) {
  /** @type {(number|null)[][]} */
  const durations = Array.from({ length: n }, () => Array(n).fill(null));
  /** @type {(number|null)[][]} */
  const distances = Array.from({ length: n }, () => Array(n).fill(null));

  // Try one full matrix first
  try {
    console.log(`  ${profile}: full ${n}×${n}…`);
    const data = await fetchMatrix(apiKey, profile, locations);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        durations[i][j] = data.durations?.[i]?.[j] ?? null;
        distances[i][j] = data.distances?.[i]?.[j] ?? null;
      }
    }
    return { durations, distances };
  } catch (e) {
    console.warn(`  ${profile}: full matrix failed (${e.message}) — chunking…`);
  }

  for (let si = 0; si < n; si += CHUNK) {
    const sources = [];
    for (let i = si; i < Math.min(si + CHUNK, n); i++) sources.push(i);
    for (let dj = 0; dj < n; dj += CHUNK) {
      const destinations = [];
      for (let j = dj; j < Math.min(dj + CHUNK, n); j++) destinations.push(j);
      console.log(
        `  ${profile}: chunk sources ${sources[0]}-${sources[sources.length - 1]} → dest ${destinations[0]}-${destinations[destinations.length - 1]}`
      );
      const data = await fetchMatrix(
        apiKey,
        profile,
        locations,
        sources,
        destinations
      );
      for (let a = 0; a < sources.length; a++) {
        for (let b = 0; b < destinations.length; b++) {
          const i = sources[a];
          const j = destinations[b];
          durations[i][j] = data.durations?.[a]?.[b] ?? null;
          distances[i][j] = data.distances?.[a]?.[b] ?? null;
        }
      }
      await sleep(1200); // be nice to free-tier rate limits
    }
  }
  return { durations, distances };
}

function secToMin(sec) {
  if (sec == null || !Number.isFinite(sec)) return null;
  return Math.max(1, Math.round(sec / 60));
}

async function main() {
  loadEnvLocal();
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    console.error("Missing ORS_API_KEY in .env.local");
    process.exit(1);
  }

  const cinemas = JSON.parse(fs.readFileSync(CINEMAS_PATH, "utf8"));
  const list = Array.isArray(cinemas) ? cinemas : cinemas.cinemas;
  if (!list?.length) {
    console.error("No cinemas found");
    process.exit(1);
  }

  const metro = fs.existsSync(METRO_PATH)
    ? JSON.parse(fs.readFileSync(METRO_PATH, "utf8"))
    : {};

  const ids = list.map((c) => c.id);
  const locations = list.map((c) => [c.lng, c.lat]);
  const n = ids.length;
  console.log(`Cinemas: ${n}`);

  /** @type {Record<string, {durations:(number|null)[][], distances:(number|null)[][]}>} */
  const byProfile = {};
  for (const p of PROFILES) {
    byProfile[p.field] = await fillProfile(apiKey, p.id, locations, n);
    await sleep(1500);
  }

  /** @type {Record<string, Record<string, {walk:number,bike:number,taxi:number,metro:number,distanceKm:number,source:string}>>} */
  const out = {};
  let pairs = 0;
  let missing = 0;

  for (let i = 0; i < n; i++) {
    out[ids[i]] = {};
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const walk = secToMin(byProfile.walk.durations[i][j]);
      const bike = secToMin(byProfile.bike.durations[i][j]);
      const taxi = secToMin(byProfile.taxi.durations[i][j]);
      const distM =
        byProfile.taxi.distances[i][j] ?? byProfile.walk.distances[i][j];
      // prefer driving distance when present
      const distanceKm =
        distM != null && Number.isFinite(distM)
          ? Math.round((distM / 1000) * 10) / 10
          : 0;

      const metroMin =
        typeof metro[ids[i]]?.[ids[j]] === "number"
          ? metro[ids[i]][ids[j]]
          : typeof metro[ids[j]]?.[ids[i]] === "number"
            ? metro[ids[j]][ids[i]]
            : null;

      if (walk == null && bike == null && taxi == null) {
        missing += 1;
        continue;
      }

      out[ids[i]][ids[j]] = {
        walk: walk ?? Math.round((bike ?? taxi ?? 30) * 3),
        bike: bike ?? Math.round((taxi ?? 20) * 1.4),
        taxi: taxi ?? Math.max(8, Math.round((bike ?? 20) * 0.75)),
        metro: metroMin ?? 45,
        distanceKm,
        source: "ors",
      };
      pairs += 1;
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    provider: "openrouteservice",
    profiles: PROFILES.map((p) => p.id),
    cinemaCount: n,
    pairCount: pairs,
    missingPairs: missing,
    modes: out,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Pairs: ${pairs}, missing: ${missing}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
