import {
  ApiKeyService,
  CookbookService,
  HouseholdService,
  InviteService,
  PeopleService,
  PlanService,
  RecipeService,
  ScheduleService,
  shopItemKey,
  slugifyTitle,
  type PersonRule,
  type RecipeImportDraft,
} from "@ovenlovin/core";
import { and, eq, isNull } from "drizzle-orm";
import { recipe, scheduleTemplate, type DbClient } from "@ovenlovin/db";
import { KITCHEN_PHOTOS, type E2eKitchenSeed } from "@/lib/e2e-kitchen";
import { writePersonNotes } from "@/lib/person-appearance";
import { persistMealPlanCheck } from "@/lib/run-meal-plan-check";
import { addDays, startOfWeekMonday } from "@/lib/week-plan-view";

/**
 * Opt-in extra seed (E2E_KITCHEN_FULL=1) that covers the states the base kitchen
 * does not: warn / diet / dated rules, coconut, needs_review and draft recipes, a
 * soft-deleted recipe, imageless and url / pdf sourced recipes, an approved plan
 * with a check report and shopping state, undo history, a schedule, scoped and
 * revoked keys, a second kitchen with other roles and a pending invite.
 * Only apps/web/scripts/seed-e2e-kitchen.ts runs it: never the per-request path.
 */
export const E2E_FULL_HOUSEHOLD_SLUG = "e2e-lake-house";
export const E2E_FULL_HOUSEHOLD_NAME = "Bec's lake house";

export const E2E_FULL_USERS = [
  { clerkUserId: "user_e2e_kitchen_sam", email: "sam@e2e.ovenlovin.local", displayName: "Sam" },
  { clerkUserId: "user_e2e_kitchen_nana", email: "nana@e2e.ovenlovin.local", displayName: "Nana" },
] as const;

type RuleSeed = Pick<PersonRule, "kind" | "target" | "severity"> &
  Partial<
    Pick<
      PersonRule,
      | "includeMayContain"
      | "includeCrossContact"
      | "sharedFacility"
      | "treatCoconutAsTreeNut"
      | "label"
      | "note"
      | "activeFrom"
      | "activeUntil"
    >
  >;

export const E2E_FULL_PEOPLE: Array<{
  displayName: string;
  emoji: string;
  color: string;
  birthYear?: number;
  rules: RuleSeed[];
  loves: string[];
}> = [
  {
    displayName: "Nana",
    emoji: "👵",
    color: "#6b8e23",
    birthYear: 1950,
    rules: [
      { kind: "diet", target: "vegetarian", severity: "block", label: "Vegetarian" },
      { kind: "allergen", target: "shellfish", severity: "warn", label: "Shellfish upsets her" },
      {
        kind: "custom",
        target: "no sweets in Lent",
        severity: "prefer_avoid",
        label: "Lent",
        activeFrom: "2026-02-18",
        activeUntil: "2026-04-05",
      },
    ],
    loves: ["soup", "baking"],
  },
  {
    displayName: "Sam",
    emoji: "🧢",
    color: "#2a9d8f",
    rules: [
      {
        kind: "allergen",
        target: "milk",
        severity: "warn",
        includeMayContain: false,
        includeCrossContact: false,
        sharedFacility: "warn",
        label: "Lactose: warn only",
      },
    ],
    loves: ["dumplings"],
  },
  // Empty-state card: no rules, no loves.
  { displayName: "Rosie", emoji: "🐣", color: "#f4a261", birthYear: 2024, rules: [], loves: [] },
];

/** Extra rules on base-kitchen people so warn, coconut-off, and shellfish show on existing cards. */
export const E2E_FULL_EXTRA_RULES: Array<{ person: string; rule: RuleSeed }> = [
  {
    person: "Bec",
    rule: {
      kind: "allergen",
      target: "tree_nut",
      severity: "warn",
      treatCoconutAsTreeNut: false,
      label: "Mild tree nut sensitivity",
      note: "Coconut is fine for Bec.",
    },
  },
  { person: "Ellie", rule: { kind: "allergen", target: "soy", severity: "warn" } },
  { person: "Laynie", rule: { kind: "allergen", target: "shellfish", severity: "block" } },
];

