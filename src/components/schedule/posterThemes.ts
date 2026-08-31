export type PosterLayout = "calendar" | "list";

export type PosterThemeId = "cream" | "slate" | "white" | "black" | "pink";

export type PosterTheme = {
  id: PosterThemeId;
  label: string;
  subtitle: string;
  /** Theme picker swatch */
  swatch: string;
  swatchBorder: string;
  bg: string;
  surface: string;
  grid: string;
  gridHeader: string;
  gridCell: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  border: string;
  borderLight: string;
  dashed: string;
  overnight: string;
};

export const POSTER_THEMES: PosterTheme[] = [
  {
    id: "cream",
    label: "经典纸色",
    subtitle: "暖色票据",
    swatch: "#f7f4ed",
    swatchBorder: "#ddd8ce",
    bg: "#f7f4ed",
    surface: "#f7f4ed",
    grid: "#f3efe6",
    gridHeader: "#ebe6db",
    gridCell: "rgba(247,244,237,0.82)",
    ink: "#111111",
    inkMuted: "rgba(17,17,17,0.55)",
    inkFaint: "rgba(17,17,17,0.4)",
    border: "rgba(17,17,17,0.12)",
    borderLight: "rgba(17,17,17,0.08)",
    dashed: "rgba(17,17,17,0.15)",
    overnight: "#c4451a",
  },
  {
    id: "slate",
    label: "灰蓝",
    subtitle: "Aero 气质",
    swatch: "#e8eef5",
    swatchBorder: "#bfcddb",
    bg: "#e8eef5",
    surface: "#e8eef5",
    grid: "#dfe8f2",
    gridHeader: "#d0dce8",
    gridCell: "rgba(232,238,245,0.88)",
    ink: "#1a2433",
    inkMuted: "rgba(26,36,51,0.58)",
    inkFaint: "rgba(26,36,51,0.42)",
    border: "rgba(26,36,51,0.14)",
    borderLight: "rgba(26,36,51,0.09)",
    dashed: "rgba(26,36,51,0.18)",
    overnight: "#2f6fad",
  },
  {
    id: "white",
    label: "极简白",
    subtitle: "干净留白",
    swatch: "#ffffff",
    swatchBorder: "#ececec",
    bg: "#ffffff",
    surface: "#ffffff",
    grid: "#fafafa",
    gridHeader: "#f3f3f3",
    gridCell: "rgba(255,255,255,0.95)",
    ink: "#111111",
    inkMuted: "rgba(17,17,17,0.52)",
    inkFaint: "rgba(17,17,17,0.38)",
    border: "rgba(17,17,17,0.1)",
    borderLight: "rgba(17,17,17,0.06)",
    dashed: "rgba(17,17,17,0.14)",
    overnight: "#d63b12",
  },
  {
    id: "black",
    label: "暗色",
    subtitle: "影院夜场",
    swatch: "#141414",
    swatchBorder: "#333333",
    bg: "#141414",
    surface: "#141414",
    grid: "#1a1a1a",
    gridHeader: "#222222",
    gridCell: "rgba(20,20,20,0.92)",
    ink: "#f0f0f0",
    inkMuted: "rgba(240,240,240,0.62)",
    inkFaint: "rgba(240,240,240,0.45)",
    border: "rgba(255,255,255,0.12)",
    borderLight: "rgba(255,255,255,0.08)",
    dashed: "rgba(255,255,255,0.16)",
    overnight: "#ff6b35",
  },
  {
    id: "pink",
    label: "樱花粉",
    subtitle: "节庆氛围",
    swatch: "#fff0f5",
    swatchBorder: "#f3c6d6",
    bg: "#fff0f5",
    surface: "#fff0f5",
    grid: "#fce8ef",
    gridHeader: "#f5d6e2",
    gridCell: "rgba(255,240,245,0.9)",
    ink: "#3a1226",
    inkMuted: "rgba(58,18,38,0.58)",
    inkFaint: "rgba(58,18,38,0.42)",
    border: "rgba(58,18,38,0.12)",
    borderLight: "rgba(58,18,38,0.08)",
    dashed: "rgba(58,18,38,0.16)",
    overnight: "#e83e8c",
  },
];

export function posterThemeById(id: PosterThemeId): PosterTheme {
  return POSTER_THEMES.find((t) => t.id === id) ?? POSTER_THEMES[0];
}
