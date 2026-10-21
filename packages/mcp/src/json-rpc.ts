import {
  IMPORT_AI_UNAVAILABLE_CODE,
  IMPORT_AI_UNAVAILABLE_MESSAGE,
  IMPORT_NOT_A_RECIPE_CODE,
  IMPORT_NOT_A_RECIPE_MESSAGE,
  InvalidImageUrlError,
  isImportAiNotARecipe,
  isImportAiUnavailable,
} from "@ovenlovin/core";

export const JSONRPC_VERSION = "2.0" as const;

export const JsonRpcErrorCode = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  unauthorized: -32001,
  forbidden: -32003,
  quota: -32004,
} as const;

/** User/input mistakes (missing fields, unknown allergen, duplicate photo). */
export class McpInvalidParamsError extends Error {
  readonly rpcCode = JsonRpcErrorCode.invalidParams;

  constructor(
    message: string,
    readonly data?: unknown
  ) {
    super(message);
    this.name = "McpInvalidParamsError";
  }
}

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

export type JsonRpcSuccess = {
  jsonrpc: typeof JSONRPC_VERSION;
  id: JsonRpcId;
  result: unknown;
};

export type JsonRpcFailure = {
  jsonrpc: typeof JSONRPC_VERSION;
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export function isJsonRpcNotification(message: JsonRpcRequest): boolean {
  return message.id === undefined;
}

export function jsonRpcResult(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

export function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown
): JsonRpcFailure {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

export function requestId(message: JsonRpcRequest | undefined): JsonRpcId {
  if (!message || message.id === undefined) return null;
  return message.id;
}

export function jsonRpcFromThrown(id: JsonRpcId, error: unknown): JsonRpcFailure {
  if (error && typeof error === "object" && "error" in error && "jsonrpc" in error) {
    return error as JsonRpcFailure;
  }
  if (error instanceof McpInvalidParamsError) {
    return jsonRpcError(id, JsonRpcErrorCode.invalidParams, error.message, error.data);
  }
  if (error instanceof InvalidImageUrlError) {
    return jsonRpcError(id, JsonRpcErrorCode.invalidParams, error.message, { code: error.code });
  }
  if (isImportAiNotARecipe(error)) {
    return jsonRpcError(id, JsonRpcErrorCode.invalidParams, IMPORT_NOT_A_RECIPE_MESSAGE, {
      code: IMPORT_NOT_A_RECIPE_CODE,
    });
  }
  if (isImportAiUnavailable(error)) {
    return jsonRpcError(id, JsonRpcErrorCode.internal, IMPORT_AI_UNAVAILABLE_MESSAGE, {
      code: IMPORT_AI_UNAVAILABLE_CODE,
    });
  }
  const messageText = error instanceof Error ? error.message : "Internal error";
  if (/\bnot found\b/i.test(messageText)) {
    return jsonRpcError(id, JsonRpcErrorCode.invalidParams, messageText, { code: "not_found" });
  }
  return jsonRpcError(id, JsonRpcErrorCode.internal, messageText);
}
