export type FestivalEntry = {
  id: string;
  title: string;
  description: string;
  dateRange: string;
  available: boolean;
  /** Visual theme key for card art */
  art: "siff" | "bjiff" | "hkiff" | "indie" | "soon";
  editionLabel?: string;
  /** Path under /public, e.g. /posters/siff_2026.svg */
  poster?: string;
  /** Film catalog JSON under /public, e.g. /data/siff_2026_films.json */
  filmsPath?: string;
  /** YYYY-MM-DD — used for picker sorting */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
};

export type FestivalsDataset = {
  festivals: FestivalEntry[];
};
