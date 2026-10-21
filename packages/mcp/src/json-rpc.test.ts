import { describe, expect, it } from "vitest";
import { InvalidImageUrlError } from "@ovenlovin/core";
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

  it("maps not-found to invalid params with a data.code", () => {
    const response = jsonRpcFromThrown(
      6,
      new Error("Person not found: 550e8400-e29b-41d4-a716-446655440000")
    );
    expect(response.error.code).toBe(JsonRpcErrorCode.invalidParams);
    expect(response.error.data).toEqual({ code: "not_found" });
    expect(response.error.message).toMatch(/Person not found/);
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
    expect(response.error.message).toBe("We couldn't find a recipe in that text/photo");
    expect(response.error.data).toEqual({ code: "import_not_a_recipe" });
  });
});
