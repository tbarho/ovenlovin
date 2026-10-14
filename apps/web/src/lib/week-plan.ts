import {
  PeopleService,
  PlanService,
  RecipeService,
  ShoppingListService,
  type MealPlan,
  type MealPlanEntry,
  type Person,
  type PersonRule,
  type Recipe,
} from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import { getDatabase } from "@ovenlovin/db";
import { whoCanEat, type CheckableIngredient, type WhoCanEatResult } from "@/lib/who-can-eat";

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type WeekFinding = {
  personName: string;
  severity: "block" | "warn";
  message: string;
};

export type WeekMeal = {
  entryId: string;
  date: string;
  mealSlot: string;
  title: string;
  href: string | null;
  image: string | null;
  servings: number | null;
  findings: WeekFinding[];
  checkStatus: WhoCanEatResult["status"];
};

export type WeekDay = {
  date: string;
  weekday: string;
  label: string;
  meals: WeekMeal[];
};

export type ShopWarning = {
  personName: string;
  severity: "block" | "warn";
  message: string;
};

export type ShopItem = {
  key: string;
  name: string;
  quantity?: number;
  unit?: string;
  recipes: string[];
  warnings: ShopWarning[];
};

export type WeekKitchen = {
  plan: MealPlan | null;
  weekStart: string;
  weekLabel: string;
  days: WeekDay[];
  shopping: ShopItem[];
};

export function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return { year, month: month - 1, day };
}

export function formatIsoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month, day));
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseIsoDate(iso);
  return formatIsoDate(year, month, day + days);
}

export function startOfWeekMonday(iso?: string): string {
  const source = iso ?? new Date().toISOString().slice(0, 10);
  const { year, month, day } = parseIsoDate(source);
  const date = new Date(Date.UTC(year, month, day));
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(source, offset);
}

export function weekDates(weekStart: string): string[] {
  return WEEKDAY_NAMES.map((_, index) => addDays(weekStart, index));
}

export function formatDayLabel(iso: string): string {
  const { month, day } = parseIsoDate(iso);
  return `${MONTHS[month]} ${day}`;
}

export function formatWeekRange(weekStart: string): string {
  const start = parseIsoDate(weekStart);
  const endIso = addDays(weekStart, 6);
  const end = parseIsoDate(endIso);
  const startMonth = MONTHS[start.month];
  const endMonth = MONTHS[end.month];
  if (start.year === end.year && start.month === end.month) {
    return `${startMonth} ${start.day}–${end.day}, ${start.year}`;
  }
  if (start.year === end.year) {
    return `${startMonth} ${start.day} – ${endMonth} ${end.day}, ${start.year}`;
  }
  return `${startMonth} ${start.day}, ${start.year} – ${endMonth} ${end.day}, ${end.year}`;
}

export function slotLabel(slot: string): string {
  if (!slot) return "Meal";
  return slot.slice(0, 1).toUpperCase() + slot.slice(1);
}

export function findingsFromCheck(check: WhoCanEatResult): WeekFinding[] {
  return check.people
    .filter((person) => person.mark !== "ok")
    .map((person) => ({
      personName: person.personName,
      severity: person.mark === "block" ? ("block" as const) : ("warn" as const),
      message: person.reasons[0] ?? person.title,
    }));
}

export function groupMealsByDate(weekStart: string, meals: WeekMeal[]): WeekDay[] {
  const byDate = new Map<string, WeekMeal[]>();
  for (const meal of meals) {
    const list = byDate.get(meal.date) ?? [];
    list.push(meal);
    byDate.set(meal.date, list);
  }
  return weekDates(weekStart).map((date, index) => ({
    date,
    weekday: WEEKDAY_NAMES[index] ?? "Day",
    label: formatDayLabel(date),
    meals: (byDate.get(date) ?? []).slice().sort((a, b) => a.mealSlot.localeCompare(b.mealSlot)),
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

export async function loadWeekKitchen(householdId: string): Promise<WeekKitchen> {
  const db = getDatabase();
  const plans = new PlanService(db);
  const recipes = new RecipeService(db);
  const peopleService = new PeopleService(db);
  const shopping = new ShoppingListService();

  const thisMonday = startOfWeekMonday();
  const listed = await plans.listMealPlans(householdId, { pagination: { limit: 20 } });
  const plan =
    listed.items.find((item) => item.weekStart === thisMonday) ?? listed.items[0] ?? null;
  const weekStart = plan?.weekStart || thisMonday;

  const householdPeople = await peopleService.listPeopleByHousehold(householdId, { limit: 40 });
  const people = householdPeople.items;
  const rules = await peopleService.getRulesForPeople(people.map((person) => person.id));

  if (!plan) {
    return {
      plan: null,
      weekStart,
      weekLabel: formatWeekRange(weekStart),
      days: groupMealsByDate(weekStart, []),
      shopping: [],
    };
  }

  const entries = await plans.getMealPlanEntries(plan.id);
  const recipeIds = [
    ...new Set(entries.map((entry) => entry.recipeId).filter(Boolean)),
  ] as string[];
  const recipeById = new Map<string, Recipe>();
  const ingredientsByRecipe = new Map<
    string,
    Array<{
      id: string;
      rawText: string;
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
      ingredientsByRecipe.set(
        recipeId,
        ingredientRows.map((row) => ({
          id: row.id,
          rawText: row.rawText,
          substitutionNotes: row.substitutionNotes,
          quantity: row.quantityMin ?? undefined,
          unit: row.unit ?? undefined,
        }))
      );
    })
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
    return {
      entryId: entry.id,
      date: entry.date,
      mealSlot: entry.mealSlot,
      title: recipe?.title ?? entry.freeformMeal ?? "Untitled meal",
      href: recipe ? `/recipes/${recipe.id}` : null,
      image: recipe ? recipeMainImage(recipe.images) : null,
      servings: entry.servings ?? recipe?.servings ?? null,
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
        ingredients: ingredientRows.map((row) => ({
          name: row.rawText,
          rawText: row.rawText,
          quantity: row.quantity,
          unit: row.unit,
        })),
      };
    })
  );

  const shopItems: ShopItem[] = aggregated.map((item, index) => {
    const check = whoCanEat({
      people,
      rules,
      ingredients: [{ id: `shop-${index}`, name: item.name }],
    });
    return {
      key: `${item.name}-${index}`,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
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
  };
}

function peopleForEntry(people: Person[], entry: MealPlanEntry): Person[] {
  if (entry.attendees.length === 0) return people;
  const selected = people.filter((person) => entry.attendees.includes(person.id));
  return selected.length > 0 ? selected : people;
}
