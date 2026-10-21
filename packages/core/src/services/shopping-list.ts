import { backfillParsedIngredient, normalizeIngredientName } from "../parsing/ingredient-line";
import type { MealPlanEntry } from "../schemas/plans";
import { shopItemKey, type ShoppingExtra } from "../schemas/shopping-trip";
import type { DefaultServingsMode } from "../schemas/households";
import {
  cookForPeopleLabel,
  effectivePlanServings,
  planListScale,
} from "../scaling/default-servings";
import {
  formatMeasureText,
  formatQuantity,
  inflectedUnit,
  isCountableShopItem,
  scaleFactorForPlanEntry,
  toFriendlyMeasure,
  wholeShopQuantity,
} from "../scaling/servings";
import {
  assignAisle,
  categorySectionName,
  isPantryStaple,
  type ShoppingListCategory,
} from "./shopping-aisles";

export {
  DEFAULT_RECIPE_SERVINGS,
  scaleFactorForPlanEntry as servingsScale,
} from "../scaling/servings";

export type ShoppingListGroupBy = "aisle" | "recipe" | "category";

export interface ShoppingListRecipeRef {
  recipeId: string;
  recipeTitle: string;
  quantity?: number;
  unit?: string;
}

export interface ShoppingListIngredient {
  /** Stable check-off id shared by the kitchen list and MCP/REST export. */
  key: string;
  /** Set when formatting a trip that already has check-offs. */
  checked?: boolean;
  name: string;
  quantity?: number;
  unit?: string;
  /** Cooking-fraction amount for UI / REST / MCP text. Raw `quantity` stays numeric. */
  displayQuantity?: string;
  /** Unit chosen for display (may differ from `unit` when a neighbor is shoppable). */
  displayUnit?: string;
  aisle: string;
  category: ShoppingListCategory;
  /** Kitchen staple (salt, oil, pepper) - not the pantry food-taxonomy category. */
  isStaple: boolean;
  /** @deprecated Alias of {@link ShoppingListIngredient.isStaple}. */
  isPantryItem: boolean;
  recipes: ShoppingListRecipeRef[];
}

export interface ShoppingListSection {
  name: string;
  items: ShoppingListIngredient[];
}

export interface ShoppingListWarning {
  ingredient: string;
  personName: string;
  note: string;
}

export interface ShoppingListData {
  mealPlanId: string;
  weekStart: string;
  groupBy: ShoppingListGroupBy;
  /** Kitchen staples (salt, oil, pepper) - not the pantry food-taxonomy category. */
  includeStaples: boolean;
  /** @deprecated Alias of {@link ShoppingListData.includeStaples} for existing clients. */
  includePantryItems: boolean;
  ingredients: ShoppingListIngredient[];
  sections: ShoppingListSection[];
  itemCount: number;
  generatedAt: string;
  warnings: ShoppingListWarning[];
  /** Week cook-for shown as "For N people". */
  scaledFor?: number;
  /** True when some plan entries cook at a different count than `scaledFor`. */
  scaledForMixed?: boolean;
}

export interface ShoppingListLineInput {
  rawText: string;
  name?: string | null;
  quantity?: number | null;
  quantityMin?: number | null;
  unit?: string | null;
  ingredientId?: string | null;
}

export interface ShoppingListEntryInput {
  entry: Pick<MealPlanEntry, "recipeId" | "servings" | "scaleFactor">;
  recipeTitle?: string;
  recipeServings?: number | null;
  ingredients: ShoppingListLineInput[];
}

export interface BuildShoppingListInput {
  mealPlanId: string;
  weekStart: string;
  entries: ShoppingListEntryInput[];
  groupBy?: ShoppingListGroupBy;
  includeStaples?: boolean;
  /** @deprecated Alias of {@link BuildShoppingListInput.includeStaples}. */
  includePantryItems?: boolean;
  warnings?: ShoppingListWarning[];
  generatedAt?: string;
  /** Household Default servings cook-for when a plan entry has no servings. */
  defaultCookFor?: number | null;
  mode?: DefaultServingsMode;
}

/** Section name for salt/oil when staples are included - distinct from category "Pantry". */
export const KITCHEN_STAPLES_SECTION = "Kitchen staples";

/**
 * Canonical flag is `includeStaples`. `includePantryItems` is kept as an input
 * alias so REST/MCP clients that still send the old name keep working.
 */
