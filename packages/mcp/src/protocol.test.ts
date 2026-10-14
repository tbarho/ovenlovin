import { describe, expect, it } from "vitest";
import { handleHttpRequest } from "./transport/http";
import { dispatchMcpRequest, listedTools } from "./protocol";
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
