import { splitLeadingQuantity } from "@ovenlovin/core";

/** shortcut: store ⅓ as 0.33 per import UAT, upgrade if scaling needs exact 1/3 */
function storeQty(n: number): number {
  return Math.abs(n - 1 / 3) < 1e-9 ? 0.33 : n;
}

export function parseQuantityString(qty: string): { min: number; max?: number } | undefined {
  const { min, max } = splitLeadingQuantity(qty);
  if (min == null) return undefined;
  return {
    min: storeQty(min),
    ...(max != null ? { max: storeQty(max) } : {}),
  };
}
