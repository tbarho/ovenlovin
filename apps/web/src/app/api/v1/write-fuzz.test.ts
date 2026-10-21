import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ID = "550e8400-e29b-41d4-a716-446655440000";
const HH = "22222222-2222-4222-8222-222222222222";

vi.mock("@ovenlovin/db", () => ({
  getDatabase: () => ({}),
}));

vi.mock("@/lib/api/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/middleware")>();
  return {
    ...actual,
    getRequestContext: async () => ({
      userId: "11111111-1111-4111-8111-111111111111",
      householdId: HH,
      membershipRole: "owner" as const,
      clientId: undefined,
    }),
  };
});

const row = {
  id: ID,
  householdId: HH,
  title: "Toast",
  name: "Dinners",
  displayName: "Parent A",
  images: [],
  ingredients: [],
  steps: [],
  token: "invite-token-value",
  plaintext: "rkapi_test",
  keyPrefix: "rkapi",
  scopes: ["recipes:read"],
  items: [],
  weekStart: "2026-10-12",
};

function serviceStub() {
  return class {
    constructor() {
      return new Proxy(
        {},
        {
          get: (_target, key) => {
            if (key === "then") return undefined;
            const name = String(key);
            if (name.includes("Membership") || name === "getMembershipsForUser") {
              return async () => [];
            }
            if (name.startsWith("list")) {
              return async () => ({ items: [row], nextCursor: null, hasMore: false });
            }
            if (name.includes("Settings") || name.endsWith("For")) {
              return async () => ({
                mode: "family",
                servings: null,
                familySize: 5,
                defaultCookFor: 5,
              });
            }
            return async () => row;
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
    HouseholdService: Service,
    ScheduleService: Service,
    InviteService: Service,
    ApiKeyService: Service,
  };
});

vi.mock("@/lib/import-save", () => ({
  saveImportedRecipe: async () => ({
    result: { outcome: "created", recipe: row },
    quota: null,
  }),
  recipeFromPersist: (value: { recipe?: unknown }) => value.recipe ?? row,
  withDemoImportQuota: (value: unknown) => value,
  isIdempotentReplay: () => false,
  presentImportPreview: (value: unknown) => value,
  wantsPersist: () => false,
  demoImportQuota: async () => null,
  conflictFromImportResult: () => new Error("conflict"),
  replayOrDuplicateUrlImport: () => ({ kind: "replay", recipe: row }),
}));

vi.mock("@/lib/run-meal-plan-check", () => ({
  persistMealPlanCheck: async () => ({ status: "complete", findings: [] }),
  runMealPlanCheck: async () => ({ status: "complete", findings: [] }),
}));

vi.mock("@/lib/blob-store", () => ({
  createVercelImagePut: () => undefined,
}));

vi.mock("@/lib/origin", () => ({
  resolveOrigin: () => "https://kitchen.example",
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ set: () => undefined, delete: () => undefined }),
}));

type Handler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<Response>;

function asHandler(fn: unknown): Handler {
  return fn as Handler;
}

const WRITE_ROUTES: Array<{
  name: string;
  method: "POST" | "PATCH" | "PUT";
  path: string;
  params?: Record<string, string>;
  load: () => Promise<Handler>;
}> = [
  {
    name: "POST /recipes",
    method: "POST",
    path: "/api/v1/recipes",
    load: async () => asHandler((await import("./recipes/route")).POST),
  },
  {
    name: "PATCH /recipes/{id}",
    method: "PATCH",
    path: `/api/v1/recipes/${ID}`,
    params: { id: ID },
    load: async () => asHandler((await import("./recipes/[id]/route")).PATCH),
  },
  {
    name: "POST /recipes/{id}/image",
    method: "POST",
    path: `/api/v1/recipes/${ID}/image`,
    params: { id: ID },
    load: async () => asHandler((await import("./recipes/[id]/image/route")).POST),
  },
  {
    name: "POST /recipes/{id}/restore",
    method: "POST",
    path: `/api/v1/recipes/${ID}/restore`,
    params: { id: ID },
    load: async () => asHandler((await import("./recipes/[id]/restore/route")).POST),
  },
  {
    name: "POST /recipes/import",
    method: "POST",
    path: "/api/v1/recipes/import",
    load: async () => asHandler((await import("./recipes/import/route")).POST),
  },
  {
    name: "POST /recipes/import/photo",
    method: "POST",
    path: "/api/v1/recipes/import/photo",
    load: async () => asHandler((await import("./recipes/import/photo/route")).POST),
  },
  {
    name: "POST /recipes/import/page",
    method: "POST",
    path: "/api/v1/recipes/import/page",
    load: async () => asHandler((await import("./recipes/import/page/route")).POST),
  },
  {
    name: "POST /uploads/images",
    method: "POST",
    path: "/api/v1/uploads/images",
    load: async () => asHandler((await import("./uploads/images/route")).POST),
  },
  {
    name: "POST /cookbooks",
    method: "POST",
    path: "/api/v1/cookbooks",
    load: async () => asHandler((await import("./cookbooks/route")).POST),
  },
  {
    name: "PATCH /cookbooks/{id}",
    method: "PATCH",
    path: `/api/v1/cookbooks/${ID}`,
    params: { id: ID },
    load: async () => asHandler((await import("./cookbooks/[id]/route")).PATCH),
  },
  {
    name: "POST /cookbooks/{id}/recipes",
    method: "POST",
    path: `/api/v1/cookbooks/${ID}/recipes`,
    params: { id: ID },
    load: async () => asHandler((await import("./cookbooks/[id]/recipes/route")).POST),
  },
  {
    name: "POST /people",
    method: "POST",
    path: "/api/v1/people",
    load: async () => asHandler((await import("./people/route")).POST),
  },
  {
    name: "PATCH /people/{id}",
    method: "PATCH",
    path: `/api/v1/people/${ID}`,
    params: { id: ID },
    load: async () => asHandler((await import("./people/[id]/route")).PATCH),
  },
  {
    name: "POST /people/{id}/rules",
    method: "POST",
    path: `/api/v1/people/${ID}/rules`,
    params: { id: ID },
    load: async () => asHandler((await import("./people/[id]/rules/route")).POST),
  },
  {
    name: "PATCH /people/{id}/rules/{ruleId}",
    method: "PATCH",
    path: `/api/v1/people/${ID}/rules/${ID}`,
    params: { id: ID, ruleId: ID },
    load: async () => asHandler((await import("./people/[id]/rules/[ruleId]/route")).PATCH),
  },
  {
    name: "POST /people/{id}/preferences",
    method: "POST",
    path: `/api/v1/people/${ID}/preferences`,
    params: { id: ID },
    load: async () => asHandler((await import("./people/[id]/preferences/route")).POST),
  },
  {
    name: "POST /people/reorder",
    method: "POST",
    path: "/api/v1/people/reorder",
    load: async () => asHandler((await import("./people/reorder/route")).POST),
  },
  {
    name: "POST /meal-plans",
    method: "POST",
    path: "/api/v1/meal-plans",
    load: async () => asHandler((await import("./meal-plans/route")).POST),
  },
  {
    name: "PATCH /meal-plans/{id}",
    method: "PATCH",
    path: `/api/v1/meal-plans/${ID}`,
    params: { id: ID },
    load: async () => asHandler((await import("./meal-plans/[id]/route")).PATCH),
  },
  {
    name: "POST /meal-plans/{id}/check",
    method: "POST",
    path: `/api/v1/meal-plans/${ID}/check`,
    params: { id: ID },
    load: async () => asHandler((await import("./meal-plans/[id]/check/route")).POST),
  },
  {
    name: "POST /meal-plans/{id}/undo",
    method: "POST",
    path: `/api/v1/meal-plans/${ID}/undo`,
    params: { id: ID },
    load: async () => asHandler((await import("./meal-plans/[id]/undo/route")).POST),
  },
  {
    name: "PATCH /meal-plans/{id}/shopping-list/state",
    method: "PATCH",
    path: `/api/v1/meal-plans/${ID}/shopping-list/state`,
    params: { id: ID },
    load: async () =>
      asHandler((await import("./meal-plans/[id]/shopping-list/state/route")).PATCH),
  },
  {
    name: "PATCH /households",
    method: "PATCH",
    path: "/api/v1/households",
    load: async () => asHandler((await import("./households/route")).PATCH),
  },
  {
    name: "PUT /households/schedule",
    method: "PUT",
    path: "/api/v1/households/schedule",
    load: async () => asHandler((await import("./households/schedule/route")).PUT),
  },
  {
    name: "POST /households/select",
    method: "POST",
    path: "/api/v1/households/select",
    load: async () => asHandler((await import("./households/select/route")).POST),
  },
  {
    name: "PATCH /households/settings",
    method: "PATCH",
    path: "/api/v1/households/settings",
    load: async () => asHandler((await import("./households/settings/route")).PATCH),
  },
  {
    name: "POST /households/invites",
    method: "POST",
    path: "/api/v1/households/invites",
    load: async () => asHandler((await import("./households/invites/route")).POST),
  },
  {
    name: "PATCH /households/members/{userId}",
    method: "PATCH",
    path: `/api/v1/households/members/${ID}`,
    params: { userId: ID },
    load: async () => asHandler((await import("./households/members/[userId]/route")).PATCH),
  },
  {
    name: "POST /households/leave",
    method: "POST",
    path: "/api/v1/households/leave",
    load: async () => asHandler((await import("./households/leave/route")).POST),
  },
  {
    name: "POST /api-keys",
    method: "POST",
    path: "/api/v1/api-keys",
    load: async () => asHandler((await import("./api-keys/route")).POST),
  },
  {
    name: "POST /invites/{token}/accept",
    method: "POST",
    path: `/api/v1/invites/${ID}/accept`,
    params: { token: ID },
    load: async () => asHandler((await import("./invites/[token]/accept/route")).POST),
  },
];

const PAYLOADS: Array<{ name: string; body: BodyInit | null; contentType?: string }> = [
  {
    name: "wrong-types",
    body: JSON.stringify({
      name: 12345,
      title: 12345,
      displayName: 12345,
      recipeId: true,
      kind: 1,
      target: 1,
      type: 1,
      value: 1,
      week: "nope",
      imageUrl: 1,
      imageUrls: 1,
      source: 1,
      personIds: 1,
    }),
  },
  {
    name: "huge",
    body: JSON.stringify({
      name: "x".repeat(200_000),
      title: "x".repeat(200_000),
      displayName: "x".repeat(200_000),
      target: "x".repeat(200_000),
      value: "x".repeat(200_000),
      imageUrl: "x".repeat(200_000),
      week: Array.from({ length: 2000 }, () => "x"),
      personIds: Array.from({ length: 2000 }, () => ID),
      ingredients: Array.from({ length: 2000 }, () => ({ rawText: "x" })),
    }),
  },
  { name: "empty", body: JSON.stringify({}) },
  { name: "null", body: "null" },
];

describe("REST write fuzz", () => {
  it("never returns 5xx for wrong-types, huge, empty, or null bodies", async () => {
    const failures: string[] = [];
    for (const route of WRITE_ROUTES) {
      const handler = await route.load();
      for (const payload of PAYLOADS) {
        const response = await handler(
          new NextRequest(`http://localhost${route.path}`, {
            method: route.method,
            headers: { "content-type": "application/json" },
            body: payload.body,
          }),
          route.params ? { params: Promise.resolve(route.params) } : undefined
        );
        if (response.status >= 500) {
          failures.push(`${route.name} ${payload.name} → ${response.status}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
