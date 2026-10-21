import { describe, expect, it, vi } from "vitest";
import { API_KEY_SCOPES, MCP_SCOPE_TABLE, missingScopeMessage } from "@ovenlovin/core";
import { JsonRpcErrorCode } from "../json-rpc";
import { dispatchMcpRequest } from "../protocol";
import { handleHttpRequest } from "../transport/http";
import { MCP_TOOLS } from "../tools/registry";

vi.mock("@ovenlovin/db", () => ({
  createDbClient: () => ({}),
  getDatabase: () => ({}),
}));

vi.mock("@ovenlovin/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ovenlovin/core")>();
  return {
    ...actual,
    RecipeService: class {
      async listRecipes() {
        return { items: [], nextCursor: null, hasMore: false };
      }
    },
    PeopleService: class {
      async listPeopleByHousehold() {
        return { items: [] };
      }
      async getPreferencesForPeople() {
        return [];
      }
    },
  };
});

const householdId = "11111111-1111-4111-8111-111111111111";
const serverInfo = { name: "ovenlovin-mcp", version: "0.1.0" };

describe("MCP API key scopes", () => {
  it("maps every registered tool", () => {
    for (const tool of MCP_TOOLS) {
      expect(MCP_SCOPE_TABLE).toHaveProperty(tool.name);
    }
  });

  it("lets a read-only key search and forbids create_recipe", async () => {
    const readOnly = {
      householdId,
      apiKeyId: "33333333-3333-4333-8333-333333333333",
      scopes: ["recipes:read"],
    };

    const search = await handleHttpRequest(
      null,
      {
        method: "POST",
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "search_recipes", arguments: { query: "pasta" } },
        },
        headers: { Authorization: "ApiKey rkapi_test" },
      },
      { requireAuth: true, onAuth: async () => readOnly }
    );
    expect(search.status).toBe(200);
    expect(JSON.parse(search.body)).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: { structuredContent: { recipes: [] } },
    });

    const created = await handleHttpRequest(
      null,
      {
        method: "POST",
        body: {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "create_recipe", arguments: { title: "Toast" } },
        },
        headers: { Authorization: "ApiKey rkapi_test" },
      },
      { requireAuth: true, onAuth: async () => readOnly }
    );
    expect(created.status).toBe(403);
    expect(JSON.parse(created.body)).toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      error: {
        code: JsonRpcErrorCode.forbidden,
        message: missingScopeMessage("recipes:write"),
      },
    });
  });

  it("lets a full-scope key past the scope gate", async () => {
    const response = await dispatchMcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "create_recipe", arguments: {} },
      },
      {
        householdId,
        apiKeyId: "33333333-3333-4333-8333-333333333333",
        scopes: [...API_KEY_SCOPES],
      },
      serverInfo
    );
    expect(response).toMatchObject({
      error: { code: JsonRpcErrorCode.invalidParams },
    });
  });

  it("does not scope-check a Clerk session", async () => {
    const response = await dispatchMcpRequest(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "create_recipe", arguments: {} },
      },
      { householdId, scopes: [] },
      serverInfo
    );
    expect(response).toMatchObject({
      error: { code: JsonRpcErrorCode.invalidParams },
    });
  });
});
