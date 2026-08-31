"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  ZoomControl,
} from "react-leaflet";
import { DomEvent } from "leaflet";
import type { Cinema } from "@/types/cinema";
import { useThemeStore } from "@/hooks/useThemeStore";
import { cinemaMarkerIcon, computeMarkerNudges } from "@/utils/mapMarkers";
import "leaflet/dist/leaflet.css";

type LeafletMapProps = {
  cinemas: Cinema[];
  /** List-selected cinema (accent) */
  selectedId: string | null;
  /** Camera fly / temporary highlight */
  focusId: string | null;
  /** User has checked in / lit this venue */
  checkedInIds: ReadonlySet<string>;
  onMarkerClick: (id: string) => void;
  /** Empty map tap (not a marker) */
  onBlankClick?: () => void;
};

const CITY_CENTER: [number, number] = [31.22, 121.45];
const CITY_ZOOM = 12;
const VENUE_ZOOM = 14;

function MapBlankClick({ onBlankClick }: { onBlankClick?: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onBlankClick) return;
    const onClick = () => onBlankClick();
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map, onBlankClick]);
  return null;
}

/** City overview by default; zoom in only when a venue is selected from the list. */
function MapCamera({ selected }: { selected: Cinema | null }) {
  const map = useMap();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (selected) {
        map.flyTo([selected.lat, selected.lng], VENUE_ZOOM, { duration: 0.7 });
      }
      return;
    }

    if (selected) {
      map.flyTo([selected.lat, selected.lng], VENUE_ZOOM, { duration: 0.7 });
    } else {
      map.flyTo(CITY_CENTER, CITY_ZOOM, { duration: 0.7 });
    }
  }, [selected, map]);

  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);
  return null;
}

export function LeafletMap({
  cinemas,
  selectedId,
  focusId,
  checkedInIds,
  onMarkerClick,
  onBlankClick,
}: LeafletMapProps) {
  const theme = useThemeStore((s) => s.theme);
  const selected = cinemas.find((c) => c.id === selectedId) ?? null;
  const nudges = useMemo(() => computeMarkerNudges(cinemas), [cinemas]);

  /** Which marker sits on top of overlaps — last interacted wins */
  const [topId, setTopId] = useState<string | null>(null);

  useEffect(() => {
    const id = focusId ?? selectedId;
    if (id) setTopId(id);
  }, [focusId, selectedId]);

  return (
    <MapContainer
      center={CITY_CENTER}
      zoom={CITY_ZOOM}
      minZoom={10}
      maxZoom={18}
      className="h-full w-full rounded-2xl bg-map-bg"
      zoomControl={false}
      attributionControl
      scrollWheelZoom
      doubleClickZoom
      touchZoom
      boxZoom
      dragging
      keyboard
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
        maxZoom={16}
      />
      <ZoomControl position="bottomright" />
      <InvalidateSize />
      <MapBlankClick onBlankClick={onBlankClick} />
      <MapCamera selected={selected} />
      {cinemas.map((c) => {
        const active = c.id === selectedId || c.id === focusId;
        const lit = checkedInIds.has(c.id);
        const onTop = c.id === topId;
        const nudge = nudges.get(c.id);
        return (
          <Marker
            key={`${c.id}-${lit ? "lit" : "dim"}-${theme}-${nudge?.x ?? 0}-${nudge?.y ?? 0}`}
            position={[c.lat, c.lng]}
            zIndexOffset={onTop ? 5000 : lit ? 1000 : active ? 800 : 0}
            icon={cinemaMarkerIcon({
              heat: c.heat ?? 50,
              lit,
              active,
              nudgeX: nudge?.x,
              nudgeY: nudge?.y,
            })}
            eventHandlers={{
              click: (e) => {
                DomEvent.stopPropagation(e.originalEvent);
                const target = e.target as {
                  bringToFront?: () => void;
                };
                target.bringToFront?.();
                setTopId(c.id);
                onMarkerClick(c.id);
              },
            }}
          >
            <Popup>
              <span className="text-sm font-medium text-ink">
                {lit ? "✦ " : ""}
                {c.nameZh}
                {lit ? " · 已点亮" : ""}
              </span>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
