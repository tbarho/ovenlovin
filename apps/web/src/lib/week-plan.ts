import { sanitizeWarningCopy } from "@ovenlovin/allergens";
import {
  PeopleService,
  PlanService,
  RecipeService,
  ShoppingListService,
  emptyShoppingTripState,
  parseShoppingTripState,
  planEntriesForWeek,
  shopItemKey,
  type MealPlan,
  type MealPlanEntry,
  type Person,
  type PersonRule,
  type Recipe,
  type ShoppingTripState,
} from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import { getDatabase } from "@ovenlovin/db";
import { whoCanEat, type CheckableIngredient, type WhoCanEatResult } from "@/lib/who-can-eat";
import {
  formatWeekRange,
  groupMealsByDate,
  startOfWeekMonday,
  type PlanEntryDraft,
  type PlanRecipePick,
  type ShopItem,
  type WeekDay,
  type WeekFinding,
  type WeekMeal,
} from "@/lib/week-plan-view";

export {
  addDays,
  formatDayLabel,
  formatIsoDate,
  formatWeekRange,
  groupMealsByDate,
  NO_COOK_LABEL,
  parseIsoDate,
  slotLabel,
  startOfWeekMonday,
  weekDates,
  WEEKDAY_NAMES,
} from "@/lib/week-plan-view";
export type {
  PlanEntryDraft,
  PlanRecipePick,
  ShopItem,
  ShopWarning,
  ShoppingExtra,
  ShoppingTripState,
  WeekDay,
  WeekFinding,
  WeekMeal,
} from "@/lib/week-plan-view";

export type WeekKitchen = {
  plan: MealPlan | null;
  weekStart: string;
  weekLabel: string;
  days: WeekDay[];
  shopping: ShopItem[];
  shoppingState: ShoppingTripState;
  entries: PlanEntryDraft[];
  recipes: PlanRecipePick[];
  defaultServings: number;
};

export function findingsFromCheck(check: WhoCanEatResult): WeekFinding[] {
  return check.people
    .filter((person) => person.mark !== "ok")
    .map((person) => ({
      personName: person.personName,
      severity: person.mark === "block" ? ("block" as const) : ("warn" as const),
      message: sanitizeWarningCopy(person.reasons[0] ?? person.title),
    }));
}

function ingredientsForCheck(
  rows: Array<{ id: string; rawText: string; substitutionNotes?: string | null }>
): CheckableIngredient[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.rawText,
    substitutionNotes: row.substitutionNotes,
  }));
}

function checkMeal(
  people: Person[],
  rules: PersonRule[],
  ingredients: CheckableIngredient[]
): { findings: WeekFinding[]; checkStatus: WhoCanEatResult["status"] } {
  if (people.length === 0 || ingredients.length === 0) {
    return { findings: [], checkStatus: "complete" };
  }
  const check = whoCanEat({ people, rules, ingredients });
  return { findings: findingsFromCheck(check), checkStatus: check.status };
}

function pickSafety(
  people: Person[],
  rules: PersonRule[],
  ingredients: CheckableIngredient[]
): Pick<PlanRecipePick, "safety" | "warning"> {
  if (people.length === 0) return { safety: "unknown", warning: null };
  if (ingredients.length === 0) {
    return { safety: "unknown", warning: "We couldn't finish checking this recipe." };
  }
  const { findings, checkStatus } = checkMeal(people, rules, ingredients);
  if (checkStatus === "incomplete" && findings.length === 0) {
    return { safety: "unknown", warning: "We couldn't finish checking this recipe." };
  }
  const blocked = findings.find((finding) => finding.severity === "block");
  if (blocked) return { safety: "block", warning: blocked.message };
  const warned = findings.find((finding) => finding.severity === "warn");
  if (warned) return { safety: "warn", warning: warned.message };
  return { safety: "ok", warning: null };
}

