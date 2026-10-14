/**
 * OvenLovin MCP Server
 *
 * Remote MCP server over Streamable HTTP providing recipe management,
 * household context, meal planning, and shopping list tools.
 *
 * Auth: OAuth via Clerk + scoped API keys
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Tool imports (will be implemented)
import { searchRecipesTool } from "./tools/search-recipes";
import { getRecipeTool } from "./tools/get-recipe";
import { importRecipeTool } from "./tools/import-recipe";
import { getHouseholdContextTool } from "./tools/get-household-context";
import { getPersonRulesTool } from "./tools/get-person-rules";
import { checkMealPlanTool } from "./tools/check-meal-plan";
import { exportShoppingListTool } from "./tools/export-shopping-list";
import { saveMealPlanTool } from "./tools/save-meal-plan";
import { getMealPlanTool } from "./tools/get-meal-plan";
import { listCookbooksTool } from "./tools/list-cookbooks";
import { getCookbookTool } from "./tools/get-cookbook";
import { manageCookbookTool } from "./tools/manage-cookbook";
import { managePersonLovesTool } from "./tools/manage-person-loves";
import { reorderPeopleTool } from "./tools/reorder-people";

// Resource implementations (will be implemented)
import { listResources, readResource } from "./resources/index";

// Auth (stub for now)
import type { AuthContext } from "./auth/index";

/**
 * Tool registry with schemas
 */
const TOOLS = [
  searchRecipesTool,
  getRecipeTool,
  importRecipeTool,
  getHouseholdContextTool,
  getPersonRulesTool,
  checkMealPlanTool,
  exportShoppingListTool,
  saveMealPlanTool,
  getMealPlanTool,
  listCookbooksTool,
  getCookbookTool,
  manageCookbookTool,
  managePersonLovesTool,
  reorderPeopleTool,
] as const;

/**
 * Server configuration
 */
export interface ServerConfig {
  name?: string;
  version?: string;
  databaseUrl?: string;
  clerkSecretKey?: string;
  /**
   * Per-request auth. HTTP handlers create a new server per call so the
   * household is derived from the API key (or Clerk token) on that request.
   * Tests that omit this keep the historical stub context.
   */
  auth?: AuthContext;
}

/**
 * Create and configure the MCP server
 */
export function createServer(config: ServerConfig = {}) {
  const server = new Server(
    {
      name: config.name || "ovenlovin-mcp",
      version: config.version || "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS.map((tool) => {
        // Manual JSON Schema for now (zod-to-json-schema is broken with Zod 4)
        const inputSchema: Record<string, unknown> = {
          type: "object",
          properties: {},
          required: [],
        };

        return {
          name: tool.name,
          description: tool.description,
          inputSchema,
        };
      }),
    };
  });

  // Call a tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const authContext = resolveAuthContext(config);

    // Validate arguments and execute tool
    const validated = tool.inputSchema.parse(args || {});
    const result = await tool.handler(validated as never, authContext);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: await listResources(resolveAuthContext(config)),
    };
  });

  // Read a resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    const content = await readResource(uri, resolveAuthContext(config));

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

export function resolveAuthContext(config: ServerConfig = {}): AuthContext {
  if (config.auth) return config.auth;
  return {
    householdId: "stub",
    userId: "stub",
    scopes: ["recipes:read", "recipes:write", "plans:write", "people:read", "lists:export"],
  };
}

/**
 * Run the server with stdio transport (for local testing)
 */
export async function runStdioServer(config: ServerConfig = {}) {
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OvenLovin MCP server running on stdio");
}
