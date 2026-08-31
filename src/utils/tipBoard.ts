/** Local-first mock for cinema tip UGC (Supabase stand-in) */

export type TipKind = "pitfall" | "supply" | "advantage";

export type TipNote = {
  id: string;
  cinemaId: string;
  text: string;
  kind: TipKind;
  createdAt: string;
};

const STORAGE_KEY = "cinemap-tipboard-v1";
const RATE_KEY = "cinemap-tipboard-rate";
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function readAll(): TipNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TipNote[]) : [];
  } catch {
    return [];
  }
}

function writeAll(notes: TipNote[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export async function fetchTipsForCinema(cinemaId: string): Promise<TipNote[]> {
  await new Promise((r) => setTimeout(r, 80));
  return readAll()
    .filter((n) => n.cinemaId === cinemaId)
    .map((n) => ({ ...n, kind: n.kind ?? "pitfall" }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function postTip(
  cinemaId: string,
  text: string,
  kind: TipKind = "pitfall"
): Promise<TipNote> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("内容不能为空");
  if (trimmed.length > 120) throw new Error("最多 120 字");

  const now = Date.now();
  const rateRaw = localStorage.getItem(RATE_KEY);
  const stamps: number[] = rateRaw ? (JSON.parse(rateRaw) as number[]) : [];
  const recent = stamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    throw new Error("发送太频繁，请稍后再试");
  }
  recent.push(now);
  localStorage.setItem(RATE_KEY, JSON.stringify(recent));

  const note: TipNote = {
    id: `tip_${Math.random().toString(36).slice(2, 10)}`,
    cinemaId,
    text: trimmed,
    kind,
    createdAt: new Date(now).toISOString(),
  };
  const all = readAll();
  all.push(note);
  writeAll(all);
  return note;
}
