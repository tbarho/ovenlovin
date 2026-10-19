import {
  ApiKeyService,
  CookbookService,
  HouseholdService,
  PeopleService,
  PlanService,
  RecipeService,
  type RecipeImportDraft,
} from "@ovenlovin/core";
import { getDatabase, type DbClient } from "@ovenlovin/db";
import type { RequestContext } from "@/lib/api/middleware";
import { writePersonNotes } from "@/lib/person-appearance";
import { addDays, startOfWeekMonday } from "@/lib/week-plan-view";

export const E2E_CLERK_USER_ID = "user_e2e_kitchen_ty";
export const E2E_USER_EMAIL = "kitchen@e2e.ovenlovin.local";
export const E2E_HOUSEHOLD_SLUG = "e2e-kitchen";
export const E2E_HOUSEHOLD_NAME = "Ty's kitchen";

export const E2E_PEOPLE = [
  { displayName: "Ty", emoji: "🧑‍🍳", color: "#e07a3d" },
  { displayName: "Bec", emoji: "👩", color: "#db5a9a" },
  { displayName: "Ellie", emoji: "👧", color: "#7b6cff" },
  { displayName: "Laynie", emoji: "🌻", color: "#c46a1b" },
  { displayName: "Jake", emoji: "👦", color: "#3d8bfd" },
] as const;

/** Dense list-card fixture: 6+ items in each People section. */
export const E2E_TY_CANT_EAT = [
  { kind: "allergen" as const, target: "sesame" },
  { kind: "allergen" as const, target: "mustard" },
  { kind: "allergen" as const, target: "celery" },
  { kind: "allergen" as const, target: "lupin" },
  { kind: "ingredient" as const, target: "eggplant" },
  { kind: "ingredient" as const, target: "raisins" },
];

export const E2E_TY_DOESNT_LIKE = [
  "cilantro",
  "olives",
  "mushrooms",
  "onions",
  "garlic",
  "spicy",
] as const;

export const E2E_TY_LOVES = [
  "salmon",
  "mexican",
  "spicy",
  "italian",
  "chicken",
  "pasta",
  "chocolate",
] as const;

const RECIPE_IMAGE = (slug: string) => `/e2e-kitchen/${slug}.svg`;

/** Extra images exist so recipe detail can prove it only renders the main one. */
const PESTO_GALLERY = [
  RECIPE_IMAGE("pesto-pasta"),
  RECIPE_IMAGE("kung-pao-chicken"),
  RECIPE_IMAGE("veggie-tacos"),
];

type KitchenRecipe = RecipeImportDraft & { slug: string; cookbook?: "weeknight" | "weekend" };

function draft(partial: Omit<RecipeImportDraft, "source"> & { slug: string }): KitchenRecipe {
  return {
    ...partial,
    images: [RECIPE_IMAGE(partial.slug)],
    source: {
      type: "manual",
      importerName: "e2e-kitchen",
      importerVersion: "1",
      rawExtractionJson: { fixture: "e2e-kitchen", slug: partial.slug },
      licenseNote: "Synthetic e2e kitchen fixture",
    },
    needsReview: false,
  };
}

