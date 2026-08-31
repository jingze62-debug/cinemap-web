/**
 * Merge SIFF schedule Excels and write public/data JSON.
 *
 * Supports:
 *  A) Rich catalog export: 单元/中文片名/英文片名/导演/地区/时长/日期/放映时间/影院/影厅/地址/见面会
 *  B) Price sheet: 序号/中文片名/日期/星期/时间段/影院/影厅/票价
 *
 * Usage:
 *   node scripts/import-siff-merge.cjs [rich.xlsx] [price.xlsx]
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_RICH = path.join(ROOT, "tmp_import", "siff_a.xlsx");
const DEFAULT_PRICE = path.join(ROOT, "tmp_import", "siff_b.xlsx");

const richPath = process.argv[2] || DEFAULT_RICH;
const pricePath = process.argv[3] || DEFAULT_PRICE;

/** Known venue aliases → stable ids + geo metadata */
const CINEMA_META = {
  上海影城SHO: {
    id: "cinema_sfc",
    nameZh: "上海影城",
    nameEn: "Shanghai Film Art Center",
    district: "徐汇",
    address: "长宁区新华路160号",
    lat: 31.2056,
    lng: 121.4372,
    blurb: "上影节的主场，坐满了才叫电影节。",
  },
  上海大光明电影院: {
    id: "cinema_grand",
    nameZh: "上海大光明",
    nameEn: "Grand Theatre Shanghai",
    district: "黄浦",
    address: "黄浦区南京西路216号",
    lat: 31.2345,
    lng: 121.4728,
    blurb: "南京路上的老牌宫殿，仪式感满分。",
  },
  "天山电影院-虹桥艺术中心旗舰店": {
    id: "cinema_tianshan",
    nameZh: "天山电影院·虹桥艺术中心",
    nameEn: "Tianshan Cinema Hongqiao",
    district: "长宁",
    address: "长宁区娄山关路1068号虹桥艺术中心",
    lat: 31.2105,
    lng: 121.4032,
    blurb: "西区稳定场次补给站。",
  },
  "天山电影院-宛平剧院影城": {
    id: "cinema_tianshan_wanping",
    nameZh: "天山电影院·宛平剧院",
    district: "徐汇",
    address: "徐汇区宛平南路465号",
    lat: 31.1908,
    lng: 121.4452,
  },
  上海美琪大戏院: {
    id: "cinema_majestic",
    nameZh: "美琪大戏院",
    nameEn: "Majestic Theatre",
    district: "静安",
    address: "静安区江宁路66号",
    lat: 31.2349,
    lng: 121.4501,
    blurb: "老派剧场气场，适合仪式向场次。",
  },
  和平影都: {
    id: "cinema_peace",
    nameZh: "和平影都",
    nameEn: "Peace Cinema",
    district: "黄浦",
    address: "黄浦区西藏中路228号",
    lat: 31.2331,
    lng: 121.4755,
    blurb: "人民广场旁的巨幕据点。",
  },
  兰心大戏院: {
    id: "cinema_lanxin",
    nameZh: "兰心大戏院",
    district: "黄浦",
    address: "黄浦区茂名南路57号",
    lat: 31.2205,
    lng: 121.4612,
  },
  曹杨影城: {
    id: "cinema_caoyang",
    nameZh: "曹杨影城",
    district: "普陀",
    address: "普陀区兰溪路158号",
    lat: 31.2468,
    lng: 121.4085,
  },
  朵云轩杜比全景声影城: {
    id: "cinema_duoyun",
    nameZh: "朵云轩杜比全景声影城",
    district: "黄浦",
    address: "黄浦区中山东一路27号",
    lat: 31.2392,
    lng: 121.4905,
  },
  国泰电影院: {
    id: "cinema_cathay",
    nameZh: "国泰电影院",
    district: "黄浦",
    address: "黄浦区淮海中路870号",
    lat: 31.2168,
    lng: 121.4598,
  },
  上海艺海剧院: {
    id: "cinema_yihai",
    nameZh: "上海艺海剧院",
    district: "徐汇",
    address: "徐汇区虹漕南路221号",
    lat: 31.1675,
    lng: 121.4238,
  },
  "UME影城（上海新天地店）": {
    id: "cinema_ume_xintiandi",
    nameZh: "UME影城·新天地",
    district: "黄浦",
    address: "黄浦区兴安路99号",
    lat: 31.2202,
    lng: 121.4745,
  },
  "SFC动漫主题影院（美罗城店）": {
    id: "cinema_sfc_metro",
    nameZh: "SFC动漫主题影院·美罗城",
    district: "徐汇",
    address: "徐汇区肇嘉浜路1111号",
    lat: 31.1955,
    lng: 121.4392,
  },
  "上海百丽宫影城（万象城店）": {
    id: "cinema_palace_mixc",
    nameZh: "百丽宫影城·万象城",
    district: "闵行",
    address: "闵行区漕宝路3998号",
    lat: 31.1582,
    lng: 121.3615,
  },
  "上海百丽宫影城（长宁来福士店）": {
    id: "cinema_palace_raffles",
    nameZh: "百丽宫影城·长宁来福士",
    district: "长宁",
    address: "长宁区长宁路1191号",
    lat: 31.2208,
    lng: 121.4195,
  },
  "上海百丽宫影城（环贸iapm店）": {
    id: "cinema_palace_iapm",
    nameZh: "百丽宫影城·环贸iapm",
    district: "徐汇",
    address: "徐汇区淮海中路999号",
    lat: 31.2155,
    lng: 121.4512,
  },
  "上海百丽宫影城（陆家嘴中心店）": {
    id: "cinema_palace_lujiazui",
    nameZh: "百丽宫影城·陆家嘴中心",
    district: "浦东",
    address: "浦东新区陆家嘴环路1000号",
    lat: 31.2368,
    lng: 121.5055,
  },
  佰映三克映画: {
    id: "cinema_baying",
    nameZh: "佰映三克映画",
    district: "杨浦",
    address: "杨浦区淞沪路77号",
    lat: 31.3055,
    lng: 121.5142,
  },
  CMG融媒影城: {
    id: "cinema_cmg",
    nameZh: "CMG融媒影城",
    district: "静安",
    address: "静安区南京西路",
    lat: 31.2305,
    lng: 121.4552,
  },
  "久事·上海商城剧院": {
    id: "cinema_shanghai_centre",
    nameZh: "久事·上海商城剧院",
    district: "静安",
    address: "静安区南京西路1376号",
    lat: 31.2278,
    lng: 121.4485,
  },
  "SFC上影影城（港汇永华IMAX激光店）": {
    id: "cinema_sfc_grandgateway",
    nameZh: "SFC上影影城·港汇永华",
    district: "徐汇",
    address: "徐汇区虹桥路1号",
    lat: 31.1942,
    lng: 121.4368,
  },
  上海市沪北电影院: {
    id: "cinema_hubei",
    nameZh: "沪北电影院",
    district: "静安",
    address: "静安区共和新路",
    lat: 31.2685,
    lng: 121.4558,
  },
  沪东工人文化宫东宫影剧院: {
    id: "cinema_donggong",
    nameZh: "东宫影剧院",
    district: "浦东",
    address: "浦东新区浦东南路",
    lat: 31.2255,
    lng: 121.5285,
  },
  "上海百美汇影城（静安嘉里中心店）": {
    id: "cinema_broadway_kerry",
    nameZh: "百美汇影城·静安嘉里",
    district: "静安",
    address: "静安区南京西路1515号",
    lat: 31.2262,
    lng: 121.4472,
  },
  黄浦剧场: {
    id: "cinema_huangpu_theatre",
    nameZh: "黄浦剧场",
    district: "黄浦",
    address: "黄浦区南京东路",
    lat: 31.2385,
    lng: 121.4845,
  },
  "SFC永华电影荟（世纪汇店）": {
    id: "cinema_sfc_century",
    nameZh: "SFC永华电影荟·世纪汇",
    district: "浦东",
    address: "浦东新区世纪大道1192号",
    lat: 31.2308,
    lng: 121.5432,
  },
  "CGV影城(白玉兰广场IMAX店)": {
    id: "cinema_cgv_baiyulan",
    nameZh: "CGV影城·白玉兰广场",
    district: "虹口",
    address: "虹口区东大名路1089号",
    lat: 31.2525,
    lng: 121.4985,
  },
  "SFC上影影城（丁香路LUXE店）": {
    id: "cinema_sfc_dingxiang",
    nameZh: "SFC上影影城·丁香路",
    district: "浦东",
    address: "浦东新区丁香路",
    lat: 31.2155,
    lng: 121.5455,
  },
  "世纪友谊影城（LUXE南方商城店）": {
    id: "cinema_shiji_youyi",
    nameZh: "世纪友谊影城·南方商城",
    district: "闵行",
    address: "闵行区沪闵路7258号",
    lat: 31.1185,
    lng: 121.4085,
  },
  "SFC上影百联影城（八佰伴IMAX店）": {
    id: "cinema_sfc_bhg",
    nameZh: "SFC上影百联影城·八佰伴",
    district: "浦东",
    address: "浦东新区张杨路501号",
    lat: 31.2335,
    lng: 121.5225,
  },
  "SFC上影影城（国华广场店）": {
    id: "cinema_sfc_guohua",
    nameZh: "SFC上影影城·国华广场",
    district: "虹口",
    address: "虹口区四平路",
    lat: 31.2725,
    lng: 121.4925,
  },
  "星轶STARX影剧院（上海宝山日月光店）": {
    id: "cinema_starx_baoshan",
    nameZh: "星轶影剧院·宝山日月光",
    district: "宝山",
    address: "宝山区一二八纪念路968号",
    lat: 31.3185,
    lng: 121.4485,
  },
  嘉定影剧院: {
    id: "cinema_jiading",
    nameZh: "嘉定影剧院",
    district: "嘉定",
    address: "嘉定区塔城路",
    lat: 31.3855,
    lng: 121.2485,
  },
  "寰映影城（大融城店）": {
    id: "cinema_huaning",
    nameZh: "寰映影城·大融城",
    district: "浦东",
    address: "浦东新区祖冲之路",
    lat: 31.1885,
    lng: 121.5985,
  },
  上海科技影城: {
    id: "cinema_stc",
    nameZh: "上海科技影城",
    district: "浦东",
    address: "浦东新区世纪大道2000号",
    lat: 31.2185,
    lng: 121.5485,
  },
  "MOViE MOViE 影城（前滩太古里店）": {
    id: "cinema_movie_qiantan",
    nameZh: "MOViE MOViE·前滩太古里",
    district: "浦东",
    address: "浦东新区东育路500号",
    lat: 31.1655,
    lng: 121.4785,
  },
  九棵树未来艺术中心: {
    id: "cinema_jiukeshu",
    nameZh: "九棵树未来艺术中心",
    district: "浦东",
    address: "浦东新区锦绣东路",
    lat: 31.2055,
    lng: 121.5685,
  },
  "博悦汇影城（BFC外滩金融中心店）": {
    id: "cinema_bfc",
    nameZh: "博悦汇影城·BFC外滩",
    district: "黄浦",
    address: "黄浦区中山东二路600号",
    lat: 31.2325,
    lng: 121.4955,
  },
  "万达影城（五角场万达广场激光IMAX店）": {
    id: "cinema_wanda_wujiaochang",
    nameZh: "万达影城·五角场",
    district: "杨浦",
    address: "杨浦区淞沪路77号",
    lat: 31.3025,
    lng: 121.5155,
  },
  "CGV影城（青浦天空万科广场IMAX店）": {
    id: "cinema_cgv_qingpu",
    nameZh: "CGV影城·青浦天空万科",
    district: "青浦",
    address: "青浦区崧泽大道",
    lat: 31.1685,
    lng: 121.1285,
  },
  "CGV影城（松江印象城杜比ULTRA 4DX店）": {
    id: "cinema_cgv_songjiang",
    nameZh: "CGV影城·松江印象城",
    district: "松江",
    address: "松江区广富林路",
    lat: 31.0485,
    lng: 121.2285,
  },
  "万达影城（崇明万达广场店）": {
    id: "cinema_wanda_chongming",
    nameZh: "万达影城·崇明",
    district: "崇明",
    address: "崇明区北门路",
    lat: 31.6285,
    lng: 121.3985,
  },
  "万达影城（金山万达广场店）": {
    id: "cinema_wanda_jinshan",
    nameZh: "万达影城·金山",
    district: "金山",
    address: "金山区卫清西路",
    lat: 30.7385,
    lng: 121.3385,
  },
  临港演艺中心: {
    id: "cinema_lingang",
    nameZh: "临港演艺中心",
    district: "浦东",
    address: "浦东新区临港滴水湖",
    lat: 30.8985,
    lng: 121.9285,
  },
};