const photo = (slug: string): string[] =>
  process.env.E2E_KITCHEN_PHOTOS === "1" && KITCHEN_PHOTOS[slug]
    ? [`https://images.unsplash.com/photo-${KITCHEN_PHOTOS[slug]}?w=1200&q=80&auto=format&fit=crop`]
    : [];

export type FullKitchenRecipe = RecipeImportDraft & {
  slug: string;
  cookbook?: "holiday" | "weeknight-extra";
  /** Applied after create: `draft` status, or soft-delete so Restore has a target. */
  after?: "draft" | "delete" | "family";
};

function full(
  partial: Omit<RecipeImportDraft, "source"> & {
    slug: string;
    cookbook?: FullKitchenRecipe["cookbook"];
    after?: FullKitchenRecipe["after"];
    source?: Partial<RecipeImportDraft["source"]>;
  }
): FullKitchenRecipe {
  const { source, ...rest } = partial;
  return {
    images: photo(partial.slug),
    needsReview: false,
    ...rest,
    source: {
      type: "manual",
      importerName: "e2e-kitchen-full",
      importerVersion: "1",
      rawExtractionJson: { fixture: "e2e-kitchen-full", slug: partial.slug },
      licenseNote: "Synthetic e2e kitchen fixture",
      ...source,
    },
  };
}

