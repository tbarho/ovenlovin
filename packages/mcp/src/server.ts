/**
 * OvenLovin MCP Server
 *
 * Remote MCP over Streamable HTTP: recipe management, household context,
 * meal planning, and shopping lists. Auth is Clerk OAuth or scoped API keys.
 * HTTP requests are stateless (see transport/http.ts) and never reuse a
 * connected SDK transport.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  MCP_RESOURCE_SCOPE,
  VERSION,
  mcpApiKeyScopeDenial,
  missingScopeMessage,
} from "@ovenlovin/core";
import type { AuthContext } from "./auth/index";
import { JsonRpcErrorCode } from "./json-rpc";
import { listResources, readResource } from "./resources/index";
import { listedTools, wrapToolResult } from "./protocol";
import { MCP_TOOLS } from "./tools/registry";

export interface ServerConfig {
  name?: string;
  version?: string;
  databaseUrl?: string;
  clerkSecretKey?: string;
  /** Required for tool calls. HTTP derives this from the API key or Clerk token. */
  authContext?: AuthContext;
}

function requireAuth(config: ServerConfig): AuthContext {
  if (!config.authContext?.householdId) {
    throw new Error(
      "Authentication required. Derive householdId from the API key or Clerk token - do not use a stub."
    );
  }
  return config.authContext;
}

function denyApiKeyScope(auth: AuthContext, toolName: string): void {
  if (!auth.apiKeyId) return;
  const denial = mcpApiKeyScopeDenial(auth.scopes, toolName);
  if (denial) {
    throw new McpError(JsonRpcErrorCode.forbidden, denial, { code: "forbidden" });
  }
}

function denyApiKeyResource(auth: AuthContext): void {
  if (!auth.apiKeyId) return;
  if (!auth.scopes.includes(MCP_RESOURCE_SCOPE)) {
    throw new McpError(JsonRpcErrorCode.forbidden, missingScopeMessage(MCP_RESOURCE_SCOPE), {
      code: "forbidden",
    });
  }
}

/**
 * Create an MCP SDK server for stdio. HTTP uses dispatchMcpRequest instead so
 * each request is stateless.
 */
export function createServer(config: ServerConfig = {}) {
  const server = new Server(
    {
      name: config.name || "ovenlovin-mcp",
      version: config.version || VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    requireAuth(config);
    return { tools: listedTools() };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const authContext = requireAuth(config);
    const { name, arguments: args } = request.params;
    denyApiKeyScope(authContext, name);
    const tool = MCP_TOOLS.find((item) => item.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const validated = tool.inputSchema.parse(args || {});
    const result = await tool.handler(validated as never, authContext);
    return wrapToolResult(result);
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const authContext = requireAuth(config);
    denyApiKeyResource(authContext);
    return { resources: await listResources(authContext) };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const authContext = requireAuth(config);
    denyApiKeyResource(authContext);
    const { uri } = request.params;
    const content = await readResource(uri, authContext);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(content, null, 2),
        },
      ],
    };
  });

  return server;
}

export async function runStdioServer(config: ServerConfig = {}) {
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OvenLovin MCP server running on stdio");
}
