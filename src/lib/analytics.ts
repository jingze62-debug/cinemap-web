/**
 * Local-first analytics: event tracking + main-path behavioral funnel.
 * Events stay in the browser (static export / Cloudflare Pages friendly).
 */

export type AnalyticsEventName =
  | "app_open"
  | "festival_enter"
  | "festival_leave"
  | "tab_view"
  | "film_want"
  | "film_unwant"
  | "screening_add"
  | "screening_remove"
  | "venue_check_in"
  | "venue_check_out";

export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

export type AnalyticsEvent = {
  id: string;
  name: AnalyticsEventName;
  ts: number;
  sessionId: string;
  props?: AnalyticsProps;
};

export type FunnelStep = {
  name: AnalyticsEventName;
  label: string;
};

/** Critical path: 选影展 → 选片 → 加场次/排片 → 地图点亮 */
export const MAIN_FUNNEL: FunnelStep[] = [
  { name: "festival_enter", label: "选影展" },
  { name: "film_want", label: "选片（想看）" },
  { name: "screening_add", label: "加场次 / 排片" },
  { name: "venue_check_in", label: "地图点亮" },
];

export type FunnelStepResult = {
  name: AnalyticsEventName;
  label: string;
  count: number;
  rateFromStart: number;
  rateFromPrev: number;
};

const STORAGE_KEY = "cinemap-analytics-v1";
const SESSION_KEY = "cinemap-analytics-session-v1";
const MAX_EVENTS = 2000;

type StoreShape = { events: AnalyticsEvent[] };

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function readStore(): StoreShape {
  if (typeof window === "undefined") return { events: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { events: [] };
    const parsed = JSON.parse(raw) as StoreShape;
    return Array.isArray(parsed?.events) ? { events: parsed.events } : { events: [] };
  } catch {
    return { events: [] };
  }
}

function writeStore(store: StoreShape): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return uid();
  }
}

function remoteEndpoint(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT?.trim();
  if (fromEnv) return fromEnv;
  // Same-origin Cloudflare Pages Function
  return "/api/track";
}

function sendRemote(event: AnalyticsEvent): void {
  const url = remoteEndpoint();
  const body = JSON.stringify(event);
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const ok = navigator.sendBeacon(
        url,
        new Blob([body], { type: "application/json" })
      );
      if (ok) return;
    }
  } catch {
    /* fall through */
  }
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      mode: "cors",
    }).catch(() => {
      /* ignore network / CORS / offline */
    });
  } catch {
    /* offline / blocked */
  }
}

/** Fire a product event. Safe to call from client components / stores. */
export function track(
  name: AnalyticsEventName,
  props?: AnalyticsProps
): void {
  if (typeof window === "undefined") return;
  try {
    const event: AnalyticsEvent = {
      id: uid(),
      name,
      ts: Date.now(),
      sessionId: getSessionId(),
      props: props ? sanitizeProps(props) : undefined,
    };
    const store = readStore();
    store.events.push(event);
    if (store.events.length > MAX_EVENTS) {
      store.events = store.events.slice(-MAX_EVENTS);
    }
    writeStore(store);
    sendRemote(event);

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug("[analytics]", name, props ?? {});
    }
  } catch {
    /* never break the product UI for analytics */
  }
}

export type RemoteStatsResponse = {
  ok: boolean;
  source?: string;
  totalEvents?: number;
  totalSessions?: number;
  counts?: Record<string, number>;
  funnel?: FunnelStepResult[];
  error?: string;
};

/** Fetch aggregated remote funnel (requires read token). */
export async function fetchRemoteStats(
  token: string
): Promise<RemoteStatsResponse> {
  const base =
    process.env.NEXT_PUBLIC_ANALYTICS_STATS_ENDPOINT?.trim() || "/api/stats";
  const res = await fetch(base, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return (await res.json()) as RemoteStatsResponse;
}

function sanitizeProps(props: AnalyticsProps): AnalyticsProps {
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export function getEvents(): AnalyticsEvent[] {
  return readStore().events;
}

export function clearEvents(): void {
  writeStore({ events: [] });
}

export function exportEventsJson(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      funnel: MAIN_FUNNEL.map((s) => s.name),
      events: getEvents(),
    },
    null,
    2
  );
}

/**
 * Session-ordered funnel: a session counts at step N only if it
 * completed steps 0..N-1 earlier in the same session (by timestamp).
 */
export function computeFunnel(
  steps: FunnelStep[] = MAIN_FUNNEL,
  events: AnalyticsEvent[] = getEvents()
): FunnelStepResult[] {
  const bySession = new Map<string, AnalyticsEvent[]>();
  for (const e of events) {
    const list = bySession.get(e.sessionId) ?? [];
    list.push(e);
    bySession.set(e.sessionId, list);
  }

  const stepNames = steps.map((s) => s.name);
  const counts = steps.map(() => 0);

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
  return steps.map((step, i) => {
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

export function eventCounts(
  events: AnalyticsEvent[] = getEvents()
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    out[e.name] = (out[e.name] ?? 0) + 1;
  }
  return out;
}