export const E2E_FULL_RECIPES: FullKitchenRecipe[] = [
  full({
    slug: "thai-green-curry",
    title: "Thai green curry with shrimp",
    description:
      "Coconut milk curry. Coconut is a tree nut only for Jake; shrimp is a Laynie block.",
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 20,
    cuisine: "Thai",
    course: "dinner",
    ingredients: [
      { rawText: "1 can coconut milk" },
      { rawText: "1 lb shrimp, peeled" },
      { rawText: "2 tbsp green curry paste" },
      { rawText: "1 tbsp fish sauce" },
      { rawText: "1 cup Thai basil" },
      { rawText: "2 cups jasmine rice" },
    ],
    steps: [
      { text: "Fry the curry paste, then whisk in coconut milk." },
      { text: "Simmer the shrimp until pink. Finish with basil and fish sauce." },
    ],
  }),
  full({
    slug: "shrimp-pad-thai",
    title: "Shrimp pad thai",
    description: "Peanuts, egg, and shrimp in one pan.",
    servings: 4,
    prepTimeMinutes: 20,
    cookTimeMinutes: 10,
    cuisine: "Thai",
    course: "dinner",
    ingredients: [
      { rawText: "8 oz rice noodles" },
      { rawText: "1/2 lb shrimp" },
      { rawText: "2 eggs" },
      { rawText: "1/3 cup crushed peanuts" },
      { rawText: "3 tbsp tamarind paste" },
      { rawText: "2 tbsp fish sauce" },
      { rawText: "1 lime" },
    ],
    steps: [
      { text: "Soak the noodles." },
      { text: "Scramble the eggs, add shrimp, noodles, and sauce. Top with peanuts." },
    ],
  }),
  full({
    slug: "lamb-kofta",
    title: "Lamb kofta with tahini sauce",
    description: "Sesame in the tahini: a Ty block.",
    servings: 4,
    prepTimeMinutes: 25,
    cookTimeMinutes: 12,
    cuisine: "Middle Eastern",
    course: "dinner",
    methodTags: ["grill"],
    ingredients: [
      { rawText: "1 lb ground lamb" },
      { rawText: "1 small onion, grated" },
      { rawText: "2 tsp cumin" },
      { rawText: "1/4 cup tahini" },
      { rawText: "1 lemon" },
      { rawText: "4 pita breads" },
    ],
    steps: [
      { text: "Mix lamb, onion, and spices. Shape onto skewers." },
      { text: "Grill 6 minutes a side. Whisk tahini with lemon and water." },
    ],
  }),
  full({
    slug: "honey-mustard-salmon",
    title: "Honey mustard salmon",
    description: "Ty loves salmon and blocks mustard, both on one card.",
    servings: 4,
    prepTimeMinutes: 5,
    cookTimeMinutes: 15,
    cuisine: "American",
    course: "dinner",
    methodTags: ["sheet_pan"],
    ingredients: [
      { rawText: "4 salmon fillets" },
      { rawText: "2 tbsp Dijon mustard" },
      { rawText: "2 tbsp honey" },
      { rawText: "1 tbsp olive oil" },
    ],
    steps: [{ text: "Whisk the glaze, brush the salmon, and roast at 400°F for 12 minutes." }],
  }),
  full({
    slug: "lentil-dal",
    title: "Red lentil dal",
    description: "Vegan one-pot dal. Safe for Nana's vegetarian rule.",
    servings: 6,
    prepTimeMinutes: 10,
    cookTimeMinutes: 30,
    cuisine: "Indian",
    course: "dinner",
    methodTags: ["freezer_friendly", "make_ahead"],
    ingredients: [
      { rawText: "1.5 cups red lentils" },
      { rawText: "1 yellow onion, diced" },
      { rawText: "1 tbsp ginger, grated" },
      { rawText: "1 tsp turmeric" },
      { rawText: "1 can diced tomatoes" },
      { rawText: "4 cups water" },
    ],
    steps: [
      { text: "Sweat the onion and ginger.", timers: [{ duration: 300, label: "Sweat onion" }] },
      {
        text: "Add lentils, spices, tomatoes, and water. Simmer until soft.",
        timers: [{ duration: 1500, label: "Simmer" }],
      },
    ],
  }),
  full({
    slug: "caprese-salad",
    title: "Caprese salad",
    description: "Three ingredients, no cooking.",
    servings: 2,
    prepTimeMinutes: 10,
    cuisine: "Italian",
    course: "salad",
    methodTags: ["no_cook"],
    ingredients: [
      { rawText: "2 ripe tomatoes" },
      { rawText: "8 oz fresh mozzarella" },
      { rawText: "1 handful basil leaves" },
    ],
    steps: [{ text: "Slice, layer, salt, and drizzle with oil." }],
  }),
  full({
    slug: "shakshuka",
    title: "Shakshuka",
    description: "Eggs poached in spiced tomato sauce.",
    servings: 3,
    prepTimeMinutes: 10,
    cookTimeMinutes: 25,
    cuisine: "Middle Eastern",
    course: "breakfast",
    ingredients: [
      { rawText: "1 can crushed tomatoes" },
      { rawText: "1 red bell pepper, sliced", preparation: "sliced" },
      { rawText: "1 onion, diced", preparation: "diced" },
      { rawText: "1 tsp smoked paprika" },
      { rawText: "5 eggs" },
      { rawText: "1/4 cup feta, crumbled (optional)", isOptional: true },
    ],
    steps: [
      { text: "Soften the pepper and onion, add paprika and tomatoes." },
      { text: "Make wells, crack in the eggs, and cover until set." },
    ],
  }),
  full({
    slug: "miso-soup",
    title: "Miso soup",
    description: "Soy (Ellie warns) and fish dashi.",
    servings: 4,
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    cuisine: "Japanese",
    course: "soup",
    ingredients: [
      { rawText: "4 cups dashi" },
      { rawText: "3 tbsp white miso" },
      { rawText: "1/2 block silken tofu, cubed" },
      { rawText: "2 scallions" },
      { rawText: "1 tbsp wakame" },
    ],
    steps: [{ text: "Warm the dashi, whisk in miso off the heat, add tofu and wakame." }],
  }),
  full({
    slug: "mac-and-cheese",
    title: "Stovetop mac and cheese",
    description: "Milk and wheat. Nutrition facts attached.",
    servings: 8,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    cuisine: "American",
    course: "dinner",
    nutrition: { perServing: true, calories: 520, protein: 19, carbohydrates: 48, fat: 27 },
    ingredients: [
      { rawText: "1 lb elbow macaroni" },
      { rawText: "3 cups whole milk" },
      { rawText: "3 tbsp butter" },
      { rawText: "3 tbsp flour" },
      { rawText: "3 cups sharp cheddar, grated" },
    ],
    steps: [
      { text: "Boil the pasta." },
      { text: "Make a roux, whisk in milk, melt in the cheese, and fold in the pasta." },
    ],
  }),
  full({
    slug: "cauliflower-tikka-masala",
    title: "Cauliflower tikka masala",
    description: "Cashew cream makes this a Jake block unless you swap it.",
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 35,
    cuisine: "Indian",
    course: "dinner",
    ingredients: [
      { rawText: "1 head cauliflower, cut into florets" },
      { rawText: "1/2 cup cashews, soaked", substitutionNotes: "sunflower seeds or heavy cream" },
      { rawText: "1 can crushed tomatoes" },
      { rawText: "2 tbsp garam masala" },
      { rawText: "1 onion" },
      { rawText: "3 cloves garlic" },
    ],
    steps: [
      { text: "Roast the cauliflower." },
      { text: "Blend cashews to cream. Simmer the sauce and fold in the cauliflower." },
    ],
  }),
  full({
    slug: "apple-pie",
    title: "Grandma's deep-dish apple pie with cheddar crust",
    description: "A long title and a family story on one recipe.",
    notes: "Use Granny Smith. Nana says never Red Delicious.",
    servings: 8,
    prepTimeMinutes: 45,
    cookTimeMinutes: 60,
    cuisine: "American",
    course: "dessert",
    difficulty: "hard",
    equipment: ["9-inch deep pie dish", "rolling pin"],
    after: "family",
    cookbook: "holiday",
    ingredients: [
      { rawText: "2.5 cups all-purpose flour" },
      { rawText: "1 cup cold butter, cubed" },
      { rawText: "1 cup sharp cheddar, grated" },
      { rawText: "6 Granny Smith apples" },
      { rawText: "3/4 cup sugar" },
      { rawText: "1 tbsp cinnamon" },
      { rawText: "1 egg, beaten" },
    ],
    steps: [
      { text: "Cut butter and cheddar into the flour. Chill the dough." },
      { text: "Toss apples with sugar and cinnamon. Fill, lid, and egg wash." },
      { text: "Bake at 375°F until bubbling.", timers: [{ duration: 3300, label: "Bake" }] },
    ],
  }),
  full({
    slug: "chicken-noodle-soup",
    title: "Chicken noodle soup",
    description: "Yield in quarts rather than servings alone.",
    servings: 8,
    yieldQuantity: 3,
    yieldUnit: "quarts",
    prepTimeMinutes: 15,
    cookTimeMinutes: 60,
    cuisine: "American",
    course: "soup",
    ingredients: [
      { rawText: "1 whole chicken" },
      { rawText: "3 carrots" },
      { rawText: "3 celery stalks" },
      { rawText: "1 onion" },
      { rawText: "8 oz egg noodles" },
      { rawText: "2 bay leaves" },
    ],
    steps: [
      { text: "Simmer the chicken with aromatics for 45 minutes." },
      { text: "Shred the meat, strain the broth, and cook the noodles in it." },
    ],
  }),
  full({
    slug: "eggplant-parmesan",
    title: "Eggplant parmesan",
    description: "Eggplant is an ingredient block for Ty. Long ingredient list.",
    servings: 6,
    prepTimeMinutes: 40,
    cookTimeMinutes: 45,
    cuisine: "Italian",
    course: "dinner",
    cookbook: "weeknight-extra",
    ingredients: [
      { rawText: "2 large eggplants" },
      { rawText: "1 tbsp kosher salt" },
      { rawText: "1 cup all-purpose flour" },
      { rawText: "3 eggs" },
      { rawText: "2 cups breadcrumbs" },
      { rawText: "1/2 cup grated parmesan" },
      { rawText: "1 tsp dried oregano" },
      { rawText: "1/2 cup olive oil" },
      { rawText: "3 cups marinara" },
      { rawText: "2 cups shredded mozzarella" },
      { rawText: "1/4 cup fresh basil" },
      { rawText: "2 cloves garlic" },
      { rawText: "1 tsp black pepper" },
      { rawText: "1 pinch red pepper flakes" },
    ],
    steps: [
      { text: "Salt the eggplant slices and let them drain." },
      { text: "Bread and shallow-fry the slices." },
      { text: "Layer with marinara and cheeses. Bake until bubbling." },
    ],
  }),
  full({
    slug: "pork-dumplings",
    title: "Pork and chive dumplings",
    description: "Sesame oil, wheat wrappers, and egg. Makes 40.",
    servings: 40,
    prepTimeMinutes: 60,
    cookTimeMinutes: 10,
    cuisine: "Chinese",
    course: "appetizer",
    methodTags: ["freezer_friendly"],
    ingredients: [
      { rawText: "1 lb ground pork" },
      { rawText: "1 bunch chives, minced" },
      { rawText: "1 tbsp sesame oil" },
      { rawText: "1 tbsp soy sauce" },
      { rawText: "1 egg" },
      { rawText: "40 round dumpling wrappers" },
    ],
    steps: [
      { text: "Mix the filling. Fill and pleat each wrapper." },
      { text: "Pan-fry, then steam with a splash of water." },
    ],
  }),
  // Imageless states below.
  full({
    slug: "overnight-oats",
    title: "Overnight oats",
    description: "Imported with low confidence: the servings field needs review.",
    needsReview: true,
    reviewReasons: ["Servings were not printed"],
    uncertainFields: ["servings"],
    prepTimeMinutes: 5,
    cuisine: "American",
    course: "breakfast",
    ingredients: [
      { rawText: "1 cup rolled oats" },
      { rawText: "1 cup milk" },
      { rawText: "1 tbsp chia seeds" },
      { rawText: "1 tbsp maple syrup" },
    ],
    steps: [{ text: "Stir everything together and chill overnight." }],
  }),
  full({
    slug: "quick-weeknight-ramen",
    title: "Quick weeknight ramen",
    description: "A draft someone started and never finished.",
    after: "draft",
    ingredients: [{ rawText: "1 pack instant ramen" }, { rawText: "1 egg" }],
    steps: [{ text: "Boil. Add the egg at the end." }],
  }),
  full({
    slug: "garlic-bread",
    title: "Garlic bread",
    description: "Soft-deleted so POST /api/v1/recipes/{id}/restore has a target.",
    after: "delete",
    servings: 6,
    cookTimeMinutes: 12,
    course: "side",
    ingredients: [
      { rawText: "1 baguette" },
      { rawText: "4 tbsp butter" },
      { rawText: "3 cloves garlic" },
    ],
    steps: [{ text: "Spread, wrap in foil, and bake." }],
  }),
  full({
    slug: "weekend-waffles",
    title: "Weekend waffles",
    description: "Saved from a URL, so importing the same link again is a duplicate.",
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    cuisine: "American",
    course: "breakfast",
    cookbook: "holiday",
    source: {
      type: "url",
      url: "https://example.com/recipes/weekend-waffles",
      canonicalUrl: "https://example.com/recipes/weekend-waffles",
      author: "Author C",
      importerName: "url-importer",
      importerVersion: "0.1.0",
    },
    ingredients: [
      { rawText: "2 cups flour" },
      { rawText: "2 eggs" },
      { rawText: "1.75 cups milk" },
      { rawText: "1/2 cup melted butter" },
      { rawText: "1 tbsp baking powder" },
    ],
    steps: [{ text: "Whisk, rest 10 minutes, and cook in a hot waffle iron." }],
  }),
  full({
    slug: "shortbread",
    title: "Nana's shortbread",
    description: "From a printed book, so the cookbook holding it cannot be shared.",
    servings: 16,
    prepTimeMinutes: 15,
    cookTimeMinutes: 25,
    cuisine: "Scottish",
    course: "dessert",
    cookbook: "holiday",
    source: {
      type: "pdf",
      author: "Author B",
      bookTitle: "A Synthetic Pantry",
      attribution: "A Synthetic Pantry, p. 2",
      pageStart: 5,
      pageEnd: 5,
      importerName: "pdf-importer",
      importerVersion: "0.1.0",
      licenseNote: "Cookbook/printed recipe - personal use only",
    },
    ingredients: [
      { rawText: "2 cups flour" },
      { rawText: "1 cup butter" },
      { rawText: "1/2 cup sugar" },
    ],
    steps: [{ text: "Rub the butter into the flour and sugar. Press and bake low." }],
  }),
];

