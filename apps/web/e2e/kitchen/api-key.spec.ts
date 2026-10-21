import { expect, test, type APIRequestContext } from "@playwright/test";

type Tool = {
  name: string;
  inputSchema?: { type?: string; properties?: Record<string, unknown>; required?: string[] };
};

function parseMcpToolJson<T>(body: {
  error?: { message?: string };
  result?: { content?: Array<{ text?: string }> };
}): T {
  expect(body.error, JSON.stringify(body)).toBeUndefined();
  const text = body.result?.content?.map((part) => part.text).join("\n") ?? "";
  expect(text.length, JSON.stringify(body)).toBeGreaterThan(0);
  return JSON.parse(text) as T;
}

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

  test("API-key callers can save a meal plan and add a person rule", async ({ request }) => {
    const key = await createKitchenKey(request);
    const headers = { Authorization: `ApiKey ${key}` };
    let personId: string | undefined;
    let planId: string | undefined;
    let restRuleId: string | undefined;

    try {
      const createdPerson = await mcp(request, key, 10, "tools/call", {
        name: "manage_people",
        arguments: { action: "create", displayName: "TEST Parent A Person" },
      });
      expect(createdPerson.status(), await createdPerson.text()).toBe(200);
      const personPayload = parseMcpToolJson<{
        person?: { id?: string };
        error?: { message?: string };
      }>(await createdPerson.json());
      personId = personPayload.person?.id;
      expect(personId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      const addedRule = await mcp(request, key, 11, "tools/call", {
        name: "manage_person_rules",
        arguments: {
          action: "add",
          personId,
          kind: "custom",
          target: "blueberries",
          severity: "prefer_avoid",
          confirmUnknown: true,
        },
      });
      expect(addedRule.status(), await addedRule.text()).toBe(200);
      const rulePayload = parseMcpToolJson<{
        status?: string;
        rule?: { id?: string; target?: string };
        error?: { message?: string };
      }>(await addedRule.json());
      expect(rulePayload.status).toBe("added");
      expect(rulePayload.rule?.target).toBe("blueberries");
      expect(JSON.stringify(rulePayload)).not.toMatch(/foreign key|set_by|created_by/i);

      const restRule = await request.post(`/api/v1/people/${personId}/rules`, {
        headers,
        data: {
          kind: "custom",
          target: "food coloring",
          severity: "prefer_avoid",
          confirmUnknown: true,
        },
      });
      expect(restRule.status(), await restRule.text()).toBe(201);
      const restBody = (await restRule.json()) as {
        id?: string;
        target?: string;
        setBy?: string;
        createdByApiKeyId?: string | null;
      };
      expect(restBody.target).toBe("food coloring");
      expect(restBody.id).toBeTruthy();
      expect(restBody.setBy).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(restBody.createdByApiKeyId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      restRuleId = restBody.id;

      const recipes = await request.get("/api/v1/recipes", { headers });
      expect(recipes.status()).toBe(200);
      const recipeList = (await recipes.json()) as { items: Array<{ id: string }> };
      const recipeId = recipeList.items[0]?.id;
      expect(recipeId).toBeTruthy();

      const saved = await mcp(request, key, 12, "tools/call", {
        name: "save_meal_plan",
        arguments: {
          weekStart: "2026-11-02",
          status: "draft",
          checkReportJson: { status: "complete" },
          entries: [
            {
              date: "2026-11-02",
              meal: "dinner",
              recipeId,
              servings: 4,
              attendees: [personId],
            },
          ],
        },
      });
      expect(saved.status(), await saved.text()).toBe(200);
      const savedPayload = parseMcpToolJson<{
        planId?: string;
        entriesCount?: number;
        error?: { message?: string };
      }>(await saved.json());
      expect(JSON.stringify(savedPayload)).not.toMatch(/null value in column "created_by"/i);
      expect(savedPayload.planId).toBeTruthy();
      expect(savedPayload.entriesCount).toBe(1);
      planId = savedPayload.planId;

      const loaded = await mcp(request, key, 13, "tools/call", {
        name: "get_meal_plan",
        arguments: { planId },
      });
      expect(loaded.status(), await loaded.text()).toBe(200);
      const loadedPayload = parseMcpToolJson<{ entries?: unknown[] }>(await loaded.json());
      expect(loadedPayload.entries).toHaveLength(1);
    } finally {
      if (planId) {
        await mcp(request, key, 90, "tools/call", {
          name: "delete_meal_plan",
          arguments: { planId },
        });
      }
      if (restRuleId && personId) {
        await request.delete(`/api/v1/people/${personId}/rules/${restRuleId}`, { headers });
      }
      if (personId) {
        await mcp(request, key, 91, "tools/call", {
          name: "manage_people",
          arguments: { action: "delete", personId },
        });
      }
    }
  });

  test("meal-plan check accepts GET as well as POST", async ({ request }) => {
    const key = await createKitchenKey(request);
    const headers = { Authorization: `ApiKey ${key}` };
    const listed = await request.get("/api/v1/meal-plans", { headers });
    expect(listed.status()).toBe(200);
    const planId = ((await listed.json()) as { items: Array<{ id: string }> }).items[0]?.id;
    expect(planId).toBeTruthy();

    const viaGet = await request.get(`/api/v1/meal-plans/${planId}/check`, { headers });
    expect(viaGet.status(), await viaGet.text()).toBe(200);
    expect(viaGet.status()).not.toBe(405);
    const getBody = (await viaGet.json()) as { status?: string; planId?: string };
    expect(getBody.planId).toBe(planId);
    expect(getBody.status).toMatch(/complete|incomplete/);

    const viaPost = await request.post(`/api/v1/meal-plans/${planId}/check`, { headers });
    expect(viaPost.status(), await viaPost.text()).toBe(200);
    const postBody = (await viaPost.json()) as { status?: string; planId?: string };
    expect(postBody.planId).toBe(planId);
    expect(postBody.status).toBe(getBody.status);
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

      const merged = await request.patch(`/api/v1/meal-plans/${planId}`, {
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
      expect(merged.status(), await merged.text()).toBe(200);
      const mergedBody = (await merged.json()) as {
        status?: string;
        entries?: Array<{ date?: string; mealSlot?: string }>;
        previousEntries?: unknown[];
      };
      expect(mergedBody.status).toBe("approved");
      expect(mergedBody.entries).toHaveLength(2);
      expect(mergedBody.entries?.map((entry) => entry.mealSlot).sort()).toEqual([
        "dinner",
        "lunch",
      ]);
      expect(mergedBody.previousEntries).toEqual([]);

      const replaced = await request.patch(`/api/v1/meal-plans/${planId}`, {
        headers,
        data: {
          entriesMode: "replace",
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
      expect(replaced.status(), await replaced.text()).toBe(200);
      const patchedBody = (await replaced.json()) as {
        entries?: Array<{ date?: string; mealSlot?: string }>;
        previousEntries?: unknown[];
      };
      expect(patchedBody.entries).toHaveLength(1);
      expect(patchedBody.entries?.[0]?.date).toBe("2026-11-10");
      expect(patchedBody.entries?.[0]?.mealSlot).toBe("lunch");
      expect(patchedBody.previousEntries?.length).toBe(2);
    } finally {
      await request.delete(`/api/v1/meal-plans/${planId}`, { headers });
    }
  });

  test("API-shaped requests to the wrong base path get JSON 404, not a demo redirect", async ({
    request,
  }) => {
    const key = await createKitchenKey(request);
    const headers = {
      Authorization: `ApiKey ${key}`,
      Accept: "application/json",
    };
    for (const path of ["/recipes", "/meal-plans", "/v1/recipes", "/meal-plans/x/check"]) {
      const get = await request.get(path, { headers, maxRedirects: 0 });
      expect(get.status(), `${path} GET ${await get.text()}`).toBe(404);
      expect(get.headers()["location"] ?? "").not.toMatch(/\/api\/demo\/enter/);
      expect(get.headers()["content-type"] ?? "").toMatch(/problem\+json|json/);
      const body = (await get.json()) as { status?: number; detail?: string };
      expect(body.status).toBe(404);
      expect(body.detail).toMatch(/\/api\/v1\//);
    }
    const posted = await request.post("/meal-plans", {
      headers: { ...headers, "Content-Type": "application/json" },
      data: { title: "should not mint a sandbox" },
      maxRedirects: 0,
    });
    expect(posted.status(), await posted.text()).toBe(404);
    expect(posted.headers()["location"] ?? "").not.toMatch(/\/api\/demo\/enter/);

    const apiRecipes = await request.get("/api/recipes", { headers, maxRedirects: 0 });
    expect(apiRecipes.status(), await apiRecipes.text()).toBe(404);
  });

  test("API keys can list their kitchen and cannot accept invites", async ({ request }) => {
    const key = await createKitchenKey(request);
    const headers = { Authorization: `ApiKey ${key}` };

    const mine = await request.get("/api/v1/households/mine", { headers });
    expect(mine.status(), await mine.text()).toBe(200);
    const listed = (await mine.json()) as {
      items?: Array<{ household?: { id?: string }; active?: boolean }>;
      activeHouseholdId?: string | null;
    };
    expect(listed.items?.length).toBe(1);
    expect(listed.items?.[0]?.active).toBe(true);
    expect(listed.items?.[0]?.household?.id).toBe(listed.activeHouseholdId);

    const switched = await request.post("/api/v1/households/select", {
      headers,
      data: { householdId: listed.activeHouseholdId },
    });
    expect(switched.status(), await switched.text()).toBe(401);
    const switchProblem = (await switched.json()) as { detail?: string };
    expect(switchProblem.detail).toMatch(/\/api\/v1\/households\/mine/);

    const created = await request.post("/api/v1/households/invites", {
      headers,
      data: { role: "member", expiresInDays: 7 },
    });
    expect(created.status(), await created.text()).toBe(201);
    const invite = (await created.json()) as { id?: string; token?: string };
    expect(invite.token).toMatch(/^olinv_/);

    try {
      const accepted = await request.post(`/api/v1/invites/${invite.token}/accept`, { headers });
      expect(accepted.status(), await accepted.text()).toBe(401);
      const problem = (await accepted.json()) as { detail?: string };
      expect(problem.detail).toMatch(/signed-in person must open/i);
      expect(problem.detail).toContain(`/invite/${invite.token}`);
    } finally {
      if (invite.id) {
        await request.delete(`/api/v1/households/invites/${invite.id}`, { headers });
      }
    }
  });

  test("canonicalizes sesame seeds and dedupes identical person rules", async ({ request }) => {
    const key = await createKitchenKey(request);
    const headers = { Authorization: `ApiKey ${key}` };
    let personId: string | undefined;

    try {
      const createdPerson = await mcp(request, key, 20, "tools/call", {
        name: "manage_people",
        arguments: { action: "create", displayName: "Parent A" },
      });
      expect(createdPerson.status(), await createdPerson.text()).toBe(200);
      personId = parseMcpToolJson<{ person?: { id?: string } }>(await createdPerson.json()).person
        ?.id;
      expect(personId).toBeTruthy();

      const sesame = await request.post(`/api/v1/people/${personId}/rules`, {
        headers,
        data: { kind: "allergen", target: "Sesame Seeds", severity: "block" },
      });
      expect(sesame.status(), await sesame.text()).toBe(201);
      const sesameBody = (await sesame.json()) as { id?: string; target?: string };
      expect(sesameBody.target).toBe("sesame");

      const first = await request.post(`/api/v1/people/${personId}/rules`, {
        headers,
        data: { kind: "allergen", target: "peanutz", severity: "block" },
      });
      expect(first.status(), await first.text()).toBe(201);
      const firstBody = (await first.json()) as { id?: string; target?: string };
      expect(firstBody.target).toBe("peanut");

      const second = await request.post(`/api/v1/people/${personId}/rules`, {
        headers,
        data: { kind: "allergen", target: "peanut", severity: "block" },
      });
      expect(second.status(), await second.text()).toBe(200);
      const secondBody = (await second.json()) as { id?: string; target?: string };
      expect(secondBody.id).toBe(firstBody.id);

      const third = await mcp(request, key, 21, "tools/call", {
        name: "manage_person_rules",
        arguments: {
          action: "add",
          personId,
          kind: "allergen",
          target: "Peanut",
          severity: "block",
        },
      });
      expect(third.status(), await third.text()).toBe(200);
      const thirdPayload = parseMcpToolJson<{
        status?: string;
        rule?: { id?: string; target?: string };
      }>(await third.json());
      expect(thirdPayload.status).toBe("exists");
      expect(thirdPayload.rule?.id).toBe(firstBody.id);

      const listed = await request.get(`/api/v1/people/${personId}/rules`, { headers });
      expect(listed.status()).toBe(200);
      const rules = (await listed.json()) as Array<{ target?: string; severity?: string }>;
      expect(
        rules.filter((rule) => rule.target === "peanut" && rule.severity === "block")
      ).toHaveLength(1);
    } finally {
      if (personId) {
        await mcp(request, key, 92, "tools/call", {
          name: "manage_people",
          arguments: { action: "delete", personId },
        });
      }
    }
  });

  test("MCP user mistakes are invalid params, not internal errors", async ({ request }) => {
    const key = await createKitchenKey(request);
    const missing = await mcp(request, key, 30, "tools/call", {
      name: "manage_people",
      arguments: { action: "create" },
    });
    expect(missing.status(), await missing.text()).toBe(200);
    const missingBody = (await missing.json()) as {
      error?: { code?: number; message?: string };
    };
    expect(missingBody.error?.code).toBe(-32602);
    expect(missingBody.error?.message ?? JSON.stringify(missingBody)).toMatch(/displayName/);

    const people = await request.get("/api/v1/people", {
      headers: { Authorization: `ApiKey ${key}` },
    });
    const personId = ((await people.json()) as { items: Array<{ id: string }> }).items[0]?.id;
    expect(personId).toBeTruthy();

    const unknown = await mcp(request, key, 31, "tools/call", {
      name: "manage_person_rules",
      arguments: {
        action: "add",
        personId,
        kind: "allergen",
        target: "xyzzy",
        severity: "block",
      },
    });
    expect(unknown.status(), await unknown.text()).toBe(200);
    const unknownBody = (await unknown.json()) as {
      error?: { code?: number; message?: string };
    };
    expect(unknownBody.error?.code).toBe(-32602);
    expect(unknownBody.error?.message).toContain("confirmUnknown: true");

    const unknownTag = await mcp(request, key, 32, "tools/call", {
      name: "manage_person_rules",
      arguments: {
        action: "add",
        personId,
        kind: "tag",
        target: "xyzzy",
        severity: "prefer_avoid",
      },
    });
    expect(unknownTag.status(), await unknownTag.text()).toBe(200);
    const unknownTagBody = (await unknownTag.json()) as {
      error?: { code?: number; message?: string };
    };
    expect(unknownTagBody.error?.code).toBe(-32602);
    expect(unknownTagBody.error?.message).toContain("spicy");
    expect(unknownTagBody.error?.message).toContain("confirmUnknown: true");
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
