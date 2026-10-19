import { describe, expect, it } from "vitest";
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

  it("keeps unexpected failures as internal error", () => {
    const response = jsonRpcFromThrown(4, new Error("connection refused"));
    expect(response.error.code).toBe(JsonRpcErrorCode.internal);
  });
});