function storeIngredients(
  target: Map<
    string,
    Array<{
      id: string;
      rawText: string;
      name?: string;
      substitutionNotes?: string | null;
      quantity?: number;
      unit?: string;
    }>
  >,
  recipeId: string,
  rows: Array<{
    id: string;
    rawText: string;
    name?: string;
    substitutionNotes?: string | null;
    quantityMin?: number | null;
    unit?: string | null;
  }>
) {
  target.set(
    recipeId,
    rows.map((row) => ({
      id: row.id,
      rawText: row.rawText,
      name: row.name,
      substitutionNotes: row.substitutionNotes,
      quantity: row.quantityMin ?? undefined,
      unit: row.unit ?? undefined,
    }))
  );
}

export async function loadWeekKitchen(
  householdId: string,
  weekStartIso?: string
): Promise<WeekKitchen> {
  const db = getDatabase();
  const plans = new PlanService(db);
  const recipes = new RecipeService(db);
  const peopleService = new PeopleService(db);
  const shopping = new ShoppingListService();

  const requested = startOfWeekMonday(weekStartIso);
  const listed = await plans.listMealPlans(householdId, { pagination: { limit: 40 } });
  const plan = listed.items.find((item) => item.weekStart === requested) ?? null;
  const weekStart = requested;

  const householdPeople = await peopleService.listPeopleByHousehold(householdId, { limit: 40 });
  const people = householdPeople.items;
  const rules = await peopleService.getRulesForPeople(people.map((person) => person.id));

  if (!plan) {
    const catalog = await recipes.listRecipes(householdId, { pagination: { limit: 80 } });
    const recipePicks = await recipePicksForCatalog(plans, catalog.items, people, rules, new Map());
    return {
      plan: null,
      weekStart,
      weekLabel: formatWeekRange(weekStart),
      days: groupMealsByDate(weekStart, []),
      shopping: [],
      shoppingState: emptyShoppingTripState(),
      entries: [],
      recipes: recipePicks,
      defaultServings: people.length || 4,
    };
  }

  const entries = planEntriesForWeek(await plans.getMealPlanEntries(plan.id), weekStart);
  const recipeIds = [
    ...new Set(entries.map((entry) => entry.recipeId).filter(Boolean)),
  ] as string[];
  const recipeById = new Map<string, Recipe>();
  const ingredientsByRecipe = new Map<
    string,
    Array<{
      id: string;
      rawText: string;
      name?: string;
      substitutionNotes?: string | null;
      quantity?: number;
      unit?: string;
    }>
  >();

  await Promise.all(
    recipeIds.map(async (recipeId) => {
      const [recipe, ingredientRows] = await Promise.all([
        recipes.getRecipe(recipeId),
        plans.getRecipeIngredientsForEntry(recipeId),
      ]);
      if (recipe) recipeById.set(recipeId, recipe);
      storeIngredients(ingredientsByRecipe, recipeId, ingredientRows);
    })
  );

  const catalog = await recipes.listRecipes(householdId, { pagination: { limit: 80 } });
  const recipePicks = await recipePicksForCatalog(
    plans,
    catalog.items,
    people,
    rules,
    ingredientsByRecipe
  );

  const meals: WeekMeal[] = entries.map((entry) => {
    const recipe = entry.recipeId ? recipeById.get(entry.recipeId) : undefined;
    const attendees = peopleForEntry(people, entry);
    const ingredientRows = entry.recipeId ? (ingredientsByRecipe.get(entry.recipeId) ?? []) : [];
    const { findings, checkStatus } = checkMeal(
      attendees,
      rules.filter((rule) => attendees.some((person) => person.id === rule.personId)),
      ingredientsForCheck(ingredientRows)
    );
    const isNoCook = !entry.recipeId && Boolean(entry.freeformMeal);
    return {
      entryId: entry.id,
      date: entry.date,
      mealSlot: entry.mealSlot,
      recipeId: entry.recipeId ?? null,
      title: recipe?.title ?? entry.freeformMeal ?? "Untitled meal",
      href: recipe ? `/recipes/${recipe.id}` : null,
      image: recipe ? recipeMainImage(recipe.images) : null,
      servings: entry.servings ?? recipe?.servings ?? null,
      recipeServings: recipe?.servings ?? null,
      isNoCook,
      findings,
      checkStatus,
    };
  });

  const aggregated = shopping.aggregateIngredients(
    entries.map((entry) => {
      const recipe = entry.recipeId ? recipeById.get(entry.recipeId) : undefined;
      const ingredientRows = entry.recipeId ? (ingredientsByRecipe.get(entry.recipeId) ?? []) : [];
      return {
        entry,
        recipeTitle: recipe?.title ?? entry.freeformMeal ?? undefined,
        recipeServings: recipe?.servings ?? null,
        ingredients: ingredientRows.map((row) => ({
          name: row.name ?? row.rawText,
          rawText: row.rawText,
          quantity: row.quantity,
          unit: row.unit,
        })),
      };
    })
  );

  const shopItems: ShopItem[] = aggregated.map((item) => {
    const check = whoCanEat({
      people,
      rules,
      ingredients: [{ id: `shop-${index}`, name: item.name }],
    });
    return {
      key: item.key || shopItemKey(item.name, item.displayUnit ?? item.unit),
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      displayQuantity: item.displayQuantity,
      displayUnit: item.displayUnit,
      recipes: [...new Set(item.recipes.map((recipe) => recipe.recipeTitle))],
      warnings: findingsFromCheck(check).map((finding) => ({
        personName: finding.personName,
        severity: finding.severity,
        message: finding.message,
      })),
    };
  });

  return {
    plan,
    weekStart,
    weekLabel: formatWeekRange(weekStart),
    days: groupMealsByDate(weekStart, meals),
    shopping: shopItems,
    shoppingState: parseShoppingTripState(plan.shoppingState),
    entries: entries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      mealSlot: entry.mealSlot,
      recipeId: entry.recipeId ?? null,
      freeformMeal: entry.freeformMeal ?? null,
      servings: entry.servings ?? null,
      attendees: entry.attendees,
    })),
    recipes: recipePicks,
    defaultServings:
      entries.find((entry) => entry.servings && entry.servings > 0)?.servings || people.length || 4,
  };
}

