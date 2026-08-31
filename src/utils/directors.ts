/** Split a raw director field into individual names (short-film anthologies). */
export function splitDirectorNames(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "待补充") return [];
  return trimmed
    .split(/[，,、/;|｜]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True if film credits include this director name (exact person, not whole blob). */
export function filmHasDirector(
  raw: string | undefined | null,
  name: string
): boolean {
  if (!name || name === "全部") return true;
  return splitDirectorNames(raw).includes(name);
}

/**
 * Compact credit for cards: single name as-is;
 * anthologies → 「首名 等 N 人」.
 */
export function formatDirectorCredit(raw: string | undefined | null): string {
  const names = splitDirectorNames(raw);
  if (names.length === 0) return "待补充";
  if (names.length === 1) return names[0];
  return `${names[0]} 等 ${names.length} 人`;
}

/** Full list for expanded detail. */
export function formatDirectorList(raw: string | undefined | null): string {
  const names = splitDirectorNames(raw);
  if (names.length === 0) return "待补充";
  return names.join(" · ");
}

/** Unique director names for filter menus, zh sort. */
export function collectDirectorOptions(
  films: { director?: string }[]
): string[] {
  const set = new Set<string>();
  for (const f of films) {
    for (const n of splitDirectorNames(f.director)) set.add(n);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
}
