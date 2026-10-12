/**
 * Mock HTTP server for MCP e2e tests
 */

import { createServer as createHTTPServer } from "http";

export async function createMockServer(port: number, apiKey: string) {
  const httpServer = createHTTPServer(async (req, res) => {
    // CORS headers for testing
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    // Check authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const token = authHeader.slice(7);
    if (token !== apiKey) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: "Invalid API key" }));
      return;
    }

    // Read request body
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const message = JSON.parse(body);

        // Handle MCP protocol messages
        if (message.method === "initialize") {
          const response = {
            jsonrpc: "2.0",
            id: message.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: "ovenlovin-mcp-test",
                version: "0.0.0",
              },
            },
          };

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
          return;
        }

        if (message.method === "tools/list") {
          const response = {
            jsonrpc: "2.0",
            id: message.id,
            result: {
              tools: [
                {
                  name: "search_recipes",
                  description: "Search recipes by text query and filters",
                  inputSchema: {
                    type: "object",
                    properties: {
                      query: { type: "string" },
                      maxResults: { type: "number" },
                    },
                  },
                },
                {
                  name: "check_meal_plan",
                  description: "Check meal plan for allergens",
                  inputSchema: {
                    type: "object",
                    properties: {
                      plan: { type: "object" },
                    },
                    required: ["plan"],
                  },
                },
              ],
            },
          };

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
          return;
        }

        if (message.method === "tools/call") {
          const { name, arguments: args } = message.params;

          if (name === "search_recipes") {
            const response = {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      recipes: [
                        {
                          id: "recipe-1",
                          title: "Almond Cookies",
                          ingredients: ["almonds", "flour", "sugar"],
                        },
                      ],
                    }),
                  },
                ],
              },
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          if (name === "check_meal_plan") {
            const plan = args.plan;
            const entry = plan.entries[0];
            const recipe = entry.recipe;
            const attendee = entry.attendees[0];
            const rule = attendee.rules[0];

            // Check if any ingredient contains tree nuts
            const hasAlmonds = recipe.ingredients.some(
              (ing: any) =>
                ing.ingredient === "almonds" || ing.rawText.toLowerCase().includes("almond")
            );

            const findings = {
              block: [] as any[],
              warn: [] as any[],
              prefer_avoid: [] as any[],
            };

            if (hasAlmonds && rule.target === "tree_nut" && rule.severity === "block") {
              findings.block.push({
                personId: attendee.id,
                personName: attendee.displayName,
                ruleId: rule.id,
                severity: "block",
                ingredientName: "sliced almonds",
                allergenCode: "almond",
                allergenName: "Almond",
                relation: "contains",
                message: `${attendee.displayName}: recipe contains almonds (block rule)`,
                confidence: 1.0,
              });
            }

            const response = {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      status: "complete",
                      findings,
                      summary: {
                        affectedPeople: findings.block.length > 0 ? [attendee.id] : [],
                        entriesWithBlocks: findings.block.length > 0 ? 1 : 0,
                        entriesWithWarnings: 0,
                      },
                    }),
                  },
                ],
              },
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }
        }

        // Unknown method
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Unknown method" }));
      } catch (error) {
        res.writeHead(500);
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Internal server error",
          })
        );
      }
    });
  });

  return new Promise<any>((resolve, reject) => {
    httpServer.listen(port, () => {
      resolve(httpServer);
    });

    httpServer.on("error", reject);
  });
}
