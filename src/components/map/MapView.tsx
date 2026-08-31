"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { VenueDrawer } from "@/components/map/VenueDrawer";
import { CheckInModal } from "@/components/map/CheckInModal";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useFestivalData } from "@/hooks/useFestivalData";
import { useCheckInStore } from "@/hooks/useCheckInStore";
import { cn } from "@/lib/utils";
import type { Cinema } from "@/types/cinema";

const LeafletMap = dynamic(
  () =>
    import("@/components/map/LeafletMap").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-paper text-sm text-ink/40">
        地图加载中…
      </div>
    ),
  }
);

export function MapView() {
  const festival = useFestivalData();
  const isCheckedIn = useCheckInStore((s) => s.isCheckedIn);
  const checkIn = useCheckInStore((s) => s.checkIn);
  const checkOut = useCheckInStore((s) => s.checkOut);
  const checkIns = useCheckInStore((s) => s.checkIns);

  /** Only set from left list — controls venue drawer */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Kept during slide-away so drawer can animate out */
  const [closingCinema, setClosingCinema] = useState<Cinema | null>(null);
  /** Map camera / marker highlight */
  const [focusId, setFocusId] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInTargetId, setCheckInTargetId] = useState<string | null>(null);
  const [listScrolling, setListScrolling] = useState(false);
  const listScrollTimer = useRef(0);
  const {
    ref: listDragRef,
    dragging: listDragging,
    suppressClickIfDragged,
  } = useDragScroll("y", { target: "self" });

  const onListScroll = () => {
    setListScrolling(true);
    window.clearTimeout(listScrollTimer.current);
    listScrollTimer.current = window.setTimeout(
      () => setListScrolling(false),
      700
    );
  };

  const cinemas = useMemo(() => {
    if (festival.status !== "ready") return [];
    return [...festival.data.cinemas].sort(
      (a, b) => b.screeningCount - a.screeningCount
    );
  }, [festival]);

  const selected = useMemo(
    () => cinemas.find((c) => c.id === selectedId) ?? null,
    [cinemas, selectedId]
  );

  const drawerCinema = selected ?? closingCinema;
  const drawerExiting = Boolean(closingCinema) && !selected;

  const checkedInIds = useMemo(
    () => new Set(Object.keys(checkIns)),
    [checkIns]
  );

  const litCount = checkedInIds.size;

  const checkInCinema = useMemo(() => {
    const id = checkInTargetId ?? selectedId;
    return cinemas.find((c) => c.id === id) ?? null;
  }, [checkInTargetId, selectedId, cinemas]);

  const openCheckIn = (cinemaId: string) => {
    setCheckInTargetId(cinemaId);
    setCheckInOpen(true);
  };

  const closeCheckIn = () => {
    setCheckInOpen(false);
    setCheckInTargetId(null);
  };

  const finishDismiss = useCallback(() => {
    setClosingCinema(null);
  }, []);

  const dismissDrawer = useCallback(() => {
    if (closingCinema && !selectedId) return;
    const current =
      cinemas.find((c) => c.id === selectedId) ?? closingCinema;
    if (!current) return;
    setClosingCinema(current);
    setSelectedId(null);
    setFocusId(null);
  }, [cinemas, closingCinema, selectedId]);

  const selectCinema = (id: string) => {
    setClosingCinema(null);
    setSelectedId(id);
    setFocusId(id);
  };

  if (festival.status === "loading") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-paper text-sm text-ink/40">
        正在加载影院数据…
      </div>
    );
  }

  if (festival.status === "error") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-paper text-sm text-accent">
        {festival.message}
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] flex-col overflow-hidden bg-paper px-3 pb-3 pt-3 text-ink">
      <div className="relative z-[400] mb-3 shrink-0 space-y-2 px-0.5">
        <div className="flex items-start gap-3">
          <div className="cm-frost pointer-events-none flex h-12 w-12 shrink-0 items-center justify-center border-2 border-ink font-display text-xl font-black tracking-tight">
            04
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink/50">
              <span className="text-accent">{"//"}</span> Geo · Check-in
            </p>
            <h1 className="mt-0.5 font-display text-[1.35rem] font-black leading-tight tracking-tight text-ink sm:text-[1.75rem]">
              打卡<span className="bg-accent px-1.5 text-white">点亮</span>城市
            </h1>
            <p className="mt-1 font-mono text-[10px] font-bold tracking-wide text-ink/45">
              {cinemas.length} 家展映影院 · 你已点亮{" "}
              <span className="text-accent">{litCount}</span> 家
            </p>
          </div>
        </div>
        {cinemas.length > 0 && (
          <div className="cm-frost overflow-hidden rounded-lg border border-ink/10 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink/40">
                点亮进度
              </p>
              <p className="font-mono text-[10px] font-bold text-ink/55">
                {litCount}/{cinemas.length}
              </p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft transition-[width] duration-500 ease-out"
                style={{
                  width: `${cinemas.length ? (litCount / cinemas.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Film-gate viewport: inset so paper chassis softens the hard tile cut */}
      <div className="cm-map-gate relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-ink/14 bg-map-bg/30 shadow-[0_10px_36px_color-mix(in_srgb,var(--ink)_12%,transparent)] ring-1 ring-inset ring-white/25">
        <div className="cm-frost absolute left-2.5 top-2.5 z-[400] flex max-h-[min(42vh,16.5rem)] w-[12.5rem] flex-col overflow-hidden rounded-xl border border-ink/12 shadow-md shadow-ink/10">
          <div className="h-1 w-full shrink-0 cm-hazard" aria-hidden />
          <p className="shrink-0 border-b border-ink/10 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink/40">
            <span className="text-accent">{"//"}</span> Sorted · Scroll
          </p>
          <div
            ref={listDragRef}
            data-cinema-list-scroll
            onClickCapture={suppressClickIfDragged}
            onScroll={onListScroll}
            className={cn(
              "cm-scroll-auto min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1.5 select-none",
              listDragging ? "cursor-grabbing" : "cursor-grab",
              (listScrolling || listDragging) && "is-scrolling"
            )}
          >
            {cinemas.map((c) => {
              const active = c.id === selectedId;
              const lit = checkedInIds.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (selectedId === c.id) {
                      dismissDrawer();
                      return;
                    }
                    selectCinema(c.id);
                  }}
                  className={cn(
                    "w-full rounded-md px-2.5 py-2 text-left transition-colors",
                    active ? "bg-accent text-white" : "text-ink hover:bg-ink/5"
                  )}
                >
                  <p className="truncate font-mono text-[12px] font-bold">
                    {lit ? (
                      <Sparkles
                        className={cn(
                          "mr-1 inline h-3 w-3 shrink-0",
                          active ? "text-white/90" : "text-accent"
                        )}
                        aria-hidden
                      />
                    ) : null}
                    {c.nameZh}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 truncate font-mono text-[10px] font-medium",
                      active ? "text-white/75" : "text-ink/45"
                    )}
                  >
                    {c.screeningCount}场 · 热度 {c.heat} · {c.district}
                    {lit ? " · 已点亮" : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="absolute inset-0 z-0">
          <LeafletMap
            cinemas={cinemas}
            selectedId={selectedId}
            focusId={focusId}
            checkedInIds={checkedInIds}
            onMarkerClick={(id) => setFocusId(id)}
            onBlankClick={drawerCinema ? dismissDrawer : undefined}
          />
        </div>

        {/* Soft paper bleed — kills knife-edge between tiles and chassis */}
        <div
          className="pointer-events-none absolute inset-0 z-[350] rounded-2xl"
          aria-hidden
        >
          <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_10%,transparent)]" />
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_center,transparent_52%,color-mix(in_srgb,var(--paper)_55%,transparent)_100%)]" />
          <div className="absolute inset-x-0 top-0 h-10 rounded-t-2xl bg-gradient-to-b from-paper/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-paper/45 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-6 rounded-l-2xl bg-gradient-to-r from-paper/40 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-6 rounded-r-2xl bg-gradient-to-l from-paper/40 to-transparent" />
          {/* Corner registration ticks — film gate vernacular */}
          <span className="absolute left-2.5 top-2.5 h-3 w-3 border-l-2 border-t-2 border-ink/25" />
          <span className="absolute right-2.5 top-2.5 h-3 w-3 border-r-2 border-t-2 border-ink/25" />
          <span className="absolute bottom-2.5 left-2.5 h-3 w-3 border-b-2 border-l-2 border-ink/25" />
          <span className="absolute bottom-2.5 right-2.5 h-3 w-3 border-b-2 border-r-2 border-ink/25" />
        </div>

        <VenueDrawer
          cinema={drawerCinema}
          checkedIn={
            drawerCinema ? isCheckedIn(drawerCinema.id) : false
          }
          exiting={drawerExiting}
          onClose={dismissDrawer}
          onExitComplete={finishDismiss}
          onToggleCheckIn={() => {
            if (!drawerCinema) return;
            if (isCheckedIn(drawerCinema.id)) checkOut(drawerCinema.id);
          }}
          onOpenCheckInForm={() => {
            if (drawerCinema) openCheckIn(drawerCinema.id);
          }}
        />

        <CheckInModal
          open={checkInOpen && Boolean(checkInCinema)}
          cinemaName={checkInCinema?.nameZh ?? ""}
          onClose={closeCheckIn}
          onConfirm={(note) => {
            if (!checkInCinema) return;
            checkIn(checkInCinema.id, note);
            closeCheckIn();
          }}
        />
      </div>
    </div>
  );
}
