import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { HouseholdAccessError } from "@ovenlovin/core";

const OTHER = "11111111-1111-4111-8111-111111111111";
const CALLER = "22222222-2222-4222-8222-222222222222";
const ID = "550e8400-e29b-41d4-a716-446655440000";
const RULE = "660e8400-e29b-41d4-a716-446655440000";

vi.mock("@ovenlovin/db", () => ({
  getDatabase: () => ({}),
}));

vi.mock("@/lib/api/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/middleware")>();
  return {
    ...actual,
    getRequestContext: async () => ({
      userId: "33333333-3333-4333-8333-333333333333",
      householdId: CALLER,
      membershipRole: "owner" as const,
      clientId: "key-from-kitchen-b",
    }),
  };
});

const otherKitchen = {
  id: ID,
  householdId: OTHER,
  title: "Other kitchen pesto",
  name: "Other cookbook",
  displayName: "Parent A",
  personId: ID,
  weekStart: "2026-10-12",
  shoppingState: null,
  images: [],
  ingredients: [],
  steps: [],
};

const writes: string[] = [];
let mealPlanHousehold = OTHER;

function rejectForeignIds(message: string) {
  return async (_householdId: string, ids: Iterable<string | null | undefined>) => {
    if (![...ids].some(Boolean)) return;
    throw new HouseholdAccessError(message, "not_found");
  };
}

function serviceStub() {
  return class {
    constructor() {
      return new Proxy(
        {},
        {
          get: (_target, key) => {
            if (key === "then") return undefined;
            const name = String(key);
            if (name === "requireOwnedRecipeIds") {
              return rejectForeignIds("Recipe not found");
            }
            if (name === "requireOwnedPersonIds") {
              return rejectForeignIds("Person not found");
            }
            if (name === "getMealPlan") {
              return async () => ({
                ...otherKitchen,
                householdId: mealPlanHousehold,
                status: "draft",
              });
            }
            if (
              name === "updateMealPlan" ||
              name === "replaceMealPlanEntries" ||
              name === "mergeMealPlanEntries"
            ) {
              return async () => {
                writes.push(name);
                return otherKitchen;
              };
            }
            return async () => otherKitchen;
          },
        }
      );
    }
  };
}

vi.mock("@ovenlovin/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ovenlovin/core")>();
  const Service = serviceStub();
  return {
    ...actual,
    RecipeService: Service,
    PeopleService: Service,
    CookbookService: Service,
    PlanService: Service,
    ApiKeyService: Service,
  };
});

vi.mock("@/lib/kitchen-servings", () => ({
  loadKitchenServingsSettings: async () => ({
    mode: "family",
    servings: null,
    familySize: 5,
    defaultCookFor: 5,
  }),
  presentRecipeForKitchen: (recipe: unknown) => recipe,
}));

vi.mock("@/lib/recipe-media", () => ({
  presentRecipeDetailsForApi: (recipe: unknown) => recipe,
  presentListedRecipe: (recipe: unknown) => recipe,
  requestApiOrigin: () => "https://kitchen.example",
}));

type Handler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<Response>;

function asHandler(fn: unknown): Handler {
  return fn as Handler;
}

async function get(path: string, params: Record<string, string>, load: () => Promise<Handler>) {
  const handler = await load();
  return handler(new NextRequest(`http://localhost${path}`), { params: Promise.resolve(params) });
}

async function expect404(response: Response, detail: RegExp) {
  expect(response.status).toBe(404);
  expect(response.headers.get("content-type")).toMatch(/problem\+json/);
  const body = (await response.json()) as { title?: string; detail?: string };
  expect(body.title).toBe("Not Found");
  expect(body.detail).toMatch(detail);
}

