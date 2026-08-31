"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Coffee, MapPin, Sparkles } from "lucide-react";
import {
  fetchTipsForCinema,
  postTip,
  type TipKind,
  type TipNote,
} from "@/utils/tipBoard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TipBoardProps = {
  cinemaId: string;
};

const SCROLL_ITEM_CAP = 3;

const TIP_SECTIONS: {
  kind: TipKind;
  chip: string;
  title: string;
  placeholder: string;
  Icon: typeof MapPin;
}[] = [
  {
    kind: "advantage",
    chip: "亮点",
    title: "亮点",
    placeholder: "厅内视听、交通、独家体验…",
    Icon: Sparkles,
  },
  {
    kind: "pitfall",
    chip: "避坑",
    title: "避坑",
    placeholder: "散场路线、温度、选座…",
    Icon: MapPin,
  },
  {
    kind: "supply",
    chip: "周边",
    title: "周边玩乐",
    placeholder: "咖啡、餐厅、散场去处…",
    Icon: Coffee,
  },
];

function TipList({
  tips,
  Icon,
}: {
  tips: TipNote[];
  Icon: typeof MapPin;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const scrollable = tips.length > SCROLL_ITEM_CAP;
  const [maxHeightPx, setMaxHeightPx] = useState<number | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const scrollTimer = useRef(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !scrollable) {
      setMaxHeightPx(null);
      return;
    }

    const measure = () => {
      const rows = list.querySelectorAll<HTMLLIElement>(":scope > li");
      if (rows.length === 0) return;
      const gap =
        rows.length > 1
          ? rows[1].offsetTop - rows[0].offsetTop - rows[0].offsetHeight
          : 8;
      let height = 0;
      const visible = Math.min(SCROLL_ITEM_CAP, rows.length);
      for (let i = 0; i < visible; i++) {
        height += rows[i].offsetHeight;
        if (i < visible - 1) height += gap;
      }
      setMaxHeightPx(Math.ceil(height));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    Array.from(list.querySelectorAll("li")).forEach((row) => ro.observe(row));
    return () => ro.disconnect();
  }, [tips, scrollable]);

  const onScroll = () => {
    setScrolling(true);
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => setScrolling(false), 700);
  };

  useEffect(
    () => () => window.clearTimeout(scrollTimer.current),
    []
  );

  return (
    <ul
      ref={listRef}
      onScroll={scrollable ? onScroll : undefined}
      style={
        scrollable
          ? { maxHeight: maxHeightPx ?? 72 }
          : undefined
      }
      className={cn(
        "mt-2 space-y-2",
        scrollable &&
          "cm-scroll-auto touch-pan-y overflow-y-auto overscroll-contain pr-0.5",
        scrollable && scrolling && "is-scrolling"
      )}
    >
      {tips.map((t) => (
        <li
          key={t.id}
          className="flex gap-2 text-xs leading-relaxed text-ink/60"
        >
          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          {t.text}
        </li>
      ))}
    </ul>
  );
}

export function TipBoard({ cinemaId }: TipBoardProps) {
  const [tips, setTips] = useState<TipNote[]>([]);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<TipKind>("advantage");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTipsForCinema(cinemaId).then((list) => {
      if (!cancelled) setTips(list);
    });
    return () => {
      cancelled = true;
    };
  }, [cinemaId]);

  const activeSection = TIP_SECTIONS.find((s) => s.kind === kind)!;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const note = await postTip(cinemaId, text, kind);
      setTips((prev) => [note, ...prev]);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-xs font-semibold tracking-wide text-accent">
          小纸条
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TIP_SECTIONS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              onClick={() => setKind(opt.kind)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition",
                kind === opt.kind
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-ink/12 text-ink/50 hover:border-ink/25"
              )}
            >
              {opt.chip}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={activeSection.placeholder}
            className="h-9 flex-1 rounded-lg border border-ink/10 bg-white/70 px-2.5 text-xs outline-none focus:ring-2 focus:ring-accent/25"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={submit}
          >
            发送
          </Button>
        </div>
        {error && <p className="mt-1 text-[11px] text-accent">{error}</p>}
      </section>

      {TIP_SECTIONS.map(({ kind: sectionKind, title, Icon }) => {
        const sectionTips = tips.filter((t) => t.kind === sectionKind);
        return (
          <section key={sectionKind}>
            <h3 className="text-xs font-semibold tracking-wide text-accent">
              {title}
            </h3>
            {sectionTips.length > 0 ? (
              <TipList tips={sectionTips} Icon={Icon} />
            ) : (
              <p className="mt-2 text-[11px] text-ink/35">暂无</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
