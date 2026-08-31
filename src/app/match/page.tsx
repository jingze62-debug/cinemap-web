import Link from "next/link";
import { MatchClient } from "@/components/match/MatchClient";

export default function MatchPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[max(2rem,env(safe-area-inset-top,0px))] text-ink">
      <Link
        href="/"
        className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-white/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink/55 hover:border-accent/40 hover:text-accent"
      >
        ← Exit
      </Link>
      <header className="mt-5 flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center border-2 border-ink bg-panel-raised font-display text-2xl font-black tracking-tight">
          04
        </div>
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink/50">
            <span className="text-accent">{"//"}</span> Transmit · Match
          </p>
          <h1 className="mt-1.5 font-display text-[1.9rem] font-black uppercase leading-[1.05] tracking-tight">
            Open The <span className="text-accent">Channel.</span>
          </h1>
          <p className="mt-2 font-mono text-[13px] font-medium leading-relaxed text-ink/55">
            交换口令，查看共同场次与差异，并可合并到当前方案。
          </p>
        </div>
      </header>
      <div className="mt-6">
        <MatchClient />
      </div>
    </main>
  );
}
