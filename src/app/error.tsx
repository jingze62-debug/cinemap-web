"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CineMap]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center text-ink">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">
        Client error
      </p>
      <h1 className="font-display text-2xl font-black tracking-tight">
        页面出了点问题
      </h1>
      <p className="text-[13px] leading-relaxed text-ink/55">
        手机浏览器常会缓存旧脚本。请点下方清除后重开；或用系统浏览器打开（勿用微信内置页）。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="rounded-md border border-ink/15 bg-panel-raised px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent"
          onClick={() => {
            try {
              for (const k of Object.keys(localStorage)) {
                if (k.startsWith("cinemap-")) localStorage.removeItem(k);
              }
              sessionStorage.clear();
            } catch {
              /* ignore */
            }
            window.location.href = "/?r=" + Date.now();
          }}
        >
          清除缓存并重开
        </button>
        <button
          type="button"
          className="rounded-md border border-ink/15 px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-wider text-ink/60 hover:border-accent/40 hover:text-accent"
          onClick={() => reset()}
        >
          再试一次
        </button>
      </div>
    </div>
  );
}
