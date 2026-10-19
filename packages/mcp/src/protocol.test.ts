import { describe, expect, it } from "vitest";
import { handleHttpRequest } from "./transport/http";
import { dispatchMcpRequest, listedTools, wrapToolResult } from "./protocol";
import { JsonRpcErrorCode } from "./json-rpc";
import { zodToMcpInputSchema } from "./json-schema";
import { searchRecipesTool, importRecipeTool, checkMealPlanTool } from "./index.js";

describe("MCP JSON schemas", () => {
  it("exposes real input schemas for every registered tool", () => {
    const tools = listedTools();
    expect(tools.length).toBeGreaterThanOrEqual(13);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema).not.toEqual({ type: "object", properties: {}, required: [] });
    }

    const search = tools.find((tool) => tool.name === "search_recipes");
    expect(search?.inputSchema.properties).toHaveProperty("query");
    expect(search?.inputSchema.properties).toHaveProperty("forAttendees");

    const imported = tools.find((tool) => tool.name === "import_recipe");
    expect(imported?.inputSchema.properties).toHaveProperty("source");
    expect(imported?.inputSchema.properties).toHaveProperty("content");

    const fromImage = tools.find((tool) => tool.name === "import_recipe_from_image");
    expect(fromImage?.inputSchema.properties).toHaveProperty("imageUrl");
    expect(fromImage?.inputSchema.properties).toHaveProperty("imageBase64");
  });

  it("converts zod objects via Zod 4 toJSONSchema", () => {
    const schema = zodToMcpInputSchema(searchRecipesTool.inputSchema);
    expect(schema.properties).toBeDefined();
    expect(schema.properties).toHaveProperty("maxResults");
    expect(zodToMcpInputSchema(importRecipeTool.inputSchema).properties).toHaveProperty(
      "cookbookId"
    );
    expect(zodToMcpInputSchema(checkMealPlanTool.inputSchema).properties).toHaveProperty("plan");
  });

  it("does not list defaulted input fields as required", () => {
    const search = zodToMcpInputSchema(searchRecipesTool.inputSchema);
    expect(search.required ?? []).not.toContain("maxResults");
    expect(search.properties).toHaveProperty("maxResults");

    const household = listedTools().find((tool) => tool.name === "get_household_context");
    expect(household?.inputSchema.required ?? []).not.toEqual(
      expect.arrayContaining([
        "includeSchedule",
        "includePeople",
        "includePreferences",
        "includeRecentMeals",
      ])
    );

    const shopping = listedTools().find((tool) => tool.name === "export_shopping_list");
    expect(shopping?.inputSchema.required ?? []).toEqual(["planId"]);
    expect(shopping?.inputSchema.properties).toHaveProperty("includeStaples");
    expect(shopping?.inputSchema.properties).toHaveProperty("includePantryItems");
    expect(shopping?.inputSchema.required ?? []).not.toEqual(
      expect.arrayContaining([
        "format",
        "groupBy",
        "includeStaples",
        "includePantryItems",
        "includeRuleWarnings",
      ])
    );

    const save = listedTools().find((tool) => tool.name === "save_meal_plan");
    expect(save?.inputSchema.required ?? []).not.toContain("status");
  });
});

describe("dispatchMcpRequest", () => {
  const serverInfo = { name: "ovenlovin-mcp", version: "0.1.0" };

  it("returns a JSON-RPC initialize result", async () => {
    const response = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      undefined,
      serverInfo
    );
    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: { serverInfo, protocolVersion: "2025-03-26" },
    });
  });

  it("returns a JSON-RPC error for unknown methods", async () => {
    const response = await dispatchMcpRequest(
      { jsonrpc: "2.0", id: 2, method: "nope/unknown" },
      undefined,
      serverInfo
    );
    expect(response).toEqual({
      jsonrpc: "2.0",
      id: 2,
      error: { code: JsonRpcErrorCode.methodNotFound, message: "Method not found: nope/unknown" },
    });
  });

  it("returns invalid params when manage_people create omits displayName", async () => {
    const response = await dispatchMcpRequest(
      {
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: { name: "manage_people", arguments: { action: "create" } },
      },
      { householdId: "11111111-1111-4111-8111-111111111111", scopes: [] },
      serverInfo
    );
    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 10,
      error: { code: JsonRpcErrorCode.invalidParams },
    });
    expect(JSON.stringify(response)).toMatch(/displayName/);
    expect(response && "error" in response ? response.error.code : 0).not.toBe(
      JsonRpcErrorCode.internal
    );
  });

  it("returns invalid params when a rule is missing target", async () => {
    const response = await dispatchMcpRequest(
      {
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: {
          name: "manage_person_rules",
          arguments: {
            action: "add",
            personId: "550e8400-e29b-41d4-a716-446655440000",
            food: "peanut",
            severity: "block",
          },
        },
      },
      { householdId: "11111111-1111-4111-8111-111111111111", scopes: [] },
      serverInfo
    );
    expect(response).toMatchObject({
      error: { code: JsonRpcErrorCode.invalidParams },
    });
    expect(JSON.stringify(response)).toMatch(/target/);
  });

  it("does not use a stub household on tools/call", async () => {
    const response = await dispatchMcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "search_recipes", arguments: { query: "pasta" } },
      },
      undefined,
      serverInfo
    );
    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 3,
      error: { code: JsonRpcErrorCode.unauthorized },
    });
    expect(JSON.stringify(response)).not.toContain("stub");
  });
});