const POSTER_BY_TITLE = {
  "南国再见，南国": "/posters/films/film_nanguo.jpg",
  "哈利·波特与魔法石": "/posters/films/film_hp.jpg",
  罗斯: "/posters/films/film_rose.jpg",
  世界主宰: "/posters/films/film_master.jpg",
  丝路回声: "/posters/films/film_belt.jpg",
};

const GRADIENTS = [
  ["#5c4030", "#c4a574"],
  ["#2a3340", "#7a8a9a"],
  ["#3d2c4a", "#9a7ab0"],
  ["#1a3a2a", "#6a9a7a"],
  ["#4a2a1a", "#c48a5a"],
  ["#1a2a4a", "#6a8aba"],
  ["#3a1a2a", "#b06a7a"],
  ["#2a3a1a", "#8aaa5a"],
];

function slugify(s) {
  return s
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .toLowerCase();
}

function parseTitle(raw) {
  const tags = [];
  let title = String(raw || "").trim();
  const tagRe = /\(([^)]+)\)/g;
  let m;
  while ((m = tagRe.exec(title))) {
    const parts = m[1]
      .split(/[、,/|]/)
      .map((x) => x.trim())
      .filter(Boolean);
    for (const p of parts) {
      if (
        /^(4K|Dolby|IMAX|CINITY|LUXE|3D|2D|HDR|Atmos)$/i.test(p) ||
        /修复|纪念/.test(p)
      ) {
        tags.push(p);
      }
    }
  }
  title = title.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return { titleZh: title, baseTags: Array.from(new Set(tags)) };
}

