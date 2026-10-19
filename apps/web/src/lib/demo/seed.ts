import {
  ApiKeyService,
  CookbookService,
  HouseholdService,
  PeopleService,
  PlanService,
  RecipeService,
} from "@ovenlovin/core";
import { getDatabase, type DbClient } from "@ovenlovin/db";
import { shoppingList, shoppingListItem } from "@ovenlovin/db/schema";
import { writePersonNotes } from "@/lib/person-appearance";
import {
  DEMO_API_KEY_SCOPES,
  DEMO_HOUSEHOLD_NAME,
  DEMO_PEOPLE,
  DEMO_PLAN_DINNERS,
  DEMO_RECIPES,
  DEMO_SHOPPING_ITEMS,
  DEMO_WEEK_START,
} from "./fixture";

export type DemoKitchenSeed = {
  userId: string;
  householdId: string;
  apiKeyId: string;
  apiKeyPlaintext: string;
};

export async function seedDemoKitchen(
  db: DbClient,
  ids: { clerkUserId: string; householdSlug: string; email: string; householdName?: string }
): Promise<DemoKitchenSeed> {
  const households = new HouseholdService(db);
  const people = new PeopleService(db);
  const recipes = new RecipeService(db);
  const cookbooks = new CookbookService(db);
  const plans = new PlanService(db);
  const keys = new ApiKeyService(db);

  const user = await households.createUser({
    clerkUserId: ids.clerkUserId,
    email: ids.email,
    displayName: "Demo visitor",
  });

  const household = await households.createHousehold({
    name: ids.householdName ?? DEMO_HOUSEHOLD_NAME,
    slug: ids.householdSlug,
    clerkOrgId: null,
    createdBy: user.id,
  });

  await households.createMembership({
    userId: user.id,
    householdId: household.id,
    role: "owner",
  });

  const createdPeople = [];
  for (const person of DEMO_PEOPLE) {
    createdPeople.push(
      await people.createPerson({
        householdId: household.id,
        userId: person.displayName === "Parent A" ? user.id : null,
        displayName: person.displayName,
        birthYear: "birthYear" in person ? person.birthYear : null,
        notes: writePersonNotes({ emoji: person.emoji, color: person.color }),
        createdBy: user.id,
      })
    );
  }

  for (const person of DEMO_PEOPLE) {
    const row = createdPeople.find((item) => item.displayName === person.displayName);
    if (!row) continue;
    for (const rule of person.rules) {
      const allergen = rule.kind === "allergen" && rule.severity === "block";
      await people.createRule({
        personId: row.id,
        kind: rule.kind,
        target: rule.target,
        severity: rule.severity,
        includeMayContain: "includeMayContain" in rule ? Boolean(rule.includeMayContain) : allergen,
        includeCrossContact:
          "includeCrossContact" in rule ? Boolean(rule.includeCrossContact) : allergen,
        sharedFacility: "sharedFacility" in rule ? rule.sharedFacility : "ignore",
        includeUnmappedIngredients: false,
        includeDescendants: true,
        treatCoconutAsTreeNut:
          "treatCoconutAsTreeNut" in rule ? Boolean(rule.treatCoconutAsTreeNut) : false,
        label: "label" in rule ? rule.label : null,
        note: "note" in rule ? rule.note : null,
        setBy: user.id,
        createdBy: user.id,
      });
    }
    for (const value of person.loves) {
      await people.createPreference({
        personId: row.id,
        type: "love",
        value,
        weight: 1,
        createdBy: user.id,
      });
    }
  }

  const weeknight = await cookbooks.createCookbook({
    householdId: household.id,
    name: "Weeknight dinners",
    description: "School-night plates",
    createdBy: user.id,
  });
  const weekend = await cookbooks.createCookbook({
    householdId: household.id,
    name: "Weekend treats",
    description: "Slow mornings and baking",
    createdBy: user.id,
  });

  const bySlug = new Map<string, { id: string; servings: number | null }>();
  for (const recipe of DEMO_RECIPES) {
    const details = await recipes.createRecipeFromDraft(recipe, {
      householdId: household.id,
      createdBy: user.id,
    });
    if (recipe.cookbook === "weeknight") {
      await cookbooks.addRecipe(weeknight.id, details.id);
    } else {
      await cookbooks.addRecipe(weekend.id, details.id);
    }
    bySlug.set(recipe.slug, { id: details.id, servings: details.servings ?? null });
  }

  const plan = await plans.createMealPlan({
    householdId: household.id,
    weekStart: DEMO_WEEK_START,
    status: "draft",
    acknowledgedWarnings: [],
    needsRecheck: false,
    createdBy: user.id,
  });
  const attendees = createdPeople.map((person) => person.id);
  for (const entry of DEMO_PLAN_DINNERS) {
    const recipe = bySlug.get(entry.slug);
    if (!recipe) continue;
    await plans.createMealPlanEntry({
      mealPlanId: plan.id,
      date: entry.date,
      mealSlot: entry.slot,
      recipeId: recipe.id,
      servings: 4,
      attendees,
      scaleFactor: 1,
    });
  }

  const [list] = await db
    .insert(shoppingList)
    .values({
      householdId: household.id,
      mealPlanId: plan.id,
      name: "This week's groceries",
      createdBy: user.id,
    })
    .returning();
  if (list) {
    await db.insert(shoppingListItem).values(
      DEMO_SHOPPING_ITEMS.map((item, order) => ({
        listId: list.id,
        name: item.name,
        aisleCategory: item.aisle,
        notes: item.quantity,
        order,
        isChecked: false,
      }))
    );
  }

  const key = await keys.create(
    {
      householdId: household.id,
      name: "Demo agent key",
      scopes: [...DEMO_API_KEY_SCOPES],
    },
    user.id
  );

  return {
    userId: user.id,
    householdId: household.id,
    apiKeyId: key.id,
    apiKeyPlaintext: key.plaintext,
  };
}

export async function seedDemoKitchenDefault(): Promise<DemoKitchenSeed> {
  return seedDemoKitchen(getDatabase(), {
    clerkUserId: "user_demo_preview",
    householdSlug: "demo-preview",
    email: "demo-preview@demo.ovenlovin.local",
  });
}
