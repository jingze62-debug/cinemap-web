/**
 * Fetch TMDB posters for films in public/data/siff_2026_films.json
 *
 * Usage:
 *   node scripts/fetch-tmdb-posters.cjs
 *   node scripts/fetch-tmdb-posters.cjs --limit 20
 *   node scripts/fetch-tmdb-posters.cjs --force
 *   node scripts/fetch-tmdb-posters.cjs --retry-failed
 *
 * Requires TMDB_API_KEY in .env.local or environment.
 * Attribution: https://www.themoviedb.org/about/logos-attribution
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public/data/siff_2026_films.json");
const OUT_DIR = path.join(ROOT, "public/posters/films");
const REPORT_PATH = path.join(ROOT, "tmp_poster_report.json");

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const retryFailed = args.has("--retry-failed");
const enOnly = args.has("--en-only") || retryFailed;
const limitIdx = process.argv.indexOf("--limit");
const limit =
  limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) || Infinity : Infinity;

function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();
const API_KEY = process.env.TMDB_API_KEY;
if (!API_KEY) {
  console.error("Missing TMDB_API_KEY (.env.local or env)");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchJson(res.headers.location).then(resolve, reject);
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          downloadFile(res.headers.location, dest).then(resolve, reject);
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

function cleanTitle(s) {
  return String(s || "")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[・·]/g, " ")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAscii(s) {
  return cleanTitle(s)
    .replace(/[：:]/g, " ")
    .replace(/[&]/g, " and ")
    .replace(/[.!?…]+/g, " ")
    .replace(/[-–—|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseWords(s) {
  return normalizeAscii(s)
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function englishQueries(film) {
  const raw = film.titleEn ? String(film.titleEn).trim() : "";
  if (!raw || /[\u4e00-\u9fa5]/.test(raw)) return [];

  const queries = new Set();
  const add = (q) => {
    const t = cleanTitle(q);
    if (t.length >= 2) queries.add(t);
  };

  add(raw);
  add(normalizeAscii(raw));
  add(titleCaseWords(raw));

  const noSub = normalizeAscii(raw.split(/[:：]/)[0]);
  if (noSub.length >= 3) add(noSub);

  // "DUNE & DUNE: PART TWO" → also try each segment
  for (const part of normalizeAscii(raw).split(/\band\b/i)) {
    const p = part.trim();
    if (p.length >= 3) add(p);
  }

  // drop leading articles for documentary / event titles
  for (const q of [...queries]) {
    add(q.replace(/^(the|a|an)\s+/i, "").trim());
  }

  return [...queries];
}

function slugFile(id) {
  return String(id)
    .replace(/^film_/, "")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "_")
    .slice(0, 60);
}

function scoreResult(film, result) {
  let score = 0;
  const en = cleanTitle(film.titleEn).toLowerCase();
  const zh = cleanTitle(film.titleZh).toLowerCase();
  const t = cleanTitle(result.title || "").toLowerCase();
  const ot = cleanTitle(result.original_title || "").toLowerCase();
  if (en && (t === en || ot === en)) score += 50;
  else if (en && (t.includes(en) || en.includes(t) || ot.includes(en))) score += 25;
  if (zh && (ot === zh || t === zh)) score += 40;
  if (result.poster_path) score += 20;
  const y = Number(String(result.release_date || "").slice(0, 4));
  // festival year is often 2026; prefer real cinema years when available
  if (film.year && film.year < 2026 && y === film.year) score += 15;
  if (film.year && film.year < 2026 && Math.abs(y - film.year) <= 1) score += 5;
  return score;
}

async function searchMovie(query, lang = "zh-CN") {
  const q = cleanTitle(query);
  if (!q || q.length < 2) return [];
  const url =
    "https://api.themoviedb.org/3/search/movie?api_key=" +
    encodeURIComponent(API_KEY) +
    "&query=" +
    encodeURIComponent(q) +
    "&include_adult=false&language=" +
    encodeURIComponent(lang);
  const data = await fetchJson(url);
  return Array.isArray(data.results) ? data.results : [];
}

function buildQueries(film, { englishOnly = false } = {}) {
  const queries = [];
  const seen = new Set();
  const push = (q) => {
    const t = cleanTitle(q);
    const key = t.toLowerCase();
    if (!t || t.length < 2 || seen.has(key)) return;
    seen.add(key);
    queries.push(t);
  };

  if (englishOnly) {
    for (const q of englishQueries(film)) push(q);
    return queries;
  }

  if (film.titleEn) push(film.titleEn);
  if (film.titleZh) push(film.titleZh);
  if (film.titleEn) {
    const short = film.titleEn.split(/[:：\-|–—]/)[0];
    if (short && short.trim().length >= 3) push(short.trim());
  }
  for (const q of englishQueries(film)) push(q);
  return queries;
}

async function findBest(film, { englishOnly = false, minScore = 30 } = {}) {
  const queries = buildQueries(film, { englishOnly });
  const langs = englishOnly ? ["en-US", "zh-CN"] : ["zh-CN", "en-US"];

  let best = null;
  let bestScore = 0;
  for (const q of queries) {
    for (const lang of langs) {
      let results = [];
      try {
        results = await searchMovie(q, lang);
      } catch (e) {
        console.warn("search fail", film.id, e.message);
        await sleep(500);
        continue;
      }
      await sleep(280);
      for (const r of results.slice(0, 10)) {
        const s = scoreResult(film, r);
        if (s > bestScore) {
          bestScore = s;
          best = r;
        }
      }
      if (bestScore >= 70) break;
    }
    if (bestScore >= 70) break;
  }
  if (!best || !best.poster_path || bestScore < minScore) return null;
  return { result: best, score: bestScore };
}

function loadRetryIds() {
  if (!fs.existsSync(REPORT_PATH)) return null;
  try {
    const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
    const ids = new Set((report.failed || []).map((f) => f.id));
    return ids.size ? ids : null;
  } catch {
    return null;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dataset = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const allFilms = dataset.films || [];
  const retryIds = retryFailed ? loadRetryIds() : null;
  const films = retryIds
    ? allFilms.filter((f) => retryIds.has(f.id))
    : allFilms;
  const report = { matched: [], skipped: [], failed: [], kept: [] };

  if (retryFailed) {
    console.log(
      `Retry mode: ${films.length} failed film(s), English-first search`
    );
  }

  let processed = 0;
  for (const film of films) {
    if (processed >= limit) break;
    processed += 1;

    if (film.poster && !force && !retryFailed) {
      const local = path.join(ROOT, "public", film.poster.replace(/^\//, ""));
      if (fs.existsSync(local)) {
        report.kept.push({ id: film.id, poster: film.poster });
        continue;
      }
    }

    // skip obvious anthology / award reels — low TMDB hit rate
    if (
      !retryFailed &&
      /合集|COLLECTION|短片竞赛|SHORT FILM COLLECTION/i.test(
        `${film.titleZh} ${film.titleEn}`
      )
    ) {
      report.skipped.push({ id: film.id, titleZh: film.titleZh, reason: "collection" });
      continue;
    }

    process.stdout.write(`[${processed}/${Math.min(films.length, limit)}] ${film.titleZh} … `);
    try {
      const hit = await findBest(film, {
        englishOnly: enOnly,
        minScore: retryFailed ? 25 : 30,
      });
      if (!hit) {
        console.log("no match");
        report.failed.push({ id: film.id, titleZh: film.titleZh, titleEn: film.titleEn });
        continue;
      }
      const ext = path.extname(hit.result.poster_path) || ".jpg";
      const fileName = `${slugFile(film.id)}${ext}`;
      const dest = path.join(OUT_DIR, fileName);
      const imgUrl = `https://image.tmdb.org/t/p/w500${hit.result.poster_path}`;
      await downloadFile(imgUrl, dest);
      await sleep(120);
      film.poster = `/posters/films/${fileName}`;
      console.log(`ok (score ${hit.score}) → ${fileName}`);
      report.matched.push({
        id: film.id,
        titleZh: film.titleZh,
        tmdb: hit.result.title,
        tmdbId: hit.result.id,
        score: hit.score,
        poster: film.poster,
      });
    } catch (e) {
      console.log("error", e.message);
      report.failed.push({
        id: film.id,
        titleZh: film.titleZh,
        error: e.message,
      });
      await sleep(600);
    }
  }

  const withPoster = allFilms.filter((f) => Boolean(f.poster)).length;
  dataset._meta = {
    ...(dataset._meta || {}),
    postersFetchedAt: new Date().toISOString(),
    posterMatched: withPoster,
    posterSkipped: report.skipped.length,
    posterKept: report.kept.length,
    ...(retryFailed ? { posterRetriedAt: new Date().toISOString() } : {}),
  };

  fs.writeFileSync(DATA_PATH, JSON.stringify(dataset, null, 2) + "\n", "utf8");

  if (retryFailed && fs.existsSync(REPORT_PATH)) {
    const prev = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
    const recovered = new Set(report.matched.map((m) => m.id));
    prev.matched = [...(prev.matched || []), ...report.matched];
    prev.failed = (prev.failed || []).filter((f) => !recovered.has(f.id));
    prev.retried = {
      at: new Date().toISOString(),
      matched: report.matched.length,
      stillFailed: prev.failed.length,
    };
    dataset._meta.posterFailed = prev.failed.length;
    fs.writeFileSync(REPORT_PATH, JSON.stringify(prev, null, 2) + "\n", "utf8");
    fs.writeFileSync(DATA_PATH, JSON.stringify(dataset, null, 2) + "\n", "utf8");
  } else {
    dataset._meta.posterFailed = report.failed.length;
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
    fs.writeFileSync(DATA_PATH, JSON.stringify(dataset, null, 2) + "\n", "utf8");
  }

  console.log("\nDone:", {
    matched: report.matched.length,
    kept: report.kept.length,
    skipped: report.skipped.length,
    failed: report.failed.length,
    report: REPORT_PATH,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
