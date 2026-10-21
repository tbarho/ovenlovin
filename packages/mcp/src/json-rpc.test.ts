import { describe, expect, it } from "vitest";
import {
  IMPORT_BLOCKED_CODE,
  IMPORT_BLOCKED_MESSAGE,
  IMPORT_NOT_A_RECIPE_CODE,
  IMPORT_NOT_A_RECIPE_MESSAGE,
  IMPORT_PAGE_GONE_CODE,
  IMPORT_PAGE_GONE_MESSAGE,
  InvalidImageUrlError,
} from "@ovenlovin/core";
import { JsonRpcErrorCode, McpInvalidParamsError, jsonRpcFromThrown } from "./json-rpc";

describe("jsonRpcFromThrown", () => {
  it("maps user mistakes to JSON-RPC invalid params, not internal error", () => {
    const missingName = jsonRpcFromThrown(
      1,
      new McpInvalidParamsError("displayName is required to create a person")
    );
    expect(missingName).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: JsonRpcErrorCode.invalidParams,
        message: "displayName is required to create a person",
      },
    });
    expect(missingName.error.code).not.toBe(JsonRpcErrorCode.internal);

    const unknown = jsonRpcFromThrown(
      2,
      new McpInvalidParamsError(
        "We can't check 'xyzzy' against recipes. If you meant this exact food, retry with confirmUnknown: true."
      )
    );
    expect(unknown.error.code).toBe(JsonRpcErrorCode.invalidParams);
    expect(unknown.error.message).toContain("confirmUnknown: true");

    const duplicate = jsonRpcFromThrown(
      3,
      new McpInvalidParamsError(
        'This photo was already imported as "Toast" (550e8400-e29b-41d4-a716-446655440000). Skip or open that recipe.'
      )
    );
    expect(duplicate.error.code).toBe(JsonRpcErrorCode.invalidParams);
    expect(duplicate.error.message).toMatch(/already imported/i);
  });

  it("maps a blocked image URL to invalid params, not internal error", () => {
    const response = jsonRpcFromThrown(5, new InvalidImageUrlError());
    expect(response.error.code).toBe(JsonRpcErrorCode.invalidParams);
    expect(response.error.data).toEqual({ code: "invalid_image_url" });
  });

  it("keeps quota, auth, and validation as distinct codes", () => {
    expect(JsonRpcErrorCode.quota).toBe(-32004);
    expect(JsonRpcErrorCode.quota).not.toBe(JsonRpcErrorCode.forbidden);
    expect(JsonRpcErrorCode.quota).not.toBe(JsonRpcErrorCode.unauthorized);
    expect(JsonRpcErrorCode.quota).not.toBe(JsonRpcErrorCode.invalidParams);
  });

  it("keeps unexpected failures as internal error", () => {
    const response = jsonRpcFromThrown(4, new Error("connection refused"));
    expect(response.error.code).toBe(JsonRpcErrorCode.internal);
  });

  it("maps a schema-miss to not-a-recipe, not busy", () => {
    const response = jsonRpcFromThrown(
      5,
      Object.assign(new Error("No object generated: response did not match schema."), {
        name: "AI_NoObjectGeneratedError",
      })
    );
    expect(response.error.code).toBe(JsonRpcErrorCode.invalidParams);
    expect(response.error.message).toBe(IMPORT_NOT_A_RECIPE_MESSAGE);
    expect(response.error.data).toEqual({ code: IMPORT_NOT_A_RECIPE_CODE });
  });

  it("maps checkpoint, 404, and not-a-recipe to data.code, not -32603", () => {
    const blocked = jsonRpcFromThrown(
      6,
      Object.assign(new Error("This site blocked the importer."), {
        name: "RecipeImportFetchError",
      })
    );
    expect(blocked.error.code).toBe(JsonRpcErrorCode.invalidParams);
    expect(blocked.error.code).not.toBe(JsonRpcErrorCode.internal);
    expect(blocked.error.message).toBe(IMPORT_BLOCKED_MESSAGE);
    expect(blocked.error.data).toEqual({ code: IMPORT_BLOCKED_CODE });

    const gone = jsonRpcFromThrown(
      7,
      Object.assign(new Error("That page is gone."), { name: "RecipePageGoneError" })
    );
    expect(gone.error.code).toBe(JsonRpcErrorCode.invalidParams);
    expect(gone.error.message).toBe(IMPORT_PAGE_GONE_MESSAGE);
    expect(gone.error.data).toEqual({ code: IMPORT_PAGE_GONE_CODE });

    const notRecipe = jsonRpcFromThrown(
      8,
      Object.assign(new Error("This is not a recipe page."), { name: "RecipeNotFoundError" })
    );
    expect(notRecipe.error.code).toBe(JsonRpcErrorCode.invalidParams);
    expect(notRecipe.error.message).toBe(IMPORT_NOT_A_RECIPE_MESSAGE);
    expect(notRecipe.error.data).toEqual({ code: IMPORT_NOT_A_RECIPE_CODE });
  });
});