/** The lake house: two people, two recipes, no plan. */
const LAKE_RECIPES: FullKitchenRecipe[] = [
  full({
    slug: "greek-salad",
    title: "Greek salad",
    servings: 4,
    prepTimeMinutes: 15,
    cuisine: "Greek",
    course: "salad",
    methodTags: ["no_cook"],
    ingredients: [
      { rawText: "3 tomatoes" },
      { rawText: "1 cucumber" },
      { rawText: "1/2 cup kalamata olives" },
      { rawText: "4 oz feta" },
    ],
    steps: [{ text: "Chop, toss with oil and oregano." }],
  }),
  full({
    slug: "banana-bread",
    title: "Banana bread",
    servings: 10,
    prepTimeMinutes: 15,
    cookTimeMinutes: 60,
    cuisine: "American",
    course: "dessert",
    ingredients: [
      { rawText: "3 ripe bananas" },
      { rawText: "1/2 cup butter" },
      { rawText: "1 cup sugar" },
      { rawText: "1 egg" },
      { rawText: "1.5 cups flour" },
    ],
    steps: [{ text: "Mash, mix, and bake at 350°F for an hour." }],
  }),
];

const ruleDefaults = (userId: string) => ({
  includeMayContain: false,
  includeCrossContact: false,
  sharedFacility: "ignore" as const,
  includeUnmappedIngredients: false,
  includeDescendants: true,
  treatCoconutAsTreeNut: false,
  label: null,
  note: null,
  setBy: userId,
  createdBy: userId,
});

