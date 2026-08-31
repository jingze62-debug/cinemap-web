/**
 * Cloudflare Pages Function: POST /api/track
 * Body: { id, name, ts, sessionId, props? } | { events: [...] }
 */
interface Env {
  DB: D1Database;
}

type IncomingEvent = {
  id?: string;
  name?: string;
  ts?: number;
  sessionId?: string;
  props?: Record<string, unknown>;
};

const ALLOWED = new Set([
  "app_open",
  "festival_enter",
  "festival_leave",
  "tab_view",
  "film_want",
  "film_unwant",
  "screening_add",
  "screening_remove",
  "venue_check_in",
  "venue_check_out",
]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function normalize(raw: IncomingEvent): IncomingEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name : "";
  if (!ALLOWED.has(name)) return null;
  const sessionId =
    typeof raw.sessionId === "string" && raw.sessionId.length <= 80
      ? raw.sessionId
      : "";
  if (!sessionId) return null;
  const ts =
    typeof raw.ts === "number" && Number.isFinite(raw.ts)
      ? Math.floor(raw.ts)
      : Date.now();
  const id =
    typeof raw.id === "string" && raw.id.length <= 80
      ? raw.id
      : `${ts}_${Math.random().toString(36).slice(2, 10)}`;
  let props: Record<string, unknown> | undefined;
  if (raw.props && typeof raw.props === "object") {
    props = {};
    for (const [k, v] of Object.entries(raw.props).slice(0, 20)) {
      if (typeof k !== "string" || k.length > 40) continue;
      if (
        v === null ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        props[k] = typeof v === "string" ? v.slice(0, 200) : v;
      }
    }
  }
  return { id, name, ts, sessionId, props };
}

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const list: IncomingEvent[] = Array.isArray(
    (body as { events?: IncomingEvent[] })?.events
  )
    ? (body as { events: IncomingEvent[] }).events.slice(0, 50)
    : [body as IncomingEvent];

  const rows = list.map(normalize).filter(Boolean) as Required<
    Pick<IncomingEvent, "id" | "name" | "ts" | "sessionId">
  > &
    { props?: Record<string, unknown> }[];

  if (rows.length === 0) {
    return json({ ok: false, error: "no_valid_events" }, 400);
  }

  try {
    const stmts = rows.map((e) =>
      context.env.DB.prepare(
        `INSERT OR IGNORE INTO events (id, name, ts, session_id, props)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        e.id,
        e.name,
        e.ts,
        e.sessionId,
        e.props ? JSON.stringify(e.props) : null
      )
    );
    await context.env.DB.batch(stmts);
    return json({ ok: true, inserted: rows.length });
  } catch (err) {
    console.error("track insert failed", err);
    return json({ ok: false, error: "db_error" }, 500);
  }
};
