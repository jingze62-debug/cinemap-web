import type { Film } from "@/types/film";

/** 0 = letter (Latin/CJK), 1 = digit, 2 = other symbols */
function titleSortGroup(title: string): number {
  const ch = title.trim()[0] ?? "";
  if (/[0-9０-９]/.test(ch)) return 1;
  if (/[a-zA-Z\u4e00-\u9fff]/.test(ch)) return 0;
  return 2;
}

/** Letters first (zh pinyin order), then digits, then symbols. */
export function compareFilmsByTitle(a: Film, b: Film): number {
  const ga = titleSortGroup(a.titleZh);
  const gb = titleSortGroup(b.titleZh);
  if (ga !== gb) return ga - gb;
  const byZh = a.titleZh.localeCompare(b.titleZh, "zh");
  if (byZh !== 0) return byZh;
  return a.titleEn.localeCompare(b.titleEn, "en");
}