describe("handleHttpRequest", () => {
  it("returns HTTP 401 with a JSON-RPC envelope when auth is missing", async () => {
    const first = await handleHttpRequest(
      null,
      { method: "POST", body: { jsonrpc: "2.0", id: 1, method: "initialize" }, headers: {} },
      {
        requireAuth: true,
        onAuth: async () => {
          throw new Error("should not run");
        },
      }
    );
    expect(first.status).toBe(401);
    expect(JSON.parse(first.body)).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      error: { code: JsonRpcErrorCode.unauthorized },
    });
  });

  it("is stateless across two sequential requests (no shared transport)", async () => {
    const auth = {
      householdId: "11111111-1111-4111-8111-111111111111",
      scopes: ["recipes:read"],
    };
    const options = {
      requireAuth: true,
      onAuth: async () => auth,
    };

    const first = await handleHttpRequest(
      null,
      {
        method: "POST",
        body: { jsonrpc: "2.0", id: 1, method: "initialize" },
        headers: { Authorization: "ApiKey rkapi_test" },
      },
      options
    );
    const second = await handleHttpRequest(
      null,
      {
        method: "POST",
        body: { jsonrpc: "2.0", id: 2, method: "tools/list" },
        headers: { Authorization: "ApiKey rkapi_test" },
      },
      options
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(JSON.parse(first.body).result.serverInfo.name).toBe("ovenlovin-mcp");
    const tools = JSON.parse(second.body).result.tools as Array<{
      name: string;
      inputSchema: { properties?: Record<string, unknown> };
    }>;
    expect(
      tools.find((tool) => tool.name === "search_recipes")?.inputSchema.properties
    ).toHaveProperty("query");
  });

  it("returns JSON-RPC invalid params when a tool schema fails", async () => {
    const response = await handleHttpRequest(
      null,
      {
        method: "POST",
        body: {
          jsonrpc: "2.0",
          id: 9,
          method: "tools/call",
          params: { name: "get_recipe", arguments: { id: "not-a-uuid" } },
        },
        headers: { Authorization: "ApiKey rkapi_test" },
      },
      {
        requireAuth: true,
        onAuth: async () => ({
          householdId: "11111111-1111-4111-8111-111111111111",
          scopes: ["recipes:read"],
        }),
      }
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      jsonrpc: "2.0",
      id: 9,
      error: { code: JsonRpcErrorCode.invalidParams },
    });
  });
});

describe("wrapToolResult", () => {
  it("puts a shopping list object on structuredContent instead of stringifying it twice", () => {
    const list = {
      mealPlanId: "plan-1",
      weekStart: "2026-10-12",
      ingredients: [{ name: "salt", quantity: 1.8333, unit: "tbsp" }],
    };
    const wrapped = wrapToolResult({
      format: "json",
      list,
      itemCount: 1,
      warnings: [],
    });

    expect(wrapped.structuredContent.list).toEqual(list);
    expect(typeof wrapped.structuredContent.list).toBe("object");
    const parsed = JSON.parse(wrapped.content[0]!.text) as { list: typeof list };
    expect(parsed.list).toEqual(list);
    expect(wrapped.content[0]?.text).not.toContain('\\"mealPlanId\\"');
  });

  it("uses markdown content as the text block when the tool already formatted it", () => {
    const wrapped = wrapToolResult({
      format: "markdown",
      content: "# Shopping List\n\n- 1 onion\n",
      list: { ingredients: [{ name: "onion", quantity: 1 }] },
      itemCount: 1,
      warnings: [],
    });
    expect(wrapped.content[0]?.text).toBe("# Shopping List\n\n- 1 onion\n");
    expect(wrapped.structuredContent.list).toEqual({
      ingredients: [{ name: "onion", quantity: 1 }],
    });
  });
});
