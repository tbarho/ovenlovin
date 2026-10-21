import { describe, expect, it } from "vitest";
import { API_KEY_SCOPES, apiKeyScopeSchema } from "../schemas/households";
import {
  MCP_SCOPE_TABLE,
  missingScopeMessage,
  mcpApiKeyScopeDenial,
  requiredRestScope,
  restApiKeyScopeDenial,
} from "./api-key-scopes";

describe("API key scopes", () => {
  it("keeps the vocabulary and the schema in lockstep", () => {
    expect([...API_KEY_SCOPES]).toEqual(apiKeyScopeSchema.options);
  });

  it("maps REST reads and writes, and denies a read-only key on write", () => {
    expect(requiredRestScope("GET", "/api/v1/recipes")).toBe("recipes:read");
    expect(requiredRestScope("POST", "/api/v1/recipes")).toBe("recipes:write");
    expect(
      requiredRestScope(
        "GET",
        "/api/v1/meal-plans/550e8400-e29b-41d4-a716-446655440000/shopping-list"
      )
    ).toBe("lists:export");
    expect(requiredRestScope("GET", "/api/v1/health")).toBeNull();
    expect(requiredRestScope("GET", "/api/v1/does-not-exist")).toBeUndefined();

    expect(restApiKeyScopeDenial(["recipes:read"], "GET", "/api/v1/recipes")).toBeNull();
    expect(restApiKeyScopeDenial(["recipes:read"], "POST", "/api/v1/recipes")).toBe(
      missingScopeMessage("recipes:write")
    );
    expect(restApiKeyScopeDenial([...API_KEY_SCOPES], "POST", "/api/v1/recipes")).toBeNull();
  });

  it("maps MCP tools and skips whoami", () => {
    expect(mcpApiKeyScopeDenial(["recipes:read"], "search_recipes")).toBeNull();
    expect(mcpApiKeyScopeDenial(["recipes:read"], "create_recipe")).toBe(
      missingScopeMessage("recipes:write")
    );
    expect(mcpApiKeyScopeDenial(["recipes:read"], "whoami")).toBeNull();
    expect(Object.keys(MCP_SCOPE_TABLE).length).toBeGreaterThanOrEqual(26);
  });
});
