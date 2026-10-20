import { describe, expect, it } from "vitest";
import { isDemoMcpWriteCall, isSuccessfulImportRecipeCall } from "./mcp-guard";

describe("isDemoMcpWriteCall", () => {
  it("lets household settings reads through after the write limit", () => {
    expect(
      isDemoMcpWriteCall({
        method: "tools/call",
        params: { name: "manage_household_settings", arguments: { action: "get" } },
      })
    ).toBe(false);
    expect(
      isDemoMcpWriteCall({
        method: "tools/call",
        params: { name: "manage_household_settings" },
      })
    ).toBe(false);
    expect(
      isDemoMcpWriteCall({
        method: "tools/call",
        params: {
          name: "manage_household_settings",
          arguments: { action: "update", mode: "family" },
        },
      })
    ).toBe(true);
  });

  it("does not count an import preview as a write", () => {
    expect(
      isDemoMcpWriteCall({
        method: "tools/call",
        params: { name: "import_recipe", arguments: { save: false, source: "paste" } },
      })
    ).toBe(false);
    expect(
      isDemoMcpWriteCall({
        method: "tools/call",
        params: { name: "import_recipe", arguments: { source: "paste" } },
      })
    ).toBe(true);
  });
});

describe("isSuccessfulImportRecipeCall", () => {
  const importCall = {
    method: "tools/call",
    params: { name: "import_recipe" },
  };

  it("is true only for a successful import_recipe JSON-RPC result", () => {
    expect(
      isSuccessfulImportRecipeCall(importCall, JSON.stringify({ result: { recipeId: "1" } }))
    ).toBe(true);
    expect(
      isSuccessfulImportRecipeCall(importCall, JSON.stringify({ error: { message: "403" } }))
    ).toBe(false);
    expect(
      isSuccessfulImportRecipeCall(
        { method: "tools/call", params: { name: "create_recipe" } },
        JSON.stringify({ result: {} })
      )
    ).toBe(false);
  });

  it("does not count a duplicate replay toward the demo import cap", () => {
    expect(
      isSuccessfulImportRecipeCall(
        importCall,
        JSON.stringify({ result: { content: [{ type: "text", text: '{"created": false}' }] } })
      )
    ).toBe(false);
  });

  it("counts import_recipe_from_image as an import", () => {
    expect(
      isSuccessfulImportRecipeCall(
        { method: "tools/call", params: { name: "import_recipe_from_image" } },
        JSON.stringify({ result: { recipeId: "1" } })
      )
    ).toBe(true);
  });
});
