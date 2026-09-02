/** Positive ticket price for UI; null means “以现场为准”. */
export function formatTicketPrice(price: unknown): string | null {
  const n = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `¥${Math.round(n)}`;
}

export function hasTicketPrice(price: unknown): boolean {
  return formatTicketPrice(price) !== null;
}
