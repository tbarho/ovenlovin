import { describe, expect, it } from "vitest";
import { isSuccessfulImportRecipeCall } from "./mcp-guard";

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
});
