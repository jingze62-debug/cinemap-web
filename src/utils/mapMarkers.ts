import L from "leaflet";
import type { Cinema } from "@/types/cinema";

/** Canvas so aura + mist + expanding ripples are not clipped. */
const LIT_HALO_PX = 60;

/** Marker diameter scales with venue heat (0–100). */
function markerSize(heat: number, lit: boolean, active: boolean): number {
  const base = 8 + Math.round((Math.min(100, Math.max(0, heat)) / 100) * 7);
  if (active && lit) return base + 8;
  if (lit) return base + 6;
  if (active) return base + 3;
  return base;
}

function litCoreStyle(size: number, active: boolean): string {
  /* Subtle paper ring only for overlap separation — not a highlight */
  const sep = active
    ? "0 0 0 1.5px color-mix(in srgb,var(--paper) 88%,transparent)"
    : "0 0 0 1.25px color-mix(in srgb,var(--paper) 80%,transparent)";
  return [
    `width:${size}px`,
    `height:${size}px`,
    "border:none",
    "background:var(--lit-core)",
    `box-shadow:${sep}`,
  ].join(";");
}

function litAuraStyle(coreSize: number): string {
  const aura = Math.round(coreSize * 2.8);
  return [
    `width:${aura}px`,
    `height:${aura}px`,
    "border:none",
    "background:radial-gradient(circle,color-mix(in srgb,var(--lit-core) 42%,transparent) 0%,color-mix(in srgb,var(--lit-core) 22%,transparent) 48%,transparent 72%)",
  ].join(";");
}

function markerHtml(opts: {
  heat: number;
  lit: boolean;
  active: boolean;
  nudgeX?: number;
  nudgeY?: number;
}): string {
  const { heat, lit, active, nudgeX = 0, nudgeY = 0 } = opts;
  const size = markerSize(heat, lit, active);
  const nudge =
    nudgeX || nudgeY
      ? `transform:translate(${nudgeX}px,${nudgeY}px);`
      : "";

  if (lit) {
    const wrap = size + LIT_HALO_PX * 2;
    const activeClass = active ? " cinemap-marker-lit-wrap--active" : "";
    return `<span class="cinemap-marker-lit-wrap${activeClass}" style="width:${wrap}px;height:${wrap}px;${nudge}">
      <span class="cinemap-marker-lit-mist" aria-hidden="true"></span>
      <span class="cinemap-marker-lit-ripple" aria-hidden="true"></span>
      <span class="cinemap-marker-lit-ripple cinemap-marker-lit-ripple--b" aria-hidden="true"></span>
      <span class="cinemap-marker-lit-ripple cinemap-marker-lit-ripple--c" aria-hidden="true"></span>
      <span class="cinemap-marker-lit-aura" style="${litAuraStyle(size)}" aria-hidden="true"></span>
      <span class="cinemap-marker-lit-core" style="${litCoreStyle(size, active)}"></span>
    </span>`;
  }

  const pad = 6;
  const wrap = size + pad * 2;
  const activeClass = active ? " cinemap-marker-dim-wrap--active" : "";
  return `<span class="cinemap-marker-dim-wrap${activeClass}" style="width:${wrap}px;height:${wrap}px;${nudge}">
    <span class="cinemap-marker-dim" style="width:${size}px;height:${size}px;"></span>
  </span>`;
}

function iconDimensions(opts: {
  heat: number;
  lit: boolean;
  active: boolean;
}): { size: number; anchor: number } {
  const core = markerSize(opts.heat, opts.lit, opts.active);
  if (opts.lit) {
    const wrap = core + LIT_HALO_PX * 2;
    return { size: wrap, anchor: wrap / 2 };
  }
  const pad = 6;
  const wrap = core + pad * 2;
  return { size: wrap, anchor: wrap / 2 };
}

export function cinemaMarkerIcon(opts: {
  heat: number;
  lit: boolean;
  active: boolean;
  nudgeX?: number;
  nudgeY?: number;
}): L.DivIcon {
  const { size, anchor } = iconDimensions(opts);
  return L.divIcon({
    className: "cinemap-marker",
    html: markerHtml(opts),
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
}

/**
 * Fan out markers that share nearly the same coordinates so overlapping
 * venues stay readable as separate dots.
 */
export function computeMarkerNudges(
  cinemas: Cinema[]
): Map<string, { x: number; y: number }> {
  const groups = new Map<string, Cinema[]>();
  for (const c of cinemas) {
    const key = `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  }

  const out = new Map<string, { x: number; y: number }>();
  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue;
    const n = group.length;
    const radius = 12 + Math.min(n, 5) * 3;
    group.forEach((c, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      out.set(c.id, {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
      });
    });
  }
  return out;
}
