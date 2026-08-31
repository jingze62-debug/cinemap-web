export type FestivalEntry = {
  id: string;
  title: string;
  description: string;
  dateRange: string;
  available: boolean;
  /** Visual theme key for card art */
  art: "siff" | "bjiff" | "hkiff" | "soon";
  editionLabel?: string;
  /** Path under /public, e.g. /posters/siff_2026.svg */
  poster?: string;
};

export type FestivalsDataset = {
  festivals: FestivalEntry[];
};