const FAMILIES: Array<{
  name: string;
  path: (id: string) => string;
  params: (id: string) => Record<string, string>;
  load: () => Promise<Handler>;
  otherDetail: RegExp;
  malformedDetail: RegExp;
}> = [
  {
    name: "shopping list",
    path: (id) => `/api/v1/meal-plans/${id}/shopping-list`,
    params: (id) => ({ id }),
    load: async () => asHandler((await import("./meal-plans/[id]/shopping-list/route")).GET),
    otherDetail: /MealPlan/,
    malformedDetail: /MealPlan with id x not found/,
  },
  {
    name: "meal plan",
    path: (id) => `/api/v1/meal-plans/${id}`,
    params: (id) => ({ id }),
    load: async () => asHandler((await import("./meal-plans/[id]/route")).GET),
    otherDetail: /MealPlan/,
    malformedDetail: /MealPlan with id x not found/,
  },
  {
    name: "recipe",
    path: (id) => `/api/v1/recipes/${id}`,
    params: (id) => ({ id }),
    load: async () => asHandler((await import("./recipes/[id]/route")).GET),
    otherDetail: /Recipe/,
    malformedDetail: /Recipe with id x not found/,
  },
  {
    name: "person",
    path: (id) => `/api/v1/people/${id}`,
    params: (id) => ({ id }),
    load: async () => asHandler((await import("./people/[id]/route")).GET),
    otherDetail: /Person/,
    malformedDetail: /Person with id x not found/,
  },
  {
    name: "cookbook",
    path: (id) => `/api/v1/cookbooks/${id}`,
    params: (id) => ({ id }),
    load: async () => asHandler((await import("./cookbooks/[id]/route")).GET),
    otherDetail: /Cookbook/,
    malformedDetail: /Cookbook with id x not found/,
  },
  {
    name: "person rule",
    path: (id) => `/api/v1/people/${id}/rules/${RULE}`,
    params: (id) => ({ id, ruleId: RULE }),
    load: async () => asHandler((await import("./people/[id]/rules/[ruleId]/route")).GET),
    otherDetail: /Person/,
    malformedDetail: /Person with id x not found/,
  },
];

describe("REST resource ids", () => {
  it("404s a second kitchen's key on the shopping list and one id route per family", async () => {
    for (const family of FAMILIES) {
      const response = await get(family.path(ID), family.params(ID), family.load);
      await expect404(response, family.otherDetail);
    }
  });

  it("404s a second kitchen's recipe on a meal plan write", async () => {
    const handler = asHandler((await import("./meal-plans/route")).POST);
    const response = await handler(
      new NextRequest("http://localhost/api/v1/meal-plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weekStart: "2026-10-13",
          entries: [{ date: "2026-10-13", meal: "dinner", recipeId: ID }],
        }),
      }),
      { params: Promise.resolve({}) }
    );
    await expect404(response, /Recipe not found/);
  });

  async function patchPlan(body: unknown) {
    writes.length = 0;
    mealPlanHousehold = CALLER;
    const handler = asHandler((await import("./meal-plans/[id]/route")).PATCH);
    try {
      return await handler(
        new NextRequest(`http://localhost/api/v1/meal-plans/${ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: ID }) }
      );
    } finally {
      mealPlanHousehold = OTHER;
    }
  }

  it("404s a second kitchen's recipe on PATCH before saving status", async () => {
    const response = await patchPlan({
      status: "approved",
      entries: [{ date: "2026-10-13", meal: "dinner", recipeId: ID }],
    });
    await expect404(response, /Recipe not found/);
    expect(writes).toEqual([]);
  });

  it("404s a second kitchen's attendee on a meal plan write", async () => {
    const response = await patchPlan({
      entries: [{ date: "2026-10-13", meal: "dinner", attendees: [ID] }],
    });
    await expect404(response, /Person not found/);
    expect(writes).toEqual([]);
  });

  it("404s a malformed id instead of 500", async () => {
    for (const family of FAMILIES) {
      const response = await get(family.path("x"), family.params("x"), family.load);
      expect(response.status).not.toBe(500);
      await expect404(response, family.malformedDetail);
    }
  });
});