async function recipePicksForCatalog(
  plans: PlanService,
  catalog: Recipe[],
  people: Person[],
  rules: PersonRule[],
  ingredientsByRecipe: Map<
    string,
    Array<{
      id: string;
      rawText: string;
      name?: string;
      substitutionNotes?: string | null;
      quantity?: number;
      unit?: string;
    }>
  >
): Promise<PlanRecipePick[]> {
  const missing = catalog.filter((item) => !ingredientsByRecipe.has(item.id));
  if (missing.length > 0) {
    const grouped = await plans.getRecipeIngredientsForRecipes(missing.map((item) => item.id));
    for (const item of missing) {
      storeIngredients(ingredientsByRecipe, item.id, grouped.get(item.id) ?? []);
    }
  }

  return catalog.map((item) => {
    const rows = ingredientsByRecipe.get(item.id) ?? [];
    const { safety, warning } = pickSafety(people, rules, ingredientsForCheck(rows));
    return {
      id: item.id,
      title: item.title,
      image: recipeMainImage(item.images),
      servings: item.servings ?? null,
      cookTimeMinutes: item.cookTimeMinutes ?? null,
      prepTimeMinutes: item.prepTimeMinutes ?? null,
      safety,
      warning,
    };
  });
}

function peopleForEntry(people: Person[], entry: MealPlanEntry): Person[] {
  if (entry.attendees.length === 0) return people;
  const selected = people.filter((person) => entry.attendees.includes(person.id));
  return selected.length > 0 ? selected : people;
}
