import type { Film } from "@/types/film";

/** Reuse one collator — localeCompare("zh") per pair is very slow on mobile. */
const zhCollator =
  typeof Intl !== "undefined" ? new Intl.Collator("zh") : null;
const enCollator =
  typeof Intl !== "undefined" ? new Intl.Collator("en") : null;

/** 0 = letter (Latin/CJK), 1 = digit, 2 = other symbols */
function titleSortGroup(title: string): number {
  const ch = title.trim()[0] ?? "";
  if (/[0-9０-９]/.test(ch)) return 1;
  if (/[a-zA-Z\u4e00-\u9fff]/.test(ch)) return 0;
  return 2;
}

function cmpZh(a: string, b: string): number {
  if (zhCollator) return zhCollator.compare(a, b);
  return a < b ? -1 : a > b ? 1 : 0;
}

function cmpEn(a: string, b: string): number {
  if (enCollator) return enCollator.compare(a, b);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Letters first (zh pinyin order), then digits, then symbols. */
export function compareFilmsByTitle(a: Film, b: Film): number {
  const ga = titleSortGroup(a.titleZh);
  const gb = titleSortGroup(b.titleZh);
  if (ga !== gb) return ga - gb;
  const byZh = cmpZh(a.titleZh, b.titleZh);
  if (byZh !== 0) return byZh;
  return cmpEn(a.titleEn, b.titleEn);
}
