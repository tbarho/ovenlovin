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
import { zodToJsonSchema } from "zod-to-json-schema";

// Tool imports (will be implemented)
import { searchRecipesTool } from "./tools/search-recipes.js";
import { getRecipeTool } from "./tools/get-recipe.js";
import { importRecipeTool } from "./tools/import-recipe.js";
import { getHouseholdContextTool } from "./tools/get-household-context.js";
import { getPersonRulesTool } from "./tools/get-person-rules.js";
import { checkMealPlanTool } from "./tools/check-meal-plan.js";
import { exportShoppingListTool } from "./tools/export-shopping-list.js";
import { saveMealPlanTool } from "./tools/save-meal-plan.js";
import { getMealPlanTool } from "./tools/get-meal-plan.js";

// Resource implementations (will be implemented)
import { listResources, readResource } from "./resources/index.js";

// Auth (stub for now)
import type { AuthContext } from "./auth/index.js";

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
] as const;

/**
 * Server configuration
 */
export interface ServerConfig {
  name?: string;
  version?: string;
  databaseUrl?: string;
  clerkSecretKey?: string;
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
      tools: TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema),
      })),
    };
  });

  // Call a tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // TODO: Extract auth context from request headers
    const authContext: AuthContext = {
      householdId: "stub", // From OAuth or API key
      userId: "stub",
      scopes: ["recipes:read", "recipes:write", "plans:write"],
    };

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
    // TODO: Extract auth context
    const authContext: AuthContext = {
      householdId: "stub",
      userId: "stub",
      scopes: ["people:read"],
    };

    return {
      resources: await listResources(authContext),
    };
  });

  // Read a resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    // TODO: Extract auth context
    const authContext: AuthContext = {
      householdId: "stub",
      userId: "stub",
      scopes: ["people:read"],
    };

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

/**
 * Run the server with stdio transport (for local testing)
 */
export async function runStdioServer(config: ServerConfig = {}) {
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OvenLovin MCP server running on stdio");
}