export async function seedE2eKitchenFull(db: DbClient, seed: E2eKitchenSeed): Promise<void> {
  const { userId, householdId } = seed;
  const households = new HouseholdService(db);
  const people = new PeopleService(db);
  const recipes = new RecipeService(db);
  const cookbooks = new CookbookService(db);
  const plans = new PlanService(db);
  const keys = new ApiKeyService(db);
  const invites = new InviteService(db);

  // Users + memberships (Sam member, Nana viewer in Ty's kitchen).
  const users = [];
  for (const spec of E2E_FULL_USERS) {
    users.push(
      (await households.getUserByClerkId(spec.clerkUserId)) ??
        (await households.createUser({ ...spec }))
    );
  }
  const [sam, nana] = users;
  const memberOf = async (
    hh: string,
    uid: string,
    role: "owner" | "admin" | "member" | "viewer"
  ) => {
    const existing = (await households.getMembershipsForUser(uid)).find(
      (item) => item.householdId === hh
    );
    if (!existing) await households.createMembership({ userId: uid, householdId: hh, role });
  };
  if (sam) await memberOf(householdId, sam.id, "member");
  if (nana) await memberOf(householdId, nana.id, "viewer");

  // People and rules. createRule is a no-op when the same kind/target/severity exists.
  const existingPeople = (await people.listPeopleByHousehold(householdId, { limit: 40 })).items;
  const byName = new Map(existingPeople.map((person) => [person.displayName, person]));
  for (const spec of E2E_FULL_PEOPLE) {
    let person = byName.get(spec.displayName);
    if (!person) {
      person = await people.createPerson({
        householdId,
        userId: spec.displayName === "Sam" ? (sam?.id ?? null) : null,
        displayName: spec.displayName,
        birthYear: spec.birthYear ?? null,
        birthMonth: null,
        sex: null,
        activityProfile: null,
        notes: writePersonNotes({ emoji: spec.emoji, color: spec.color }),
        createdBy: userId,
      });
      byName.set(spec.displayName, person);
    }
    for (const rule of spec.rules) {
      await people.createRule({ personId: person.id, ...ruleDefaults(userId), ...rule });
    }
    const loves = await people.getPreferencesForPerson(person.id, "love");
    for (const value of spec.loves) {
      if (loves.some((item) => item.value === value)) continue;
      await people.createPreference({
        personId: person.id,
        type: "love",
        value,
        weight: 1,
        createdBy: userId,
      });
    }
  }
  for (const { person: name, rule } of E2E_FULL_EXTRA_RULES) {
    const person = byName.get(name);
    if (person) await people.createRule({ personId: person.id, ...ruleDefaults(userId), ...rule });
  }

  // Cookbooks.
  const books = await cookbooks.listCookbookCards(householdId);
  const bookNamed = async (name: string, description: string) =>
    books.find((book) => book.name === name) ??
    (await cookbooks.createCookbook({ householdId, name, description, createdBy: userId }));
  const holiday = await bookNamed("Holiday baking", "Pies, waffles, and a printed-book shortbread");
  const weeknight = books.find((book) => /weeknight dinners/i.test(book.name));

  // Recipes, guarded by the slug the title produces (deleted ones are looked up in the trash).
  const created = new Map<string, string>();
  for (const draft of E2E_FULL_RECIPES) {
    const slug = slugifyTitle(draft.title);
    const existing = await recipes.getRecipeBySlug(householdId, slug);
    if (existing) {
      created.set(draft.slug, existing.id);
      continue;
    }
    if (draft.after === "delete") {
      // getRecipeBySlug skips the trash, so look there before re-creating the deleted one.
      const trashed = await db
        .select({ id: recipe.id })
        .from(recipe)
        .where(and(eq(recipe.householdId, householdId), eq(recipe.slug, slug)))
        .limit(1);
      if (trashed.length > 0) continue;
    }
    const details = await recipes.createRecipeFromDraft(draft, { householdId, createdBy: userId });
    created.set(draft.slug, details.id);
    if (draft.after === "draft") await recipes.updateRecipe(details.id, { status: "draft" });
    if (draft.after === "family") {
      await recipes.updateRecipe(details.id, {
        isFamilyRecipe: true,
        familyStory: "Grandma baked this every Thanksgiving; the cheddar crust was her secret.",
      });
    }
    if (draft.after === "delete") await recipes.deleteRecipe(details.id);
    if (draft.cookbook === "holiday") await cookbooks.addRecipe(holiday.id, details.id);
    if (draft.cookbook === "weeknight-extra" && weeknight) {
      await cookbooks.addRecipe(weeknight.id, details.id);
    }
  }

  // Plans: last week approved with a check report and shopping state; next week draft
  // flagged needs_recheck with undo history. This week stays as the base seed made it.
  const weekStart = startOfWeekMonday();
  const lastWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const existingPlans = (await plans.listMealPlans(householdId, { pagination: { limit: 40 } }))
    .items;
  const attendees = (await people.listPeopleByHousehold(householdId, { limit: 40 })).items.map(
    (person) => person.id
  );
  const recipeId = (slug: string) => created.get(slug);
  if (!existingPlans.some((plan) => plan.weekStart === lastWeek)) {
    const plan = await plans.createMealPlan({
      householdId,
      weekStart: lastWeek,
      status: "approved",
      cookFor: 7,
      acknowledgedWarnings: [],
      needsRecheck: false,
      createdBy: userId,
    });
    const nights: Array<[number, string | undefined, number | null]> = [
      [0, recipeId("lentil-dal"), null],
      [1, recipeId("honey-mustard-salmon"), 8],
      [2, recipeId("mac-and-cheese"), null],
      [4, recipeId("thai-green-curry"), null],
    ];
    for (const [offset, id, servings] of nights) {
      if (!id) continue;
      await plans.createMealPlanEntry({
        mealPlanId: plan.id,
        date: addDays(lastWeek, offset),
        mealSlot: "dinner",
        recipeId: id,
        servings,
        attendees,
      });
    }
    await plans.createMealPlanEntry({
      mealPlanId: plan.id,
      date: addDays(lastWeek, 3),
      mealSlot: "dinner",
      recipeId: null,
      freeformMeal: "Leftovers",
      servings: null,
      attendees,
    });
    await plans.updateMealPlan(plan.id, {
      shoppingState: {
        checkedKeys: [shopItemKey("red lentils", "cup"), shopItemKey("salmon fillets")],
        extras: [{ key: "paper-towels", name: "Paper towels" }],
      },
    });
    try {
      await persistMealPlanCheck(plan.id, householdId);
    } catch (error) {
      console.warn("Full seed: plan check skipped", error);
    }
  }
  if (!existingPlans.some((plan) => plan.weekStart === nextWeek)) {
    const plan = await plans.createMealPlan({
      householdId,
      weekStart: nextWeek,
      status: "draft",
      acknowledgedWarnings: [],
      needsRecheck: false,
      createdBy: userId,
    });
    const first = recipeId("eggplant-parmesan");
    const second = recipeId("shrimp-pad-thai");
    if (first) {
      await plans.createMealPlanEntry({
        mealPlanId: plan.id,
        date: nextWeek,
        mealSlot: "dinner",
        recipeId: first,
        servings: null,
        attendees,
      });
    }
    await plans.recordPlanRevision(plan.id, "merge");
    if (second) {
      await plans.createMealPlanEntry({
        mealPlanId: plan.id,
        date: addDays(nextWeek, 1),
        mealSlot: "dinner",
        recipeId: second,
        servings: null,
        attendees,
      });
    }
    await plans.updateMealPlan(plan.id, { needsRecheck: true });
  }

  // Schedule: busy Tuesday, short Thursday. replaceSchedule soft-deletes and re-inserts, so set it once.
  const scheduled = await db
    .select({ id: scheduleTemplate.id })
    .from(scheduleTemplate)
    .where(and(eq(scheduleTemplate.householdId, householdId), isNull(scheduleTemplate.deletedAt)))
    .limit(1);
  if (scheduled.length === 0) {
    await new ScheduleService(db).replaceSchedule(
      householdId,
      [
        { dayOfWeek: 2, busyLevel: "high" },
        { dayOfWeek: 4, busyLevel: "medium", timeBudgetMinutes: 30 },
      ],
      userId
    );
  }

  // Keys: a scoped read-only one and a revoked one.
  const existingKeys = await keys.listForHousehold(householdId);
  if (!existingKeys.some((key) => key.name === "Read-only agent")) {
    await keys.create(
      {
        householdId,
        name: "Read-only agent",
        scopes: ["recipes:read", "plans:read", "people:read"],
      },
      userId
    );
  }
  if (!existingKeys.some((key) => key.name === "Old key")) {
    const old = await keys.create(
      { householdId, name: "Old key", scopes: ["recipes:read"] },
      userId
    );
    await keys.revoke(old.id, householdId);
  }

  // Second kitchen: Ty is admin (not owner), Sam owner, Nana viewer; fixed 6 servings; a pending invite.
  let lake = await households.getHouseholdBySlug(E2E_FULL_HOUSEHOLD_SLUG);
  if (!lake) {
    lake = await households.createHousehold({
      name: E2E_FULL_HOUSEHOLD_NAME,
      slug: E2E_FULL_HOUSEHOLD_SLUG,
      clerkOrgId: null,
      createdBy: sam?.id ?? userId,
    });
    await households.updateServingsSettings(lake.id, { mode: "fixed", servings: 6 });
  }
  if (sam) await memberOf(lake.id, sam.id, "owner");
  await memberOf(lake.id, userId, "admin");
  if (nana) await memberOf(lake.id, nana.id, "viewer");
  if ((await people.listPeopleByHousehold(lake.id, { limit: 10 })).items.length === 0) {
    for (const [name, emoji, color] of [
      ["Bec", "👩", "#db5a9a"],
      ["Sam", "🧢", "#2a9d8f"],
    ] as const) {
      await people.createPerson({
        householdId: lake.id,
        userId: name === "Sam" ? (sam?.id ?? null) : null,
        displayName: name,
        birthYear: null,
        birthMonth: null,
        sex: null,
        activityProfile: null,
        notes: writePersonNotes({ emoji, color }),
        createdBy: userId,
      });
    }
  }
  for (const draft of LAKE_RECIPES) {
    if (await recipes.getRecipeBySlug(lake.id, slugifyTitle(draft.title))) continue;
    await recipes.createRecipeFromDraft(draft, { householdId: lake.id, createdBy: userId });
  }
  if ((await invites.listPendingInvites(lake.id, "admin")).length === 0) {
    await invites.createInvite(
      lake.id,
      { role: "member", expiresInDays: 7 },
      { userId, role: "admin" }
    );
  }
}
