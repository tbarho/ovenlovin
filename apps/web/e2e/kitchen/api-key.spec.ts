import { expect, test, type APIRequestContext } from "@playwright/test";

type Tool = {
  name: string;
  inputSchema?: { type?: string; properties?: Record<string, unknown>; required?: string[] };
};

async function createKitchenKey(request: APIRequestContext): Promise<string> {
  const created = await request.post("/api/v1/api-keys", {
    data: { name: "e2e rest+mcp key" },
  });
  expect(created.status(), await created.text()).toBe(201);
  const body = (await created.json()) as { plaintext?: string };
  expect(body.plaintext).toMatch(/^rkapi_[a-f0-9]+$/);
  return body.plaintext!;
}

async function mcp(
  request: APIRequestContext,
  key: string,
  id: number,
  method: string,
  params?: unknown
) {
  return request.post("/mcp", {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    data: { jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) },
  });
}

test.describe("REST + MCP with a real API key", () => {
  test("accepts the key on REST, returns JSON 401 for a bad key, and stays stateless on MCP", async ({
    request,
  }) => {
    const key = await createKitchenKey(request);

    for (const path of [
      "/api/v1/recipes",
      "/api/v1/cookbooks",
      "/api/v1/people",
      "/api/v1/meal-plans",
    ]) {
      const ok = await request.get(path, { headers: { Authorization: `ApiKey ${key}` } });
      expect(ok.status(), `${path} ${await ok.text()}`).toBe(200);
      expect(ok.headers()["content-type"] ?? "").toMatch(/json/);
      const body = await ok.json();
      expect(body).toHaveProperty("items");
    }

    const recipes = await request.get("/api/v1/recipes", {
      headers: { Authorization: `apikey ${key}` },
    });
    expect(recipes.status()).toBe(200);
    const list = (await recipes.json()) as { items: Array<{ title: string }> };
    expect(list.items.some((recipe) => /pesto pasta/i.test(recipe.title))).toBe(true);

    const denied = await request.get("/api/v1/recipes", {
      headers: { Authorization: "ApiKey rkapi_deadbeef" },
    });
    expect(denied.status()).toBe(401);
    expect(denied.headers()["content-type"] ?? "").toMatch(/problem\+json|json/);
    const problem = (await denied.json()) as { title?: string; status?: number; detail?: string };
    expect(problem.status).toBe(401);
    expect(problem.title).toBe("Unauthorized");
    expect(problem.detail).toMatch(/api key/i);
    expect(await denied.text()).not.toMatch(/<!DOCTYPE html>/i);

    const init = await mcp(request, key, 1, "initialize", {});
    expect(init.status(), await init.text()).toBe(200);
    const tools1 = await mcp(request, key, 2, "tools/list");
    const tools2 = await mcp(request, key, 3, "tools/list");
    expect(tools1.status()).toBe(200);
    expect(tools2.status()).toBe(200);

    const listed = (await tools1.json()) as {
      error?: { message?: string };
      result?: { tools: Tool[] };
    };
    expect(listed.error).toBeUndefined();
    expect(JSON.stringify(listed)).not.toMatch(/Already connected/i);
    expect(listed.result?.tools.length).toBeGreaterThanOrEqual(13);
    for (const tool of listed.result?.tools ?? []) {
      expect(tool.inputSchema?.type).toBe("object");
      expect(tool.inputSchema).not.toEqual({ type: "object", properties: {}, required: [] });
    }

    const search = listed.result?.tools.find((tool) => tool.name === "search_recipes");
    expect(search?.inputSchema?.properties).toHaveProperty("query");

    const context = await mcp(request, key, 4, "tools/call", {
      name: "get_household_context",
      arguments: {},
    });
    expect(context.status()).toBe(200);
    const called = (await context.json()) as {
      error?: { message?: string };
      result?: { content?: Array<{ text?: string }> };
    };
    expect(called.error, JSON.stringify(called)).toBeUndefined();
    const text =
      called.result?.content?.map((part) => part.text).join("\n") ?? JSON.stringify(called);
    expect(text).not.toMatch(/\bstub\b/i);
    expect(text).toMatch(/e2e-kitchen|Ty's kitchen|Jake/i);
  });

  test("REST meal-plan POST and PATCH persist entries and reject unknown fields", async ({
    request,
  }) => {
    const key = await createKitchenKey(request);
    const headers = { Authorization: `ApiKey ${key}` };

    const recipes = await request.get("/api/v1/recipes", { headers });
    expect(recipes.status()).toBe(200);
    const recipeId = ((await recipes.json()) as { items: Array<{ id: string }> }).items[0]?.id;
    expect(recipeId).toBeTruthy();

    const people = await request.get("/api/v1/people", { headers });
    expect(people.status()).toBe(200);
    const personId = ((await people.json()) as { items: Array<{ id: string }> }).items[0]?.id;
    expect(personId).toBeTruthy();

    const rejected = await request.post("/api/v1/meal-plans", {
      headers,
      data: { weekStart: "2026-11-09", name: "should not be silently dropped" },
    });
    expect(rejected.status(), await rejected.text()).toBe(400);
    expect(rejected.headers()["content-type"] ?? "").toMatch(/problem\+json|json/);

    const created = await request.post("/api/v1/meal-plans", {
      headers,
      data: {
        weekStart: "2026-11-09",
        status: "draft",
        entries: [
          {
            date: "2026-11-09",
            meal: "dinner",
            recipeId,
            servings: 4,
            attendees: [personId],
          },
        ],
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const createdBody = (await created.json()) as {
      id?: string;
      entries?: Array<{ mealSlot?: string; recipeId?: string | null }>;
    };
    expect(createdBody.id).toBeTruthy();
    expect(createdBody.entries).toHaveLength(1);
    expect(createdBody.entries?.[0]?.mealSlot).toBe("dinner");
    expect(createdBody.entries?.[0]?.recipeId).toBe(recipeId);
    const planId = createdBody.id!;

    try {
      const loaded = await request.get(`/api/v1/meal-plans/${planId}`, { headers });
      expect(loaded.status()).toBe(200);
      const loadedBody = (await loaded.json()) as {
        entries?: Array<{ mealSlot?: string; recipeId?: string | null }>;
      };
      expect(loadedBody.entries).toHaveLength(1);

      const unknownPatch = await request.patch(`/api/v1/meal-plans/${planId}`, {
        headers,
        data: { status: "draft", generator: "should-400" },
      });
      expect(unknownPatch.status(), await unknownPatch.text()).toBe(400);

      const patched = await request.patch(`/api/v1/meal-plans/${planId}`, {
        headers,
        data: {
          status: "approved",
          entries: [
            {
              date: "2026-11-10",
              meal: "lunch",
              recipeId,
              servings: 2,
              attendees: [personId],
            },
          ],
        },
      });
      expect(patched.status(), await patched.text()).toBe(200);
      const patchedBody = (await patched.json()) as {
        status?: string;
        entries?: Array<{ date?: string; mealSlot?: string }>;
      };
      expect(patchedBody.status).toBe("approved");
      expect(patchedBody.entries).toHaveLength(1);
      expect(patchedBody.entries?.[0]?.date).toBe("2026-11-10");
      expect(patchedBody.entries?.[0]?.mealSlot).toBe("lunch");
    } finally {
      await request.delete(`/api/v1/meal-plans/${planId}`, { headers });
    }
  });

  test("deletes a TEST Olive Cookbook if one exists in this kitchen", async ({ request }) => {
    const key = await createKitchenKey(request);
    const headers = { Authorization: `ApiKey ${key}` };
    const listed = await request.get("/api/v1/cookbooks", { headers });
    expect(listed.status()).toBe(200);
    const body = (await listed.json()) as { items: Array<{ id: string; name: string }> };
    const orphans = body.items.filter((book) => /TEST Olive Cookbook/i.test(book.name));
    for (const book of orphans) {
      const deleted = await request.delete(`/api/v1/cookbooks/${book.id}`, { headers });
      expect([200, 204]).toContain(deleted.status());
    }
  });
});
