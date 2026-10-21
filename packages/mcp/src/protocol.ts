import { MCP_RESOURCE_SCOPE, mcpApiKeyScopeDenial, missingScopeMessage } from "@ovenlovin/core";
import type { AuthContext } from "./auth/index";
import { listResources, readResource } from "./resources/index";
import {
  JsonRpcErrorCode,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
  isJsonRpcNotification,
  jsonRpcError,
  jsonRpcFromThrown,
  jsonRpcResult,
  requestId,
} from "./json-rpc";
import { zodToMcpInputSchema } from "./json-schema";
import { MCP_TOOLS } from "./tools/registry";

export const MCP_PROTOCOL_VERSION = "2025-03-26";

export type ProtocolServerInfo = {
  name: string;
  version: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requireAuth(authContext: AuthContext | undefined, id: JsonRpcId): AuthContext {
  if (!authContext?.householdId) {
    throw jsonRpcError(
      id,
      JsonRpcErrorCode.unauthorized,
      "Authentication required. Send Authorization: ApiKey <key> or Bearer <key>."
    );
  }
  return authContext;
}

function denyApiKeyResource(auth: AuthContext, id: JsonRpcId): void {
  if (!auth.apiKeyId) return;
  if (!auth.scopes.includes(MCP_RESOURCE_SCOPE)) {
    throw jsonRpcError(id, JsonRpcErrorCode.forbidden, missingScopeMessage(MCP_RESOURCE_SCOPE));
  }
}

function listedTools() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToMcpInputSchema(tool.inputSchema),
  }));
}

async function callTool(params: Record<string, unknown>, authContext: AuthContext, id: JsonRpcId) {
  const name = typeof params.name === "string" ? params.name : "";
  const args = asRecord(params.arguments);
  const tool = MCP_TOOLS.find((item) => item.name === name);
  if (!tool) {
    throw jsonRpcError(id, JsonRpcErrorCode.methodNotFound, `Unknown tool: ${name}`);
  }

  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = (issue?.path ?? []).map(String).join(".");
    throw jsonRpcError(
      id,
      JsonRpcErrorCode.invalidParams,
      path
        ? `${path}: ${issue?.message ?? "Invalid tool arguments"}`
        : (issue?.message ?? "Invalid tool arguments"),
      parsed.error.issues
    );
  }

  if (authContext.apiKeyId) {
    const denial = mcpApiKeyScopeDenial(authContext.scopes, tool.name);
    if (denial) {
      throw jsonRpcError(id, JsonRpcErrorCode.forbidden, denial);
    }
  }

  const result = await tool.handler(parsed.data as never, authContext);
  return wrapToolResult(result);
}

/**
 * Stateless JSON-RPC dispatcher. One request in, one envelope out.
 * Does not hold an MCP SDK transport, so it cannot throw
 * "Already connected to a transport".
 */
export async function dispatchMcpRequest(
  message: JsonRpcRequest,
  authContext: AuthContext | undefined,
  serverInfo: ProtocolServerInfo
): Promise<JsonRpcResponse | null> {
  const id = requestId(message);

  if (message.jsonrpc && message.jsonrpc !== "2.0") {
    return jsonRpcError(id, JsonRpcErrorCode.invalidRequest, 'jsonrpc must be "2.0"');
  }

  if (!message.method || typeof message.method !== "string") {
    if (isJsonRpcNotification(message)) return null;
    return jsonRpcError(id, JsonRpcErrorCode.invalidRequest, "Missing method");
  }

  try {
    switch (message.method) {
      case "initialize":
        return jsonRpcResult(id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {}, resources: {} },
          serverInfo,
          instructions:
            "OvenLovin household MCP. Not medical advice - always check ingredient labels before serving.",
        });
      case "notifications/initialized":
      case "notifications/cancelled":
        return null;
      case "ping":
        return jsonRpcResult(id, {});
      case "tools/list":
        return jsonRpcResult(id, { tools: listedTools() });
      case "tools/call": {
        const auth = requireAuth(authContext, id);
        return jsonRpcResult(id, await callTool(asRecord(message.params), auth, id));
      }
      case "resources/list": {
        const auth = requireAuth(authContext, id);
        denyApiKeyResource(auth, id);
        return jsonRpcResult(id, { resources: await listResources(auth) });
      }
      case "resources/read": {
        const auth = requireAuth(authContext, id);
        denyApiKeyResource(auth, id);
        const uri = String(asRecord(message.params).uri ?? "");
        const content = await readResource(uri, auth);
        return jsonRpcResult(id, {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(content, null, 2) }],
        });
      }
      default:
        if (isJsonRpcNotification(message)) return null;
        return jsonRpcError(
          id,
          JsonRpcErrorCode.methodNotFound,
          `Method not found: ${message.method}`
        );
    }
  } catch (error) {
    return jsonRpcFromThrown(id, error);
  }
}

export { listedTools };

/**
 * MCP tools return objects. Put the object on `structuredContent` so agents
 * do not have to JSON.parse a string stuffed in `content`. Text clients still
 * get a string: markdown/csv/text `content` when the tool already produced
 * one, otherwise pretty-printed JSON.
 */
export function wrapToolResult(result: unknown): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
} {
  const structuredContent =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : { result };
  const text =
    typeof structuredContent.content === "string"
      ? structuredContent.content
      : JSON.stringify(result, null, 2);
  return {
    content: [{ type: "text", text }],
    structuredContent,
  };
}
