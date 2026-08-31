"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MAIN_FUNNEL,
  clearEvents,
  computeFunnel,
  eventCounts,
  exportEventsJson,
  fetchRemoteStats,
  getEvents,
  type FunnelStepResult,
} from "@/lib/analytics";

const TOKEN_KEY = "cinemap-analytics-read-token";

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

type Scope = "local" | "remote";

export default function AnalyticsPage() {
  const [scope, setScope] = useState<Scope>("local");
  const [funnel, setFunnel] = useState<FunnelStepResult[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [sessions, setSessions] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(TOKEN_KEY) ?? "";
      if (saved) {
        setToken(saved);
        setTokenInput(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshLocal = useCallback(() => {
    const events = getEvents();
    setTotal(events.length);
    setSessions(null);
    setFunnel(computeFunnel(MAIN_FUNNEL, events));
    setCounts(eventCounts(events));
    setRemoteError(null);
  }, []);

  const refreshRemote = useCallback(async (readToken: string) => {
    if (!readToken) {
      setRemoteError("请先填写读取口令");
      return;
    }
    setLoading(true);
    setRemoteError(null);
    try {
      const data = await fetchRemoteStats(readToken);
      if (!data.ok) {
        setRemoteError(
          data.error === "unauthorized"
            ? "口令错误"
            : data.error === "stats_not_configured"
              ? "远端尚未配置读取口令"
              : data.error ?? "加载失败"
        );
        return;
      }
      setTotal(data.totalEvents ?? 0);
      setSessions(data.totalSessions ?? null);
      setCounts(data.counts ?? {});
      setFunnel(data.funnel ?? []);
    } catch {
      setRemoteError("无法连接远端（本地预览时 /api 不存在属正常）");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    if (scope === "local") refreshLocal();
    else void refreshRemote(token);
  }, [scope, token, refreshLocal, refreshRemote]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const maxCount = useMemo(
    () => Math.max(1, ...funnel.map((s) => s.count)),
    [funnel]
  );

  const saveToken = () => {
    const next = tokenInput.trim();
    setToken(next);
    try {
      sessionStorage.setItem(TOKEN_KEY, next);
    } catch {
      /* ignore */
    }
    setScope("remote");
    void refreshRemote(next);
  };

  const onExport = () => {
    const blob = new Blob([exportEventsJson()], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cinemap-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportEventsJson());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const onClear = () => {
    if (!window.confirm("清空本机全部埋点事件？不可恢复。")) return;
    clearEvents();
    if (scope === "local") refreshLocal();
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-10 pt-6 text-ink">
      <div className="flex items-center justify-between gap-3 border-b border-ink/15 pb-3">
        <Link
          href="/"
          className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink/55 hover:text-accent"
        >
          ← 返回 CineMap
        </Link>
        <button
          type="button"
          onClick={refresh}
          className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink/55 hover:text-accent"
        >
          {loading ? "加载中…" : "刷新"}
        </button>
      </div>

      <header className="mt-5">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">
          Analytics
        </p>
        <h1 className="mt-1 font-display text-2xl font-black tracking-tight">
          埋点与行为漏斗
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink/60">
          用户行为会写入本机，并上报到 Cloudflare
          D1。全站漏斗需读取口令；本机视图无需口令。
        </p>
      </header>

      <div className="mt-4 flex gap-2">
        {(
          [
            ["local", "本机"],
            ["remote", "全站远端"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setScope(id)}
            className={
              scope === id
                ? "rounded-md border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[11px] font-bold text-accent"
                : "rounded-md border border-ink/15 px-3 py-1.5 font-mono text-[11px] font-bold text-ink/55"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {scope === "remote" && (
        <section className="mt-4 rounded-lg border border-ink/12 bg-panel-raised/50 p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink/45">
            读取口令（仅你可见）
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ANALYTICS_READ_TOKEN"
              className="min-w-0 flex-1 rounded-md border border-ink/15 bg-paper/80 px-2.5 py-2 font-mono text-[12px] outline-none focus:border-accent/50"
            />
            <button
              type="button"
              onClick={saveToken}
              className="shrink-0 rounded-md border border-ink/15 bg-panel-raised px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent"
            >
              连接
            </button>
          </div>
          {remoteError && (
            <p className="mt-2 text-[12px] text-red-600">{remoteError}</p>
          )}
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-end justify-between gap-2">
          <h2 className="font-display text-lg font-black tracking-tight">
            主路径漏斗
          </h2>
          <p className="font-mono text-[11px] text-ink/45">
            {total} 条事件
            {sessions != null ? ` · ${sessions} 会话` : ""}
          </p>
        </div>

        <ul className="mt-4 space-y-3">
          {funnel.map((step, i) => (
            <li
              key={step.name}
              className="rounded-lg border border-ink/12 bg-panel-raised/50 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-mono text-[11px] font-bold text-ink/50">
                  {String(i + 1).padStart(2, "0")} · {step.label}
                </p>
                <p className="font-display text-lg font-black tabular-nums">
                  {step.count}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${(step.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink/50">
                <span>相对起点 {pct(step.rateFromStart)}</span>
                <span>
                  相对上一步 {i === 0 ? "—" : pct(step.rateFromPrev)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-black tracking-tight">
          事件计数
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, n]) => (
              <div
                key={name}
                className="rounded-md border border-ink/10 bg-chassis/40 px-2.5 py-2"
              >
                <p className="truncate font-mono text-[10px] text-ink/45">
                  {name}
                </p>
                <p className="font-display text-base font-black tabular-nums">
                  {n}
                </p>
              </div>
            ))}
          {Object.keys(counts).length === 0 && (
            <p className="col-span-2 text-[13px] text-ink/50">
              暂无数据。用户走完主路径后会出现在全站远端。
            </p>
          )}
        </div>
      </section>

      <section className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded-md border border-ink/15 bg-panel-raised px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent"
        >
          导出本机 JSON
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-ink/15 bg-panel-raised px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent"
        >
          {copied ? "已复制" : "复制本机 JSON"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-ink/15 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink/55 hover:border-red-400/50 hover:text-red-600"
        >
          清空本机
        </button>
      </section>
    </div>
  );
}
