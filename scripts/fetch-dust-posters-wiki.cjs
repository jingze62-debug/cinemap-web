/**
 * Fetch film posters via Wikipedia REST thumbnails (no API key).
 * Usage: node scripts/fetch-dust-posters-wiki.cjs
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "public/data/dust_in_heart_2026_films.json");
const OUT = path.join(ROOT, "public/posters/films");
fs.mkdirSync(OUT, { recursive: true });

const UA =
  "CineMapPosterBot/1.0 (local educational project; contact: local)";

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json", "User-Agent": UA } }, (res) => {
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
    const lib = url.startsWith("http://") ? require("http") : https;
    lib
      .get(url, { headers: { "User-Agent": UA } }, (res) => {
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

async function wikiThumb(lang, title) {
  const url =
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/` +
    encodeURIComponent(title);
  const data = await getJson(url);
  const src =
    data.originalimage?.source ||
    data.thumbnail?.source ||
    null;
  return src
    ? { src, label: data.title || title, desc: data.description || "" }
    : null;
}

/** Prefer poster-like pages; fall back across languages. */
const pages = {
  film_dust_mabuse: [
    ["en", "The Thousand Eyes of Dr. Mabuse"],
    ["de", "Die 1000 Augen des Dr. Mabuse"],
  ],
  film_dust_bleiche_mutter: [
    ["en", "Germany, Pale Mother"],
    ["de", "Deutschland bleiche Mutter"],
  ],
  film_dust_double_godard_farocki: [
    ["en", "Germany Year 90 Nine Zero"],
    ["fr", "Allemagne année 90 neuf zéro"],
    ["de", "Deutschland Neu(n) Null"],
  ],
  film_dust_antigone: [
    ["en", "Antigone (1992 film)"],
    ["de", "Die Antigone des Sophokles nach der Hölderlinschen Übertragung für die Bühne bearbeitet von Brecht 1948"],
    ["en", "Antigone_(1992_Straub-Huillet_film)"],
  ],
  film_dust_othon: [
    ["en", "Othon (film)"],
    ["fr", "Othon (film)"],
    ["en", "Eyes Do Not Want to Close at All Times"],
  ],
  film_dust_nordkalotte: [
    ["de", "Die Nordkalotte"],
    ["en", "Peter Nestler"],
  ],
  film_dust_redupers: [
    ["en", "The All-Around Reduced Personality"],
    ["de", "Die allseitig reduzierte Persönlichkeit – Redupers"],
  ],
  film_dust_wald: [
    ["en", "The Forest for the Trees (film)"],
    ["de", "Der Wald vor lauter Bäumen"],
    ["en", "The Forest for the Trees"],
  ],
};

(async () => {
  const ds = JSON.parse(fs.readFileSync(DATA, "utf8"));
  for (const film of ds.films) {
    const tries = pages[film.id] || [];
    let hit = null;
    for (const [lang, title] of tries) {
      try {
        hit = await wikiThumb(lang, title);
        if (hit) {
          console.log("OK", film.id, "<-", lang, hit.label);
          break;
        }
      } catch (e) {
        console.log("miss", film.id, lang, title, String(e.message || e));
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!hit) {
      console.log("FAIL", film.id);
      continue;
    }
    const file = `${film.id.replace(/^film_/, "")}.jpg`;
    const dest = path.join(OUT, file);
    // request a larger commons thumb when possible
    let url = hit.src;
    url = url.replace(/\/\d+px-/, "/800px-");
    try {
      await download(url, dest);
    } catch {
      await download(hit.src, dest);
    }
    film.poster = "/posters/films/" + file;
  }
  fs.writeFileSync(DATA, JSON.stringify(ds, null, 2) + "\n");
  console.log("written", DATA);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
