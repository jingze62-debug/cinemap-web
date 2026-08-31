/**
 * Cloudflare Pages Function: GET /api/stats
 * Header: Authorization: Bearer <ANALYTICS_READ_TOKEN>
 * Returns aggregated event counts + main-path funnel across all devices.
 */
interface Env {
  DB: D1Database;
  ANALYTICS_READ_TOKEN?: string;
}

type FunnelStep = { name: string; label: string };

const MAIN_FUNNEL: FunnelStep[] = [
  { name: "festival_enter", label: "选影展" },
  { name: "film_want", label: "选片（想看）" },
  { name: "screening_add", label: "加场次 / 排片" },
  { name: "venue_check_in", label: "地图点亮" },
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function computeFunnel(
  rows: { name: string; ts: number; session_id: string }[]
) {
  const bySession = new Map<string, { name: string; ts: number }[]>();
  for (const e of rows) {
    const list = bySession.get(e.session_id) ?? [];
    list.push({ name: e.name, ts: e.ts });
    bySession.set(e.session_id, list);
  }

  const stepNames = MAIN_FUNNEL.map((s) => s.name);
  const counts = MAIN_FUNNEL.map(() => 0);

  for (const list of bySession.values()) {
    const sorted = [...list].sort((a, b) => a.ts - b.ts);
    let nextIdx = 0;
    for (const e of sorted) {
      if (nextIdx >= stepNames.length) break;
      if (e.name === stepNames[nextIdx]) {
        counts[nextIdx] += 1;
        nextIdx += 1;
      }
    }
  }

  const start = counts[0] || 0;
  return MAIN_FUNNEL.map((step, i) => {
    const count = counts[i];
    const prev = i === 0 ? count : counts[i - 1];
    return {
      name: step.name,
      label: step.label,
      count,
      rateFromStart: start === 0 ? 0 : count / start,
      rateFromPrev: prev === 0 ? 0 : count / prev,
    };
  });
}

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const expected = context.env.ANALYTICS_READ_TOKEN;
  if (!expected) {
    return json({ ok: false, error: "stats_not_configured" }, 503);
  }
  const auth = context.request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== expected) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    const countRows = await context.env.DB.prepare(
      `SELECT name, COUNT(*) AS n FROM events GROUP BY name ORDER BY n DESC`
    ).all<{ name: string; n: number }>();

    const funnelRows = await context.env.DB.prepare(
      `SELECT name, ts, session_id FROM events
       WHERE name IN ('festival_enter','film_want','screening_add','venue_check_in')
       ORDER BY ts ASC
       LIMIT 50000`
    ).all<{ name: string; ts: number; session_id: string }>();

    const totalRow = await context.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM events`
    ).first<{ n: number }>();

    const sessionsRow = await context.env.DB.prepare(
      `SELECT COUNT(DISTINCT session_id) AS n FROM events`
    ).first<{ n: number }>();

    const counts: Record<string, number> = {};
    for (const r of countRows.results ?? []) {
      counts[r.name] = Number(r.n);
    }

    return json({
      ok: true,
      source: "remote",
      totalEvents: Number(totalRow?.n ?? 0),
      totalSessions: Number(sessionsRow?.n ?? 0),
      counts,
      funnel: computeFunnel(funnelRows.results ?? []),
    });
  } catch (err) {
    console.error("stats failed", err);
    return json({ ok: false, error: "db_error" }, 500);
  }
};
