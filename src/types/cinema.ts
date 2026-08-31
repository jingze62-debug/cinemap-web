/** Cinema / venue types */

export type CinemaTipKind = "temp" | "exit" | "seat" | "note" | "supply";

export type CinemaTip = {
  kind: CinemaTipKind;
  label?: string;
  text: string;
};

export type CinemaSupply = {
  kind: "coffee" | "metro" | "other";
  text: string;
};

export type Cinema = {
  id: string;
  nameZh: string;
  nameEn?: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  screeningCount: number;
  todayCount?: number;
  heat?: number;
  blurb?: string;
  /** Optional exterior / facade image under /public */
  image?: string;
  tips: CinemaTip[];
  supplies?: CinemaSupply[];
};

export type CinemasDataset = Cinema[];
