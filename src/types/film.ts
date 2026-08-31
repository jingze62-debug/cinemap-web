/** Festival film catalog types */

export type Screening = {
  id: string;
  filmId: string;
  cinemaId: string;
  hall: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm, may exceed 24 for late-night (e.g. 25:30) */
  start: string;
  end: string;
  price: number;
  techTags: string[];
  /** Social proof: people who scheduled this session */
  scheduledCount?: number;
};

export type Film = {
  id: string;
  titleZh: string;
  titleEn: string;
  year: number;
  countries: string[];
  runtimeMin: number;
  director: string;
  section: string;
  /** CSS gradient stops for poster placeholder */
  posterGradient?: [string, string];
  /** Path under /public, e.g. /posters/films/film_nanguo.jpg */
  poster?: string;
  /** Optional critic scores (Douban/IMDb /10; Letterboxd /5, or /10 which is halved at runtime). */
  ratings?: {
    douban?: number;
    imdb?: number;
    /** Native Letterboxd /5; values > 5 treated as /10 and halved */
    letterboxd?: number;
  };
  screenings: Screening[];
};

export type FilmsDataset = {
  festival: string;
  year: number;
  editionLabel: string;
  sections: string[];
  films: Film[];
};
