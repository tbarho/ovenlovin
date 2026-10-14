import type { AuthContext } from "../auth/index";
import {
  JsonRpcErrorCode,
  type JsonRpcRequest,
  isJsonRpcNotification,
  jsonRpcError,
  requestId,
} from "../json-rpc";
import { dispatchMcpRequest, type ProtocolServerInfo } from "../protocol";

export interface HttpTransportOptions {
  /**
   * Authentication header to validate (e.g., "Bearer <token>" or "ApiKey <key>")
   */
  authHeader?: string;
  /**
   * Resolve household/user from the Authorization header.
   * Required for every POST in production.
   */
  onAuth?: (authHeader: string) => Promise<AuthContext> | AuthContext;
  /**
   * When true (default if onAuth is set), missing/invalid auth returns HTTP 401
   * with a JSON-RPC error envelope.
   */
  requireAuth?: boolean;
  serverInfo?: ProtocolServerInfo;
}

export type AuthInfo = AuthContext;

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

function envelope(
  status: number,
  body: unknown
): {
  status: number;
  headers: Record<string, string>;
  body: string;
} {
  return {
    status,
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  };
}

/**
 * Stateless Streamable HTTP handler. One JSON-RPC request per POST.
 * Does not call MCP SDK `server.connect()`, so a second request cannot
 * throw "Already connected to a transport".
 */
export async function handleHttpRequest(
  _server: unknown,
  request: {
    method: string;
    body: JsonRpcRequest | JsonRpcRequest[];
    headers: Record<string, string>;
  },
  options: HttpTransportOptions = {}
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: string;
}> {
  const requireAuth = options.requireAuth ?? Boolean(options.onAuth);
  const first = Array.isArray(request.body) ? request.body[0] : request.body;
  const id = requestId(first);

  if (request.method !== "POST") {
    return envelope(405, jsonRpcError(id, JsonRpcErrorCode.invalidRequest, "Method not allowed"));
  }

  let authContext: AuthContext | undefined;
  if (requireAuth) {
    const authHeader = request.headers.authorization || request.headers.Authorization;
    if (!authHeader) {
      return envelope(401, jsonRpcError(id, JsonRpcErrorCode.unauthorized, "Unauthorized"));
    }
    try {
      authContext = options.onAuth ? await options.onAuth(authHeader) : undefined;
      if (!authContext?.householdId) {
        return envelope(401, jsonRpcError(id, JsonRpcErrorCode.unauthorized, "Unauthorized"));
      }
    } catch (error) {
      return envelope(
        401,
        jsonRpcError(
          id,
          JsonRpcErrorCode.unauthorized,
          error instanceof Error ? error.message : "Invalid credentials"
        )
      );
    }
  } else if (options.onAuth) {
    const authHeader = request.headers.authorization || request.headers.Authorization;
    if (authHeader) {
      try {
        authContext = await options.onAuth(authHeader);
      } catch {
        authContext = undefined;
      }
    }
  }

  const serverInfo = options.serverInfo ?? { name: "ovenlovin-mcp", version: "0.1.0" };

  if (Array.isArray(request.body)) {
    const responses = [];
    for (const message of request.body) {
      const response = await dispatchMcpRequest(message, authContext, serverInfo);
      if (response) responses.push(response);
    }
    return envelope(200, responses);
  }

  const response = await dispatchMcpRequest(request.body, authContext, serverInfo);
  if (!response) {
    return {
      status: isJsonRpcNotification(request.body) ? 202 : 200,
      headers: jsonHeaders(),
      body: "",
    };
  }

  const httpStatus =
    "error" in response && response.error.code === JsonRpcErrorCode.unauthorized ? 401 : 200;
  return envelope(httpStatus, response);
}
