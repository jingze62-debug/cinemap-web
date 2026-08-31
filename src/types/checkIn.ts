/** Manual cinema check-in types */

export type CheckIn = {
  cinemaId: string;
  /** ISO timestamp */
  checkedAt: string;
  note?: string;
};