function normalizeTitleKey(raw) {
  return parseTitle(raw).titleZh.replace(/\s+/g, "").toLowerCase();
}

function parseDate(raw, defaultYear = 2026) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const mo = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const utc = Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000;
    const dt = new Date(utc);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return `${y}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  }
  // 6月13日
  m = s.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日$/);
  if (m) {
    return `${defaultYear}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  }
  throw new Error(`bad date: ${s}`);
}

function padTime(t) {
  const [h, mi] = String(t).trim().split(":");
  return `${String(Number(h)).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

function parseTimeRange(raw) {
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}:\d{2})\s*[-–—~]\s*(\d{1,2}:\d{2})$/);
  if (!m) throw new Error(`bad time range: ${s}`);
  return { start: padTime(m[1]), end: padTime(m[2]) };
}

function parseStartOnly(raw) {
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}:\d{2})$/);
  if (!m) throw new Error(`bad start: ${s}`);
  return padTime(m[1]);
}

function parseRuntimeMin(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/(\d+)\s*分钟?/);
  if (m) return Number(m[1]);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function addMinutes(start, mins) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + Math.max(1, mins);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  // allow >24 for late night like existing app
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function minutesBetween(start, end) {
  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let a = toMin(start);
  let b = toMin(end);
  if (b < a) b += 24 * 60;
  return Math.max(1, b - a);
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function haversineMin(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(x));
  return Math.max(12, Math.round((km / 22) * 60 + 12));
}

function defaultTips(district) {
  return [
    { kind: "temp", label: "适中", text: "厅温因场次而异，建议备薄外套。" },
    { kind: "exit", label: "5~8m", text: "散场预留换乘时间。" },
    { kind: "seat", label: "推荐：中区", text: "中区视听较均衡。" },
    { kind: "note", text: `${district}展映点 · 请以当日现场指引为准。` },
  ];
}

function hallTagsFrom(hall) {
  const hallTags = [];
  if (/杜比|Dolby|Atmos/i.test(hall)) hallTags.push("Dolby");
  if (/CINITY/i.test(hall)) hallTags.push("CINITY");
  if (/IMAX/i.test(hall)) hallTags.push("IMAX");
  if (/LUXE/i.test(hall)) hallTags.push("LUXE");
  if (/4K|激光/i.test(hall)) hallTags.push("4K");
  if (/ONYX|LED/i.test(hall)) hallTags.push("LED");
  return hallTags;
}

function matchKey(titleRaw, cinemaRaw, date, start) {
  return [
    normalizeTitleKey(titleRaw),
    String(cinemaRaw).trim(),
    date,
    start,
  ].join("|");
}

function loadSheetRows(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  // detect header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    const row = raw[i].map((x) => String(x));
    if (row.includes("中文片名") && (row.includes("影院") || row.includes("票价"))) {
      headerIdx = i;
      break;
    }
  }
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
    range: headerIdx,
  });
  return { sheetName, rows, headerIdx };
}

function detectFormat(rows) {
  if (!rows[0]) return "unknown";
  const keys = Object.keys(rows[0]);
  if (keys.includes("票价") && keys.includes("时间段")) return "price";
  if (keys.includes("单元") || keys.includes("英文片名") || keys.includes("放映时间"))
    return "rich";
  return "unknown";
}

function main() {
  for (const p of [richPath, pricePath]) {
    if (!fs.existsSync(p)) {
      console.error("Missing file:", p);
      process.exit(1);
    }
  }

  const richPack = loadSheetRows(richPath);
  const pricePack = loadSheetRows(pricePath);
  const richFmt = detectFormat(richPack.rows);
  const priceFmt = detectFormat(pricePack.rows);
  console.log(
    JSON.stringify(
      {
        rich: { path: richPath, fmt: richFmt, rows: richPack.rows.length },
        price: { path: pricePath, fmt: priceFmt, rows: pricePack.rows.length },
      },
      null,
      2
    )
  );

  // Build price index from B
  const priceIndex = new Map(); // matchKey -> { price, end, start, date, title, cinema, hall }
  let priceSkipped = 0;
  for (const r of pricePack.rows) {
    try {
      const rawTitle = String(r["中文片名"] || "").trim();
      if (!rawTitle) continue;
      const date = parseDate(r["日期"]);
      const { start, end } = parseTimeRange(r["时间段"]);
      const cinema = String(r["影院"] || "").trim();
      const price = Number(String(r["票价"]).replace(/[^\d.]/g, "")) || 0;
      const key = matchKey(rawTitle, cinema, date, start);
      priceIndex.set(key, {
        price,
        end,
        start,
        date,
        rawTitle,
        cinema,
        hall: String(r["影厅"] || "").trim(),
      });
    } catch {
      priceSkipped += 1;
    }
  }

  const cinemaNameToId = new Map();
  const cinemasById = new Map();
  let unknownIdx = 0;

  function resolveCinema(rawName, addressHint) {
    const name = String(rawName).trim();
    if (cinemaNameToId.has(name)) {
      const id = cinemaNameToId.get(name);
      if (addressHint && cinemasById.get(id) && !CINEMA_META[name]) {
        cinemasById.get(id).address = addressHint;
      }
      return id;
    }

    const meta = CINEMA_META[name];
    let id;
    let cinema;
    if (meta) {
      id = meta.id;
      cinema = {
        id,
        nameZh: meta.nameZh,
        nameEn: meta.nameEn,
        district: meta.district,
        address: addressHint || meta.address,
        lat: meta.lat,
        lng: meta.lng,
        screeningCount: 0,
        todayCount: 0,
        heat: 0,
        blurb: meta.blurb || `${meta.nameZh} · 上影节展映点`,
        tips: defaultTips(meta.district),
        supplies: [{ kind: "metro", text: "请以现场交通指引为准" }],
      };
    } else {
      unknownIdx += 1;
      id = `cinema_${slugify(name) || `extra_${unknownIdx}`}`;
      if (cinemasById.has(id)) id = `${id}_${unknownIdx}`;
      cinema = {
        id,
        nameZh: name.replace(/[（(].*?[）)]/g, "").trim() || name,
        district: "上海",
        address: addressHint || name,
        lat: 31.2304 + (hashStr(name) % 200) / 1000 - 0.1,
        lng: 121.4737 + (hashStr(name + "x") % 200) / 1000 - 0.1,
        screeningCount: 0,
        todayCount: 0,
        heat: 0,
        blurb: `${name} · 上影节展映点`,
        tips: defaultTips("上海"),
        supplies: [{ kind: "metro", text: "请以现场交通指引为准" }],
      };
    }

    if (!cinemasById.has(id)) cinemasById.set(id, cinema);
    cinemaNameToId.set(name, id);
    return id;
  }

  const filmsMap = new Map(); // titleZh -> film
  const usedPriceKeys = new Set();
  const sectionSet = new Set();
  let richSkipped = 0;
  let priceMatched = 0;

  function ensureFilm(meta) {
    const { titleZh, titleEn, director, countries, runtimeMin, section, baseTags } =
      meta;
    let film = filmsMap.get(titleZh);
    if (!film) {
      const id = `film_${slugify(titleZh) || hashStr(titleZh).toString(36)}`;
      film = {
        id,
        titleZh,
        titleEn: titleEn || titleZh,
        year: 2026,
        countries: countries.length ? countries : ["待补充"],
        runtimeMin: runtimeMin || 100,
        director: director || "待补充",
        section: section || "展映精选",
        posterGradient: GRADIENTS[hashStr(titleZh) % GRADIENTS.length],
        poster: POSTER_BY_TITLE[titleZh],
        screenings: [],
      };
      filmsMap.set(titleZh, film);
    } else {
      if (titleEn && (film.titleEn === film.titleZh || !film.titleEn)) {
        film.titleEn = titleEn;
      }
      if (director && director !== "待补充") film.director = director;
      if (countries.length && film.countries[0] === "待补充") {
        film.countries = countries;
      }
      if (runtimeMin > 0) film.runtimeMin = runtimeMin;
      if (section) film.section = section;
    }
    if (section) sectionSet.add(section);
    return film;
  }

  function addScreening(film, scr) {
    let uniqueId = scr.id;
    let n = 2;
    while (film.screenings.some((s) => s.id === uniqueId)) {
      uniqueId = `${scr.id}_${n++}`;
    }
    film.screenings.push({ ...scr, id: uniqueId });
    const c = cinemasById.get(scr.cinemaId);
    if (c) c.screeningCount += 1;
  }

  // Pass 1: rich sheet
  for (const r of richPack.rows) {
    try {
      const rawTitle = String(r["中文片名"] || "").trim();
      if (!rawTitle || rawTitle === "中文片名") {
        richSkipped += 1;
        continue;
      }
      const { titleZh, baseTags } = parseTitle(rawTitle);
      const titleEnRaw = String(r["英文片名"] || "").trim();
      const { titleZh: titleEn } = titleEnRaw
        ? parseTitle(titleEnRaw)
        : { titleZh: "" };
      const director = String(r["导演"] || "").trim() || "待补充";
      const countries = String(r["制片国/地区"] || "")
        .split(/[/、,，|]/)
        .map((x) => x.trim())
        .filter(Boolean);
      const runtimeMin = parseRuntimeMin(r["时长"]);
      const section = String(r["单元"] || "").trim() || "展映精选";
      const date = parseDate(r["日期"]);
      const start = parseStartOnly(r["放映时间"]);
      const cinemaRaw = String(r["影院"] || "").trim();
      const hall = String(r["影厅"] || "").trim();
      const address = String(r["影院地址"] || "").trim();
      const meetup = String(r["见面会"] || "").trim();

      const key = matchKey(rawTitle, cinemaRaw, date, start);
      const priced = priceIndex.get(key);
      if (priced) {
        usedPriceKeys.add(key);
        priceMatched += 1;
      }

      const end =
        priced?.end ||
        addMinutes(start, runtimeMin > 0 ? runtimeMin : 100);
      const price = priced?.price ?? 0;

      const cinemaId = resolveCinema(cinemaRaw, address);
      const techTags = Array.from(
        new Set([
          ...baseTags,
          ...hallTagsFrom(hall),
          ...(meetup ? ["见面会"] : []),
        ])
      );

      const film = ensureFilm({
        titleZh,
        titleEn,
        director,
        countries,
        runtimeMin: runtimeMin || minutesBetween(start, end),
        section,
        baseTags,
      });

      const scrId = `scr_${film.id.replace(/^film_/, "")}_${date.replace(/-/g, "")}_${start.replace(":", "")}_${cinemaId.replace(/^cinema_/, "")}`;
      addScreening(film, {
        id: scrId,
        filmId: film.id,
        cinemaId,
        hall,
        date,
        start,
        end,
        price,
        techTags,
        scheduledCount: 40 + (hashStr(scrId) % 280),
      });
    } catch (e) {
      richSkipped += 1;
      if (richSkipped < 8) console.warn("rich skip", e.message);
    }
  }

  // Pass 2: price-only rows not in rich
  let priceOnlyAdded = 0;
  for (const [key, p] of priceIndex.entries()) {
    if (usedPriceKeys.has(key)) continue;
    try {
      const { titleZh, baseTags } = parseTitle(p.rawTitle);
      const cinemaId = resolveCinema(p.cinema);
      const techTags = Array.from(
        new Set([...baseTags, ...hallTagsFrom(p.hall)])
      );
      const section = techTags.some((t) => /4K/i.test(t))
        ? "SIFF经典"
        : "展映精选";
      const film = ensureFilm({
        titleZh,
        titleEn: titleZh,
        director: "待补充",
        countries: ["待补充"],
        runtimeMin: minutesBetween(p.start, p.end),
        section,
        baseTags,
      });
      const scrId = `scr_${film.id.replace(/^film_/, "")}_${p.date.replace(/-/g, "")}_${p.start.replace(":", "")}_${cinemaId.replace(/^cinema_/, "")}`;
      addScreening(film, {
        id: scrId,
        filmId: film.id,
        cinemaId,
        hall: p.hall,
        date: p.date,
        start: p.start,
        end: p.end,
        price: p.price,
        techTags,
        scheduledCount: 40 + (hashStr(scrId) % 280),
      });
      priceOnlyAdded += 1;
    } catch (e) {
      if (priceOnlyAdded < 5) console.warn("price-only skip", e.message);
    }
  }

  const films = Array.from(filmsMap.values())
    .map((f) => {
      if (!f.poster) delete f.poster;
      return f;
    })
    .sort((a, b) => a.titleZh.localeCompare(b.titleZh, "zh"));

  // heat: busiest cinema = 100, others proportional. todayCount left 0 —
  // the app recomputes 「今日」 from the user's local date at runtime.
  let maxScr = 0;
  for (const c of cinemasById.values()) {
    if (c.screeningCount > maxScr) maxScr = c.screeningCount;
  }
  const denom = maxScr > 0 ? maxScr : 1;
  for (const c of cinemasById.values()) {
    c.heat = Math.min(
      100,
      Math.max(0, Math.round((c.screeningCount / denom) * 100))
    );
    c.todayCount = 0;
  }

  // keep richer tips from previous export if any
  const prevPath = path.join(ROOT, "public/data/cinemas.json");
  if (fs.existsSync(prevPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(prevPath, "utf8"));
      const prevById = new Map(prev.map((c) => [c.id, c]));
      for (const c of cinemasById.values()) {
        const p = prevById.get(c.id);
        if (!p) continue;
        if (p.tips?.length) c.tips = p.tips;
        if (p.supplies?.length) c.supplies = p.supplies;
        if (p.blurb) c.blurb = p.blurb;
      }
    } catch {
      /* ignore */
    }
  }

  const cinemas = Array.from(cinemasById.values()).sort(
    (a, b) => b.screeningCount - a.screeningCount
  );

  const matrix = {};
  for (const a of cinemas) {
    matrix[a.id] = {};
    for (const b of cinemas) {
      if (a.id === b.id) continue;
      matrix[a.id][b.id] = haversineMin(a, b);
    }
  }
  const tuned = {
    cinema_sfc: {
      cinema_grand: 32,
      cinema_tianshan: 22,
      cinema_majestic: 28,
      cinema_peace: 30,
    },
    cinema_grand: {
      cinema_sfc: 32,
      cinema_tianshan: 38,
      cinema_majestic: 18,
      cinema_peace: 12,
    },
  };
  for (const [from, tos] of Object.entries(tuned)) {
    if (!matrix[from]) continue;
    for (const [to, min] of Object.entries(tos)) {
      if (matrix[from][to] != null) matrix[from][to] = min;
      if (matrix[to]?.[from] != null) matrix[to][from] = min;
    }
  }

  const sections = [
    "全部",
    ...Array.from(sectionSet)
      .map((s) => s.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "zh")),
  ];

  const screeningCount = films.reduce((n, f) => n + f.screenings.length, 0);
  const withPrice = films
    .flatMap((f) => f.screenings)
    .filter((s) => s.price > 0).length;

  const dataset = {
    festival: "上海国际电影节",
    year: 2026,
    editionLabel: "2026 · 第28届",
    sections,
    films,
    _meta: {
      sources: [path.basename(richPath), path.basename(pricePath)],
      importedAt: new Date().toISOString(),
      screeningCount,
      filmCount: films.length,
      cinemaCount: cinemas.length,
      priceMatched,
      priceOnlyAdded,
      withPrice,
      richSkipped,
      priceSkipped,
    },
  };

  fs.writeFileSync(
    path.join(ROOT, "public/data/siff_2026_films.json"),
    JSON.stringify(dataset, null, 2) + "\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(ROOT, "public/data/cinemas.json"),
    JSON.stringify(cinemas, null, 2) + "\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(ROOT, "public/data/cinema_transit_matrix.json"),
    JSON.stringify(matrix, null, 2) + "\n",
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        films: films.length,
        screenings: screeningCount,
        cinemas: cinemas.length,
        sections: sections.length,
        priceMatched,
        priceOnlyAdded,
        withPrice,
        richSkipped,
        sample: films.find((f) => f.director !== "待补充"),
      },
      null,
      2
    )
  );
}

main();
