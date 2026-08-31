/** Passphrase encode / decode for schedule matching */

export type MatchPayload = {
  v: 1;
  name: string;
  ids: string[];
};

const PREFIX = "CM1.";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeMatchPassphrase(
  screeningIds: string[],
  name = "我的方案"
): string {
  const payload: MatchPayload = {
    v: 1,
    name,
    ids: Array.from(new Set(screeningIds)).sort(),
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return PREFIX + toBase64Url(bytes);
}

export function decodeMatchPassphrase(raw: string): MatchPayload {
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed.startsWith(PREFIX)) {
    throw new Error("口令格式不正确（需以 CM1. 开头）");
  }
  const body = trimmed.slice(PREFIX.length);
  try {
    const json = new TextDecoder().decode(fromBase64Url(body));
    const data = JSON.parse(json) as MatchPayload;
    if (data.v !== 1 || !Array.isArray(data.ids)) {
      throw new Error("unsupported");
    }
    return {
      v: 1,
      name: data.name || "对方方案",
      ids: data.ids.filter((id) => typeof id === "string"),
    };
  } catch {
    throw new Error("口令解析失败，请检查是否完整复制");
  }
}

export type MatchDiff = {
  both: string[];
  onlyMine: string[];
  onlyTheirs: string[];
};

export function diffScreeningIds(
  mine: string[],
  theirs: string[]
): MatchDiff {
  const a = new Set(mine);
  const b = new Set(theirs);
  const both: string[] = [];
  const onlyMine: string[] = [];
  const onlyTheirs: string[] = [];
  Array.from(a).forEach((id) => {
    if (b.has(id)) both.push(id);
    else onlyMine.push(id);
  });
  Array.from(b).forEach((id) => {
    if (!a.has(id)) onlyTheirs.push(id);
  });
  return { both, onlyMine, onlyTheirs };
}
