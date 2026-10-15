import { z } from "zod";
import { normalizeIngredientName } from "../parsing/ingredient-line";

export const shoppingExtraSchema = z.object({
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(255),
});

export const shoppingTripStateSchema = z.object({
  checkedKeys: z.array(z.string().min(1).max(160)).max(500),
  extras: z.array(shoppingExtraSchema).max(100),
});

export type ShoppingExtra = z.infer<typeof shoppingExtraSchema>;
export type ShoppingTripState = z.infer<typeof shoppingTripStateSchema>;

export function emptyShoppingTripState(): ShoppingTripState {
  return { checkedKeys: [], extras: [] };
}

export function shopItemKey(name: string, unit?: string | null): string {
  const base = normalizeIngredientName(name) || name.trim().toLowerCase() || "item";
  const unitPart = unit?.trim().toLowerCase();
  if (!unitPart) return base;
  return `${base}::${unitPart}`;
}

export function parseShoppingTripState(value: unknown): ShoppingTripState {
  const parsed = shoppingTripStateSchema.safeParse(value);
  if (!parsed.success) return emptyShoppingTripState();

  const extras: ShoppingExtra[] = [];
  const extraKeys = new Set<string>();
  for (const extra of parsed.data.extras) {
    const name = extra.name.trim();
    if (!name || extraKeys.has(extra.key)) continue;
    extraKeys.add(extra.key);
    extras.push({ key: extra.key, name });
  }

  const checkedKeys = [...new Set(parsed.data.checkedKeys)];
  return { checkedKeys, extras };
}
