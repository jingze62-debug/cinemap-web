/** Multi-plan schedule types */

export type Plan = {
  id: string;
  name: string;
  starred?: boolean;
  /** Ordered by user add time; timeline sorts by start */
  screeningIds: string[];
};

export type PlanStats = {
  filmCount: number;
  totalPrice: number;
  crossDistrictCount: number;
  tightness: "loose" | "ok" | "tight" | "conflict";
  tightnessLabel: string;
};
