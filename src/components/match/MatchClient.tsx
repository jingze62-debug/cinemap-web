"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { DiffReport } from "@/components/match/DiffReport";
import { Button } from "@/components/ui/button";
import { useFestivalData } from "@/hooks/useFestivalData";
import { useScheduleStore } from "@/hooks/useScheduleStore";
import {
  decodeMatchPassphrase,
  diffScreeningIds,
  encodeMatchPassphrase,
} from "@/utils/matchCompressor";

export function MatchClient() {
  const festival = useFestivalData();
  const plans = useScheduleStore((s) => s.plans);
  const activePlanId = useScheduleStore((s) => s.activePlanId);
  const addScreening = useScheduleStore((s) => s.addScreening);
  const activePlan = plans.find((p) => p.id === activePlanId);

  const [peerCode, setPeerCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [imported, setImported] = useState(0);

  const myCode = useMemo(() => {
    if (!activePlan) return "";
    return encodeMatchPassphrase(activePlan.screeningIds, activePlan.name);
  }, [activePlan]);

  const result = useMemo(() => {
    if (!peerCode.trim() || !activePlan) return null;
    try {
      const theirs = decodeMatchPassphrase(peerCode);
      const diff = diffScreeningIds(activePlan.screeningIds, theirs.ids);
      return { theirs, diff, error: null as string | null };
    } catch (e) {
      return {
        theirs: null,
        diff: null,
        error: e instanceof Error ? e.message : "解析失败",
      };
    }
  }, [peerCode, activePlan]);

  const copyMine = async () => {
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("复制失败，请手动选中口令");
    }
  };

  const importBoth = () => {
    if (!result?.diff) return;
    let n = 0;
    for (const id of [...result.diff.both, ...result.diff.onlyTheirs]) {
      if (!activePlan?.screeningIds.includes(id)) {
        addScreening(id);
        n += 1;
      }
    }
    setImported(n);
  };

  if (festival.status === "loading") {
    return <p className="text-sm text-ink/45">加载中…</p>;
  }
  if (festival.status === "error") {
    return <p className="text-sm text-accent">{festival.message}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border-2 border-ink/12 bg-panel-raised text-ink">
        <div className="h-1 w-full cm-hazard" aria-hidden />
        <div className="p-4">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">
            <span className="text-accent">{"//"}</span> Operator ·{" "}
            {activePlan?.name} · {activePlan?.screeningIds.length ?? 0} sessions
          </p>
          <label className="mt-3 block font-mono text-[11px] font-bold uppercase tracking-wider text-ink/55">
            我的口令
            <textarea
              readOnly
              value={myCode}
              rows={3}
              className="mt-1.5 w-full rounded-lg border-2 border-ink/12 bg-panel px-3 py-2 font-mono text-[12px] font-semibold leading-relaxed text-ink outline-none"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 font-mono text-[11px] font-bold uppercase tracking-wider"
            onClick={copyMine}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "已复制" : "复制我的口令"}
          </Button>
        </div>
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-wider text-ink/50">
          <span className="text-accent">{"//"}</span> 粘贴对方口令
          <textarea
            value={peerCode}
            onChange={(e) => {
              setPeerCode(e.target.value);
              setError(null);
              setImported(0);
            }}
            rows={3}
            placeholder="CM1...."
            className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/25"
          />
        </label>
      </div>

      {(error || result?.error) && (
        <p className="font-mono text-sm text-accent">
          {error ?? result?.error}
        </p>
      )}

      {result?.diff && result.theirs && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-black uppercase tracking-tight">
              差分报告
            </h2>
            <Button
              type="button"
              size="sm"
              variant="accent"
              className="font-mono text-[10px] uppercase tracking-wider"
              onClick={importBoth}
            >
              合并对方场次
            </Button>
          </div>
          {imported > 0 && (
            <p className="font-mono text-xs text-signal-dim">
              已合并 {imported} 场到当前方案
            </p>
          )}
          <DiffReport
            diff={result.diff}
            myName={activePlan?.name ?? "我"}
            theirName={result.theirs.name}
            screeningsById={festival.data.screeningsById}
            filmsById={festival.data.filmsById}
            cinemasById={festival.data.cinemasById}
          />
        </div>
      )}
    </div>
  );
}