export function resolveIncludeStaples(input: {
  includeStaples?: boolean;
  includePantryItems?: boolean;
}): boolean {
  if (input.includeStaples != null) return input.includeStaples;
  if (input.includePantryItems != null) return input.includePantryItems;
  return false;
}

type UnitDimension = "volume" | "weight";

const UNIT_TO_BASE: Record<string, { dimension: UnitDimension; toBase: number }> = {
  tsp: { dimension: "volume", toBase: 1 },
  tbsp: { dimension: "volume", toBase: 3 },
  cup: { dimension: "volume", toBase: 48 },
  pt: { dimension: "volume", toBase: 96 },
  qt: { dimension: "volume", toBase: 192 },
  gal: { dimension: "volume", toBase: 768 },
  ml: { dimension: "volume", toBase: 48 / 236.5882365 },
  l: { dimension: "volume", toBase: 48 / 0.2365882365 },
  g: { dimension: "weight", toBase: 1 },
  kg: { dimension: "weight", toBase: 1000 },
  oz: { dimension: "weight", toBase: 28.349523125 },
  lb: { dimension: "weight", toBase: 453.59237 },
};

function roundQuantity(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function addQuantities(
  left: { quantity?: number; unit?: string },
  right: { quantity: number; unit?: string }
): { quantity: number; unit?: string } | null {
  if (left.quantity == null) {
    return { quantity: right.quantity, unit: right.unit };
  }
  const leftUnit = left.unit;
  const rightUnit = right.unit;
  if (!leftUnit && !rightUnit) {
    return { quantity: left.quantity + right.quantity };
  }
  if (leftUnit && rightUnit && leftUnit === rightUnit) {
    return { quantity: left.quantity + right.quantity, unit: leftUnit };
  }
  if (!leftUnit || !rightUnit) return null;

  const leftMeta = UNIT_TO_BASE[leftUnit];
  const rightMeta = UNIT_TO_BASE[rightUnit];
  if (!leftMeta || !rightMeta || leftMeta.dimension !== rightMeta.dimension) {
    return null;
  }

  const base = left.quantity * leftMeta.toBase + right.quantity * rightMeta.toBase;
  const larger = leftMeta.toBase >= rightMeta.toBase ? leftUnit : rightUnit;
  const largerMeta = UNIT_TO_BASE[larger];
  if (largerMeta && base >= largerMeta.toBase) {
    return { quantity: base / largerMeta.toBase, unit: larger };
  }
  const smaller = larger === leftUnit ? rightUnit : leftUnit;
  return { quantity: base / UNIT_TO_BASE[smaller]!.toBase, unit: smaller };
}

function mergeKey(name: string, unit: string | undefined, recipeKey: string): string {
  const normalized = normalizeIngredientName(name);
  const meta = unit ? UNIT_TO_BASE[unit] : undefined;
  const unitGroup = meta ? meta.dimension : (unit ?? "count");
  return `${recipeKey}|${normalized}|${unitGroup}`;
}

function sectionForItem(
  item: ShoppingListIngredient,
  groupBy: ShoppingListGroupBy,
  includeStaples: boolean
): string {
  if (groupBy === "recipe") {
    return item.recipes[0]?.recipeTitle ?? "Other";
  }
  if (includeStaples && item.isStaple) {
    return KITCHEN_STAPLES_SECTION;
  }
  if (groupBy === "category") {
    return categorySectionName(item.category);
  }
  return item.aisle;
}

function groupSections(
  items: ShoppingListIngredient[],
  groupBy: ShoppingListGroupBy,
  includeStaples: boolean
): ShoppingListSection[] {
  const sections = new Map<string, ShoppingListIngredient[]>();
  for (const item of items) {
    const name = sectionForItem(item, groupBy, includeStaples);
    const list = sections.get(name) ?? [];
    list.push(item);
    sections.set(name, list);
  }
  return [...sections.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, sectionItems]) => ({ name, items: sectionItems }));
}

/* eslint-disable no-unused-vars -- call-signature parameter names */
type RecipeLoader = (
  recipeId: string
) => Promise<{ title: string; servings?: number | null } | null>;
type IngredientLoader = (recipeId: string) => Promise<ShoppingListLineInput[]>;
/* eslint-enable no-unused-vars */

