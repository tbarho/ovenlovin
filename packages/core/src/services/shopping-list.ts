import type { MealPlanEntry } from "../schemas/plans";

export interface ShoppingListIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  recipes: Array<{
    recipeId: string;
    recipeTitle: string;
    quantity?: number;
    unit?: string;
  }>;
}

export interface ShoppingListData {
  mealPlanId: string;
  weekStart: string;
  ingredients: ShoppingListIngredient[];
  generatedAt: string;
}

export class ShoppingListService {
  aggregateIngredients(
    entries: Array<{
      entry: MealPlanEntry;
      recipeTitle?: string;
      ingredients: Array<{
        name: string;
        rawText: string;
        quantity?: number;
        unit?: string;
        ingredientId?: string;
      }>;
    }>
  ): ShoppingListIngredient[] {
    const ingredientMap = new Map<string, ShoppingListIngredient>();

    for (const { entry, recipeTitle, ingredients } of entries) {
      for (const ingredient of ingredients) {
        const key = ingredient.ingredientId || ingredient.name.toLowerCase();
        const scaledQuantity = ingredient.quantity
          ? ingredient.quantity * (entry.scaleFactor || 1)
          : undefined;

        if (!ingredientMap.has(key)) {
          ingredientMap.set(key, {
            name: ingredient.name,
            quantity: scaledQuantity,
            unit: ingredient.unit,
            recipes: [],
          });
        }

        const existing = ingredientMap.get(key)!;
        existing.recipes.push({
          recipeId: entry.recipeId!,
          recipeTitle: recipeTitle || "Unknown Recipe",
          quantity: scaledQuantity,
          unit: ingredient.unit,
        });

        if (scaledQuantity && ingredient.unit === existing.unit) {
          existing.quantity = (existing.quantity || 0) + scaledQuantity;
        }
      }
    }

    return Array.from(ingredientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  exportAsJSON(data: ShoppingListData): string {
    return JSON.stringify(data, null, 2);
  }

  exportAsCSV(data: ShoppingListData): string {
    const lines = [
      "Name,Quantity,Unit,Recipes",
      ...data.ingredients.map((ing) => {
        const recipes = ing.recipes.map((r) => r.recipeTitle).join("; ");
        const quantity = ing.quantity?.toFixed(2) || "";
        const unit = ing.unit || "";
        return `"${ing.name}","${quantity}","${unit}","${recipes}"`;
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
      `## Ingredients`,
      ``,
      `| Name | Quantity | Unit | Recipes |`,
      `|------|----------|------|---------|`,
      ...data.ingredients.map((ing) => {
        const recipes = ing.recipes.map((r) => r.recipeTitle).join(", ");
        const quantity = ing.quantity?.toFixed(2) || "";
        const unit = ing.unit || "";
        return `| ${ing.name} | ${quantity} | ${unit} | ${recipes} |`;
      }),
    ];
    return lines.join("\n");
  }

  exportAsText(data: ShoppingListData): string {
    const lines = [
      `Shopping List`,
      `=============`,
      ``,
      `Week Starting: ${data.weekStart}`,
      `Generated: ${new Date(data.generatedAt).toLocaleString()}`,
      ``,
      `Ingredients:`,
      ``,
      ...data.ingredients.map((ing) => {
        const quantityPart = ing.quantity ? `${ing.quantity.toFixed(2)} ${ing.unit || ""}` : "";
        const recipesPart = ing.recipes.map((r) => r.recipeTitle).join(", ");
        return `- ${ing.name}${quantityPart ? ` (${quantityPart.trim()})` : ""}\n  Used in: ${recipesPart}`;
      }),
    ];
    return lines.join("\n");
  }
}
