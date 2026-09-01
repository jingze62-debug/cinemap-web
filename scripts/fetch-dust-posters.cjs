/**
 * Fetch TMDB posters for dust_in_heart_2026_films.json
 * Usage: node scripts/fetch-dust-posters.cjs
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "public/data/dust_in_heart_2026_films.json");
const OUT = path.join(ROOT, "public/posters/films");

function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();
const KEY = process.env.TMDB_API_KEY;
if (!KEY) {
  console.error("Missing TMDB_API_KEY");
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          getJson(res.headers.location).then(resolve, reject);
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 160)}`));
            return;
          }
          resolve(JSON.parse(body));
        });
      })
      .on("error", reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          file.close();
          fs.unlink(dest, () => {});
          download(res.headers.location, dest).then(resolve, reject);
          res.resume();
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error(`download HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function search(q, year) {
  let url =
    "https://api.themoviedb.org/3/search/movie?api_key=" +
    encodeURIComponent(KEY) +
    "&query=" +
    encodeURIComponent(q) +
    "&include_adult=false&language=en-US";
  if (year) url += "&year=" + year;
  const data = await getJson(url);
  return data.results || [];
}

function pick(results, year, prefer) {
  let best = null;
  let score = -1;
  for (const r of results) {
    if (!r.poster_path) continue;
    let s = 10;
    const y = Number(String(r.release_date || "").slice(0, 4));
    if (year && y === year) s += 30;
    else if (year && Math.abs(y - year) <= 1) s += 10;
    const t = `${r.title || ""} ${r.original_title || ""}`.toLowerCase();
    if (prefer && t.includes(String(prefer).toLowerCase())) s += 20;
    if (s > score) {
      score = s;
      best = r;
    }
  }
  return best;
}

const overrides = {
  film_dust_mabuse: [
    { q: "The 1000 Eyes of Dr. Mabuse", y: 1960 },
    { q: "Die 1000 Augen des Dr. Mabuse", y: 1960 },
  ],
  film_dust_bleiche_mutter: [
    { q: "Germany Pale Mother", y: 1980 },
    { q: "Deutschland bleiche Mutter", y: 1980 },
  ],
  film_dust_double_godard_farocki: [
    { q: "Germany Year 90 Nine Zero", y: 1991 },
    { q: "Allemagne annee 90 neuf zero", y: 1991 },
  ],
  film_dust_antigone: [
    { q: "Die Antigone des Sophokles", y: 1992 },
    { q: "Antigone", y: 1992, prefer: "antigone" },
  ],
  film_dust_othon: [
    { q: "Othon", y: 1970 },
    { q: "Eyes Do Not Want to Close at All Times", y: 1970 },
  ],
  film_dust_nordkalotte: [
    { q: "Die Nordkalotte", y: 1991 },
    { q: "The Northern Calotte", y: 1991 },
  ],
  film_dust_redupers: [
    { q: "The All-Around Reduced Personality", y: 1978 },
    { q: "Redupers", y: 1978 },
  ],
  film_dust_wald: [
    { q: "The Forest for the Trees", y: 2003 },
    { q: "Der Wald vor lauter Baumen", y: 2003 },
  ],
};

(async () => {
  const ds = JSON.parse(fs.readFileSync(DATA, "utf8"));
  for (const film of ds.films) {
    const tries = overrides[film.id] || [{ q: film.titleEn, y: film.year }];
    let hit = null;
    for (const t of tries) {
      const results = await search(t.q, t.y);
      hit = pick(results, t.y, t.prefer);
      if (hit) {
        console.log(
          "OK",
          film.id,
          "<-",
          hit.original_title || hit.title,
          hit.release_date
        );
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!hit) {
      console.log("FAIL", film.id);
      continue;
    }
    const file = `${film.id.replace(/^film_/, "")}.jpg`;
    const dest = path.join(OUT, file);
    await download("https://image.tmdb.org/t/p/w500" + hit.poster_path, dest);
    film.poster = "/posters/films/" + file;
    await new Promise((r) => setTimeout(r, 300));
  }
  fs.writeFileSync(DATA, JSON.stringify(ds, null, 2) + "\n");
  console.log("written", DATA);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