export async function collectShoppingListEntries(
  entries: MealPlanEntry[],
  deps: {
    getRecipe: RecipeLoader;
    getIngredients: IngredientLoader;
  }
): Promise<ShoppingListEntryInput[]> {
  return Promise.all(
    entries.map(async (entry) => {
      if (!entry.recipeId) {
        return {
          entry,
          recipeTitle: entry.freeformMeal ?? undefined,
          recipeServings: null,
          ingredients: [],
        };
      }
      const [recipe, ingredients] = await Promise.all([
        deps.getRecipe(entry.recipeId),
        deps.getIngredients(entry.recipeId),
      ]);
      return {
        entry,
        recipeTitle: recipe?.title ?? entry.freeformMeal ?? undefined,
        recipeServings: recipe?.servings ?? null,
        ingredients,
      };
    })
  );
}

export class ShoppingListService {
  build(input: BuildShoppingListInput): ShoppingListData {
    const groupBy = input.groupBy ?? "aisle";
    const includeStaples = resolveIncludeStaples(input);
    const ingredientMap = new Map<string, ShoppingListIngredient>();

    for (const source of input.entries) {
      const scale = scaleFactorForPlanEntry(
        source.entry.servings,
        source.recipeServings,
        source.entry.scaleFactor,
        input.defaultCookFor,
        input.mode
      );
      const recipeId = source.entry.recipeId ?? "";
      const recipeTitle = source.recipeTitle || "Unknown Recipe";
      const recipeKey = groupBy === "recipe" ? recipeId : "";

      for (const line of source.ingredients) {
        const parsed = backfillParsedIngredient({
          rawText: line.rawText,
          name: line.name,
          quantityMin: line.quantityMin ?? line.quantity ?? null,
          unit: line.unit ?? null,
        });
        if (!parsed.name) continue;

        const placement = assignAisle(parsed.name);
        const itemName = placement.canonicalName;
        const scaledQuantity = parsed.quantityMin != null ? parsed.quantityMin * scale : undefined;
        const unit = parsed.unit ?? undefined;
        const key = mergeKey(itemName, unit, recipeKey);
        const pantry = isPantryStaple(parsed.name);

        const recipeRef: ShoppingListRecipeRef = {
          recipeId,
          recipeTitle,
          quantity: scaledQuantity,
          unit,
        };

        const existing = ingredientMap.get(key);
        if (!existing) {
          ingredientMap.set(key, {
            key: shopItemKey(itemName, unit),
            name: itemName,
            quantity: scaledQuantity,
            unit,
            aisle: placement.aisle,
            category: placement.category,
            isStaple: pantry,
            isPantryItem: pantry,
            recipes: [recipeRef],
          });
          continue;
        }

        existing.recipes.push(recipeRef);
        if (scaledQuantity != null) {
          const merged = addQuantities(existing, { quantity: scaledQuantity, unit });
          if (merged) {
            existing.quantity = merged.quantity;
            existing.unit = merged.unit;
          }
        }
      }
    }

    const ingredients = Array.from(ingredientMap.values())
      .filter((item) => includeStaples || !item.isStaple)
      .map((item) => {
        const rawQuantity = item.quantity != null ? roundQuantity(item.quantity) : undefined;
        const quantity =
          rawQuantity != null && isCountableShopItem(item.unit)
            ? wholeShopQuantity(rawQuantity)
            : rawQuantity;
        const display = quantity != null ? toFriendlyMeasure(quantity, item.unit, true) : undefined;
        const displayQuantity = display?.displayQuantity;
        const displayUnit =
          displayQuantity && display.displayUnit
            ? inflectedUnit(displayQuantity, display.displayUnit)
            : display?.displayUnit;
        return {
          ...item,
          key: shopItemKey(item.name, item.unit),
          quantity,
          displayQuantity,
          displayUnit,
          checked: item.checked ?? false,
          isStaple: item.isStaple,
          isPantryItem: item.isStaple,
          recipes: item.recipes.map((recipe) => ({
            ...recipe,
            quantity: recipe.quantity != null ? roundQuantity(recipe.quantity) : undefined,
          })),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const entryScales = input.entries
      .filter((source) => source.entry.recipeId)
      .map((source) =>
        effectivePlanServings({
          entryServings: source.entry.servings,
          defaultCookFor: input.defaultCookFor ?? 0,
          mode: input.mode,
          recipeServings: source.recipeServings,
          scaleFactor: source.entry.scaleFactor,
        })
      );
    const listScale = planListScale(entryScales, input.defaultCookFor ?? 0);
    const hasCookFor = Boolean(input.defaultCookFor && input.defaultCookFor > 0);

    return {
      mealPlanId: input.mealPlanId,
      weekStart: input.weekStart,
      groupBy,
      includeStaples,
      includePantryItems: includeStaples,
      ingredients,
      sections: groupSections(ingredients, groupBy, includeStaples),
      itemCount: ingredients.length,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      warnings: input.warnings ?? [],
      scaledFor: entryScales.length > 0 || hasCookFor ? listScale.scaledFor : undefined,
      scaledForMixed: listScale.mixed,
    };
  }

  /**
   * @deprecated Prefer {@link build}. Kept for kitchen UI callers that still
   * pass the older entry shape. Includes kitchen staples so the UI does not
   * silently drop salt/oil.
   */
  aggregateIngredients(
    entries: Array<{
      entry: MealPlanEntry;
      recipeTitle?: string;
      recipeServings?: number | null;
      ingredients: Array<{
        name: string;
        rawText: string;
        quantity?: number;
        unit?: string;
        ingredientId?: string;
      }>;
    }>,
    defaultCookFor?: number | null,
    mode?: DefaultServingsMode
  ): ShoppingListIngredient[] {
    return this.build({
      mealPlanId: "",
      weekStart: "",
      includeStaples: true,
      defaultCookFor,
      mode,
      entries: entries.map((source) => ({
        entry: source.entry,
        recipeTitle: source.recipeTitle,
        recipeServings: source.recipeServings,
        ingredients: source.ingredients.map((ingredient) => ({
          rawText: ingredient.rawText || ingredient.name,
          name: ingredient.name,
          quantityMin: ingredient.quantity,
          unit: ingredient.unit,
          ingredientId: ingredient.ingredientId,
        })),
      })),
    }).ingredients;
  }

  format(
    data: ShoppingListData,
    format: "json" | "csv" | "markdown" | "text",
    options: ShoppingListFormatOptions = {}
  ): string {
    const marked =
      options.checkedKeys != null || options.extras != null
        ? applyShoppingTrip(data, {
            checkedKeys: options.checkedKeys ?? [],
            extras: options.extras ?? [],
          })
        : data;
    switch (format) {
      case "csv":
        return this.exportAsCSV(marked);
      case "markdown":
        return this.exportAsMarkdown(marked, options);
      case "text":
        return this.exportAsText(marked, options);
      case "json":
      default:
        return this.exportAsJSON(marked);
    }
  }

  exportAsJSON(data: ShoppingListData): string {
    return JSON.stringify(data, null, 2);
  }

  exportAsCSV(data: ShoppingListData): string {
    const lines = [
      "Name,Quantity,Unit,Aisle,Category,Recipes,Checked",
      ...data.ingredients.map((ing) => {
        const recipes = ing.recipes.map((r) => r.recipeTitle).join("; ");
        const quantity =
          ing.displayQuantity ?? (ing.quantity != null ? formatQuantity(ing.quantity) : "");
        const unit = ing.displayUnit ?? ing.unit ?? "";
        const checked = ing.checked ? "yes" : "";
        return `"${ing.name}","${quantity}","${unit}","${ing.aisle}","${ing.category}","${recipes}","${checked}"`;
      }),
    ];
    return lines.join("\n");
  }

  exportAsMarkdown(data: ShoppingListData, options: ShoppingListExportOptions = {}): string {
    const lines = [
      `# Shopping List`,
      ``,
      `**Week Starting:** ${data.weekStart}`,
      `**Generated:** ${formatShoppingListGeneratedAt(data.generatedAt, options.timeZone)}`,
      ...(data.scaledFor
        ? [``, `**${cookForPeopleLabel(data.scaledFor, data.scaledForMixed)}**`]
        : []),
      ``,
    ];

    for (const section of data.sections) {
      lines.push(`## ${section.name}`, ``);
      for (const ing of section.items) {
        const mark = ing.checked ? "x" : " ";
        lines.push(`- [${mark}] ${formatItemLine(ing)}`);
      }
      lines.push(``);
    }

    if (data.warnings.length > 0) {
      lines.push(`## ⚠️ Warnings`, ``);
      for (const warning of data.warnings) {
        lines.push(`- **${warning.personName}**: ${warning.ingredient} - ${warning.note}`);
      }
      lines.push(``);
    }

    return lines.join("\n").trimEnd() + "\n";
  }

  exportAsText(data: ShoppingListData, options: ShoppingListExportOptions = {}): string {
    const lines = [
      `Shopping List`,
      `=============`,
      ``,
      `Week Starting: ${data.weekStart}`,
      `Generated: ${formatShoppingListGeneratedAt(data.generatedAt, options.timeZone)}`,
      ...(data.scaledFor ? [``, cookForPeopleLabel(data.scaledFor, data.scaledForMixed)] : []),
      ``,
    ];

    for (const section of data.sections) {
      lines.push(`${section.name}:`, ``);
      for (const ing of section.items) {
        const recipesPart = ing.recipes.map((r) => r.recipeTitle).join(", ");
        const mark = ing.checked ? "[x]" : "[ ]";
        lines.push(`- ${mark} ${formatItemLine(ing, false)}`);
        if (recipesPart) lines.push(`  Used in: ${recipesPart}`);
      }
      lines.push(``);
    }

    if (data.warnings.length > 0) {
      lines.push(`WARNINGS:`);
      for (const warning of data.warnings) {
        lines.push(`⚠️  ${warning.personName}: ${warning.ingredient} - ${warning.note}`);
      }
    }

    return lines.join("\n").trimEnd() + "\n";
  }
}

export type ShoppingListExportOptions = {
  timeZone?: string;
};

export type ShoppingListFormatOptions = ShoppingListExportOptions & {
  checkedKeys?: string[];
  extras?: ShoppingExtra[];
};

export function parseIanaTimeZone(value: string): string | null {
  const tz = value.trim();
  if (!tz) return null;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date(0));
    return tz;
  } catch {
    return null;
  }
}

export function resolveIanaTimeZone(value?: string | null): string {
  const explicit = value ? parseIanaTimeZone(value) : null;
  if (explicit) return explicit;
  return parseIanaTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? "UTC";
}

export function formatShoppingListGeneratedAt(iso: string, timeZone?: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const tz = resolveIanaTimeZone(timeZone);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  }).format(date);
}