export const E2E_RECIPES: KitchenRecipe[] = [
  {
    ...draft({
      slug: "pesto-pasta",
      title: "Weeknight pesto pasta",
      description:
        "Basil pesto tossed with pasta and roasted tomatoes. Pine nuts make this a Jake block.",
      servings: 4,
      prepTimeMinutes: 15,
      cookTimeMinutes: 12,
      cuisine: "Italian",
      course: "dinner",
      ingredients: [
        { rawText: "12 oz pasta" },
        { rawText: "1/3 cup basil pesto", substitutionNotes: "sunflower seed pesto" },
        { rawText: "1 pint cherry tomatoes" },
        { rawText: "2 tbsp olive oil" },
        { rawText: "1/4 cup grated parmesan" },
      ],
      steps: [
        { text: "Boil the pasta in salted water until al dente." },
        { text: "Roast the tomatoes in olive oil until they blister." },
        { text: "Toss pasta with pesto and tomatoes. Finish with parmesan." },
      ],
    }),
    images: PESTO_GALLERY,
    cookbook: "weeknight",
  },
  {
    ...draft({
      slug: "kung-pao-chicken",
      title: "Kung pao chicken",
      description: "A weeknight stir-fry with peanuts - Jake cannot eat this as written.",
      servings: 4,
      prepTimeMinutes: 20,
      cookTimeMinutes: 15,
      cuisine: "Chinese",
      course: "dinner",
      ingredients: [
        { rawText: "1 lb chicken thighs, cubed" },
        { rawText: "1/2 cup roasted peanuts" },
        { rawText: "2 tbsp soy sauce" },
        { rawText: "1 tbsp rice vinegar" },
        { rawText: "4 dried chiles" },
        { rawText: "2 cloves garlic, minced" },
      ],
      steps: [
        { text: "Sear the chicken until browned." },
        { text: "Add garlic, chiles, and sauce. Toss in peanuts at the end." },
      ],
    }),
  },
  {
    ...draft({
      slug: "sheet-pan-salmon",
      title: "Sheet-pan salmon",
      description: "Salmon and broccoli on one pan. Safe for everyone in this kitchen.",
      servings: 4,
      prepTimeMinutes: 10,
      cookTimeMinutes: 18,
      cuisine: "American",
      course: "dinner",
      methodTags: ["sheet_pan"],
      ingredients: [
        { rawText: "4 salmon fillets" },
        { rawText: "1 lb broccoli florets" },
        { rawText: "2 tbsp olive oil" },
        { rawText: "1 lemon" },
        { rawText: "1 tsp salt" },
      ],
      steps: [
        { text: "Heat the oven to 425°F." },
        { text: "Toss broccoli with oil and salt. Roast 8 minutes." },
        { text: "Add salmon, roast until just cooked, and finish with lemon." },
      ],
    }),
    cookbook: "weeknight",
  },
  {
    ...draft({
      slug: "roast-chicken",
      title: "Sunday roast chicken",
      description: "A whole chicken with potatoes and carrots.",
      servings: 6,
      prepTimeMinutes: 20,
      cookTimeMinutes: 75,
      cuisine: "American",
      course: "dinner",
      ingredients: [
        { rawText: "1 whole chicken" },
        { rawText: "1.5 lb baby potatoes" },
        { rawText: "4 carrots" },
        { rawText: "3 tbsp olive oil" },
        { rawText: "1 tbsp kosher salt" },
      ],
      steps: [
        { text: "Heat the oven to 425°F." },
        { text: "Rub the chicken and vegetables with oil and salt." },
        { text: "Roast until the chicken hits 165°F at the thigh." },
      ],
    }),
    cookbook: "weeknight",
  },
  {
    ...draft({
      slug: "veggie-tacos",
      title: "Veggie tacos",
      description: "Black beans, roasted squash, and slaw.",
      servings: 4,
      prepTimeMinutes: 15,
      cookTimeMinutes: 25,
      cuisine: "Mexican",
      course: "dinner",
      ingredients: [
        { rawText: "8 corn tortillas" },
        { rawText: "1 can black beans" },
        { rawText: "1 acorn squash" },
        { rawText: "2 cups shredded cabbage" },
        { rawText: "1 lime" },
      ],
      steps: [
        { text: "Roast squash cubes until tender." },
        { text: "Warm beans and tortillas." },
        { text: "Pile squash, beans, and slaw. Squeeze lime." },
      ],
    }),
    cookbook: "weeknight",
  },
  {
    ...draft({
      slug: "tomato-soup",
      title: "Tomato soup",
      description: "A blender soup for a cold night.",
      servings: 4,
      prepTimeMinutes: 10,
      cookTimeMinutes: 30,
      cuisine: "American",
      course: "dinner",
      ingredients: [
        { rawText: "2 cans crushed tomatoes" },
        { rawText: "1 yellow onion" },
        { rawText: "2 cups vegetable broth" },
        { rawText: "1/2 cup cream" },
        { rawText: "2 tbsp butter" },
      ],
      steps: [
        { text: "Sweat the onion in butter." },
        { text: "Add tomatoes and broth. Simmer 20 minutes." },
        { text: "Blend until smooth and stir in cream." },
      ],
    }),
    cookbook: "weeknight",
  },
  {
    ...draft({
      slug: "saturday-pancakes",
      title: "Saturday pancakes",
      description: "Buttermilk pancakes for a slow morning.",
      servings: 4,
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      cuisine: "American",
      course: "breakfast",
      ingredients: [
        { rawText: "2 cups all-purpose flour" },
        { rawText: "2 cups buttermilk" },
        { rawText: "2 eggs" },
        { rawText: "2 tbsp sugar" },
        { rawText: "1 tsp baking soda" },
      ],
      steps: [
        { text: "Whisk dry ingredients, then fold in buttermilk and eggs." },
        { text: "Cook on a buttered griddle until bubbles set." },
      ],
    }),
    cookbook: "weekend",
  },
  {
    ...draft({
      slug: "chocolate-chip-cookies",
      title: "Chocolate chip cookies",
      description: "The weekend tray. No nuts in this batch.",
      servings: 24,
      prepTimeMinutes: 15,
      cookTimeMinutes: 12,
      cuisine: "American",
      course: "dessert",
      ingredients: [
        { rawText: "2.25 cups all-purpose flour" },
        { rawText: "1 cup butter" },
        { rawText: "3/4 cup brown sugar" },
        { rawText: "2 cups chocolate chips" },
        { rawText: "2 eggs" },
      ],
      steps: [
        { text: "Cream butter and sugar. Beat in eggs." },
        { text: "Stir in flour and chocolate chips." },
        { text: "Bake at 375°F until the edges are golden." },
      ],
    }),
    cookbook: "weekend",
  },
];

