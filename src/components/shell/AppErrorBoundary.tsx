"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catch render crashes so mobile users see recovery UI instead of a blank Next error. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CineMap]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center text-ink">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">
          Something went wrong
        </p>
        <h1 className="font-display text-2xl font-black tracking-tight">
          页面出了点问题
        </h1>
        <p className="text-[13px] leading-relaxed text-ink/55">
          可尝试清除本站缓存后重开。若刚更新过版本，强制刷新一次即可。
        </p>
        <button
          type="button"
          className="rounded-md border border-ink/15 bg-panel-raised px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent"
          onClick={() => {
            try {
              for (const k of Object.keys(localStorage)) {
                if (k.startsWith("cinemap-")) localStorage.removeItem(k);
              }
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
        >
          清除缓存并刷新
        </button>
      </div>
    );
  }
}