function extraToIngredient(extra: ShoppingExtra): ShoppingListIngredient {
  const placement = assignAisle(extra.name);
  return {
    key: extra.key,
    name: extra.name,
    aisle: placement.aisle,
    category: placement.category,
    checked: false,
    isStaple: false,
    isPantryItem: false,
    recipes: [],
  };
}

/** Merge saved check-offs and extras into a built list for REST, MCP, and markdown. */
export function applyShoppingTrip(
  data: ShoppingListData,
  trip: { checkedKeys?: string[]; extras?: ShoppingExtra[] } = {}
): ShoppingListData {
  const existingKeys = new Set(data.ingredients.map((item) => item.key));
  const extras = (trip.extras ?? [])
    .filter((extra) => extra.name.trim() && !existingKeys.has(extra.key))
    .map(extraToIngredient);
  const combined = [...data.ingredients, ...extras];
  const checked = new Set(trip.checkedKeys ?? []);
  const mark = <T extends ShoppingListIngredient>(item: T): T => ({
    ...item,
    checked: checked.has(item.key),
  });
  const ingredients = combined.map(mark).sort((a, b) => a.name.localeCompare(b.name));
  return {
    ...data,
    ingredients,
    sections: groupSections(ingredients, data.groupBy, data.includeStaples),
    itemCount: ingredients.length,
  };
}

function shopItemName(ing: ShoppingListIngredient): string {
  if (ing.name !== "egg" && ing.name !== "eggs") return ing.name;
  if (ing.quantity == null) return ing.name;
  return ing.quantity === 1 ? "egg" : "eggs";
}

function formatItemLine(ing: ShoppingListIngredient, includeRecipes = true): string {
  const quantityPart =
    ing.quantity != null ? `${formatMeasureText(ing.quantity, ing.unit, true)} ` : "";
  const recipes = includeRecipes
    ? ` (${ing.recipes
        .map((r) => r.recipeTitle)
        .filter(Boolean)
        .join(", ")})`
    : "";
  return `${quantityPart}${shopItemName(ing)}${recipes}`.replace(/\s+/g, " ").trim();
}