export type E2eKitchenSeed = {
  userId: string;
  householdId: string;
  membershipRole: RequestContext["membershipRole"];
  created: boolean;
};

export async function seedE2eKitchen(db: DbClient = getDatabase()): Promise<E2eKitchenSeed> {
  const households = new HouseholdService(db);
  const people = new PeopleService(db);
  const recipes = new RecipeService(db);
  const cookbooks = new CookbookService(db);
  const plans = new PlanService(db);
  const keys = new ApiKeyService(db);

  let user = await households.getUserByClerkId(E2E_CLERK_USER_ID);
  if (!user) {
    user = await households.createUser({
      clerkUserId: E2E_CLERK_USER_ID,
      email: E2E_USER_EMAIL,
      displayName: "Ty",
    });
  }

  let household = await households.getHouseholdBySlug(E2E_HOUSEHOLD_SLUG);
  if (!household) {
    household = await households.createHousehold({
      name: E2E_HOUSEHOLD_NAME,
      slug: E2E_HOUSEHOLD_SLUG,
      clerkOrgId: null,
      createdBy: user.id,
    });
  }

  const memberships = await households.getMembershipsForUser(user.id);
  let membership = memberships.find((item) => item.householdId === household.id);
  if (!membership) {
    membership = await households.createMembership({
      userId: user.id,
      householdId: household.id,
      role: "owner",
    });
  }

  const existingPeople = await people.listPeopleByHousehold(household.id, { limit: 40 });
  if (existingPeople.items.length === 0) {
    const createdPeople = [];
    for (const person of E2E_PEOPLE) {
      createdPeople.push(
        await people.createPerson({
          householdId: household.id,
          userId: person.displayName === "Ty" ? user.id : null,
          displayName: person.displayName,
          notes: writePersonNotes({ emoji: person.emoji, color: person.color }),
          createdBy: user.id,
        })
      );
    }
    const jake = createdPeople.find((person) => person.displayName === "Jake");
    if (jake) {
      for (const target of ["peanut", "tree_nut"] as const) {
        await people.createRule({
          personId: jake.id,
          kind: "allergen",
          target,
          severity: "block",
          includeMayContain: true,
          includeCrossContact: true,
          sharedFacility: "block",
          includeUnmappedIngredients: false,
          includeDescendants: true,
          treatCoconutAsTreeNut: true,
          label: target === "peanut" ? "Severe peanut allergy" : "Severe tree nut allergy",
          note: "Anaphylaxis risk. Do not guess.",
          setBy: user.id,
          createdBy: user.id,
        });
      }
    }
  }

  const householdPeople = await people.listPeopleByHousehold(household.id, { limit: 40 });
  const ty = householdPeople.items.find((person) => person.displayName === "Ty");
  if (ty) {
    const tyRules = await people.getRulesForPerson(ty.id);
    for (const item of E2E_TY_CANT_EAT) {
      if (tyRules.some((rule) => rule.target === item.target && rule.severity === "block")) {
        continue;
      }
      await people.createRule({
        personId: ty.id,
        kind: item.kind,
        target: item.target,
        severity: "block",
        includeMayContain: false,
        includeCrossContact: false,
        sharedFacility: "ignore",
        includeUnmappedIngredients: false,
        includeDescendants: true,
        treatCoconutAsTreeNut: true,
        label: item.target,
        note: null,
        setBy: user.id,
        createdBy: user.id,
      });
    }
    for (const target of E2E_TY_DOESNT_LIKE) {
      if (tyRules.some((rule) => rule.target === target && rule.severity === "prefer_avoid")) {
        continue;
      }
      await people.createRule({
        personId: ty.id,
        kind: "ingredient",
        target,
        severity: "prefer_avoid",
        includeMayContain: false,
        includeCrossContact: false,
        sharedFacility: "ignore",
        includeUnmappedIngredients: false,
        includeDescendants: true,
        treatCoconutAsTreeNut: true,
        label: target,
        note: null,
        setBy: user.id,
        createdBy: user.id,
      });
    }
    const tyLoves = await people.getPreferencesForPerson(ty.id, "love");
    for (const value of E2E_TY_LOVES) {
      if (tyLoves.some((item) => item.value === value)) continue;
      await people.createPreference({
        personId: ty.id,
        type: "love",
        value,
        weight: 1,
        createdBy: user.id,
      });
    }
  }

  const existingRecipes = await recipes.listRecipes(household.id, { pagination: { limit: 40 } });
  const pesto = existingRecipes.items.find((recipe) => /pesto pasta/i.test(recipe.title));
  if (pesto && pesto.images.length < 3) {
    await recipes.updateRecipe(pesto.id, { images: PESTO_GALLERY });
  }
  if (existingRecipes.items.length === 0) {
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

    const createdRecipes = [];
    for (const recipe of E2E_RECIPES) {
      const details = await recipes.createRecipeFromDraft(recipe, {
        householdId: household.id,
        createdBy: user.id,
      });
      if (recipe.cookbook === "weeknight") {
        await cookbooks.addRecipe(weeknight.id, details.id);
      }
      if (recipe.cookbook === "weekend") {
        await cookbooks.addRecipe(weekend.id, details.id);
      }
      createdRecipes.push(details);
    }

    const existingKeys = await keys.listForHousehold(household.id);
    if (existingKeys.length === 0) {
      await keys.create(
        {
          householdId: household.id,
          name: "Grok kitchen key",
          scopes: ["recipes:read", "recipes:write", "people:read", "plans:read"],
        },
        user.id
      );
    }
  }

  const existingPlans = await plans.listMealPlans(household.id, { pagination: { limit: 40 } });
  const weekStart = startOfWeekMonday();
  if (!existingPlans.items.some((plan) => plan.weekStart === weekStart)) {
    const dinnerRecipes = await recipes.listRecipes(household.id, { pagination: { limit: 40 } });
    const dinner = dinnerRecipes.items.filter((recipe) =>
      ["weeknight-pesto-pasta", "sheet-pan-salmon", "veggie-tacos"].includes(recipe.slug)
    );
    if (dinner.length > 0) {
      const plan = await plans.createMealPlan({
        householdId: household.id,
        weekStart,
        status: "draft",
        acknowledgedWarnings: [],
        needsRecheck: false,
        createdBy: user.id,
      });
      const attendees = (await people.listPeopleByHousehold(household.id, { limit: 40 })).items.map(
        (person) => person.id
      );
      const dates = [weekStart, addDays(weekStart, 1), addDays(weekStart, 2)];
      for (const [index, recipe] of dinner.entries()) {
        const date = dates[index];
        if (!date) continue;
        await plans.createMealPlanEntry({
          mealPlanId: plan.id,
          date,
          mealSlot: "dinner",
          recipeId: recipe.id,
          servings: recipe.servings ?? 4,
          attendees,
          scaleFactor: 1,
        });
      }
    }
  }

  const books = await cookbooks.listCookbookCards(household.id);
  if (!books.some((book) => /scratch book/i.test(book.name))) {
    await cookbooks.createCookbook({
      householdId: household.id,
      name: "Scratch book",
      description: "Empty on purpose so Add recipes is easy to find",
      createdBy: user.id,
    });
  }

  return {
    userId: user.id,
    householdId: household.id,
    membershipRole: membership.role,
    created: existingRecipes.items.length === 0,
  };
}

export async function getE2eSessionContext(): Promise<RequestContext> {
  const seeded = await seedE2eKitchen();
  return {
    userId: seeded.userId,
    clerkUserId: E2E_CLERK_USER_ID,
    householdId: seeded.householdId,
    membershipRole: seeded.membershipRole,
  };
}
