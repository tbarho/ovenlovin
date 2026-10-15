import { formatQuantity } from "@ovenlovin/core/scaling";

/** Kitchen-facing amount: cooking fractions, never 0.33. */
export function formatShopQuantity(quantity?: number, unit?: string): string | null {
  if (quantity == null || !Number.isFinite(quantity)) return null;
  const amount = formatQuantity(quantity);
  return unit ? `${amount} ${unit}` : amount;
}
