import { backfillParsedIngredient, normalizeIngredientName } from "../parsing/ingredient-line";
import type { IngredientCategory } from "../schemas/ingredients";
import type { MealPlanEntry } from "../schemas/plans";
import { assignAisle, categorySectionName, isPantryStaple } from "./shopping-aisles";

export type ShoppingListGroupBy = "aisle" | "recipe" | "category";

export interface ShoppingListRecipeRef {
  recipeId: string;
  recipeTitle: string;
  quantity?: number;
  unit?: string;
}

export interface ShoppingListIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  aisle: string;
  category: IngredientCategory;
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
  includePantryItems: boolean;
  ingredients: ShoppingListIngredient[];
  sections: ShoppingListSection[];
  itemCount: number;
  generatedAt: string;
  warnings: ShoppingListWarning[];
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
  includePantryItems?: boolean;
  warnings?: ShoppingListWarning[];
  generatedAt?: string;
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

/**
 * REST `replaceMealPlanEntries` always persists `scaleFactor: 1`. Scale from
 * the plan entry's servings versus the recipe card. Imported recipes often
 * have a null yield — treat those as a 4-serving card so REST servings still
 * change the list.
 */
export const DEFAULT_RECIPE_SERVINGS = 4;

export function servingsScale(
  entryServings?: number | null,
  recipeServings?: number | null,
  scaleFactor?: number | null
): number {
  if (entryServings && entryServings > 0) {
    const base = recipeServings && recipeServings > 0 ? recipeServings : DEFAULT_RECIPE_SERVINGS;
    return entryServings / base;
  }
  if (scaleFactor && scaleFactor > 0) return scaleFactor;
  return 1;
}

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
  includePantryItems: boolean
): string {
  if (groupBy === "recipe") {
    return item.recipes[0]?.recipeTitle ?? "Other";
  }
  if (includePantryItems && item.isPantryItem) {
    return "Pantry staples";
  }
  if (groupBy === "category") {
    return categorySectionName(item.category);
  }
  return item.aisle;
}

function groupSections(
  items: ShoppingListIngredient[],
  groupBy: ShoppingListGroupBy,
  includePantryItems: boolean
): ShoppingListSection[] {
  const sections = new Map<string, ShoppingListIngredient[]>();
  for (const item of items) {
    const name = sectionForItem(item, groupBy, includePantryItems);
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
    const includePantryItems = input.includePantryItems ?? false;
    const ingredientMap = new Map<string, ShoppingListIngredient>();

    for (const source of input.entries) {
      const scale = servingsScale(
        source.entry.servings,
        source.recipeServings,
        source.entry.scaleFactor
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

        const scaledQuantity = parsed.quantityMin != null ? parsed.quantityMin * scale : undefined;
        const unit = parsed.unit ?? undefined;
        const key = mergeKey(parsed.name, unit, recipeKey);
        const placement = assignAisle(parsed.name);
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
            name: parsed.name,
            quantity: scaledQuantity,
            unit,
            aisle: placement.aisle,
            category: placement.category,
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
      .filter((item) => includePantryItems || !item.isPantryItem)
      .map((item) => ({
        ...item,
        quantity: item.quantity != null ? roundQuantity(item.quantity) : undefined,
        recipes: item.recipes.map((recipe) => ({
          ...recipe,
          quantity: recipe.quantity != null ? roundQuantity(recipe.quantity) : undefined,
        })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      mealPlanId: input.mealPlanId,
      weekStart: input.weekStart,
      groupBy,
      includePantryItems,
      ingredients,
      sections: groupSections(ingredients, groupBy, includePantryItems),
      itemCount: ingredients.length,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      warnings: input.warnings ?? [],
    };
  }

  /**
   * @deprecated Prefer {@link build}. Kept for kitchen UI callers that still
   * pass the older entry shape. Includes pantry staples so the UI does not
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
    }>
  ): ShoppingListIngredient[] {
    return this.build({
      mealPlanId: "",
      weekStart: "",
      includePantryItems: true,
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

  format(data: ShoppingListData, format: "json" | "csv" | "markdown" | "text"): string {
    switch (format) {
      case "csv":
        return this.exportAsCSV(data);
      case "markdown":
        return this.exportAsMarkdown(data);
      case "text":
        return this.exportAsText(data);
      case "json":
      default:
        return this.exportAsJSON(data);
    }
  }

  exportAsJSON(data: ShoppingListData): string {
    return JSON.stringify(data, null, 2);
  }

  exportAsCSV(data: ShoppingListData): string {
    const lines = [
      "Name,Quantity,Unit,Aisle,Category,Recipes",
      ...data.ingredients.map((ing) => {
        const recipes = ing.recipes.map((r) => r.recipeTitle).join("; ");
        const quantity = ing.quantity != null ? String(ing.quantity) : "";
        const unit = ing.unit || "";
        return `"${ing.name}","${quantity}","${unit}","${ing.aisle}","${ing.category}","${recipes}"`;
      }),
    ];
    return lines.join("\n");
  }

  exportAsMarkdown(data: ShoppingListData): string {
    const lines = [
      `# Shopping List`,
      ``,
      `**Week Starting:** ${data.weekStart}`,
      `**Generated:** ${new Date(data.generatedAt).toLocaleString()}`,
      ``,
    ];

    for (const section of data.sections) {
      lines.push(`## ${section.name}`, ``);
      for (const ing of section.items) {
        lines.push(`- ${formatItemLine(ing)}`);
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

  exportAsText(data: ShoppingListData): string {
    const lines = [
      `Shopping List`,
      `=============`,
      ``,
      `Week Starting: ${data.weekStart}`,
      `Generated: ${new Date(data.generatedAt).toLocaleString()}`,
      ``,
    ];

    for (const section of data.sections) {
      lines.push(`${section.name}:`, ``);
      for (const ing of section.items) {
        const recipesPart = ing.recipes.map((r) => r.recipeTitle).join(", ");
        lines.push(`- ${formatItemLine(ing, false)}`);
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

function formatItemLine(ing: ShoppingListIngredient, includeRecipes = true): string {
  const quantityPart =
    ing.quantity != null ? `${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""} ` : "";
  const recipes = includeRecipes
    ? ` (${ing.recipes
        .map((r) => r.recipeTitle)
        .filter(Boolean)
        .join(", ")})`
    : "";
  return `${quantityPart}${ing.name}${recipes}`.replace(/\s+/g, " ").trim();
}
