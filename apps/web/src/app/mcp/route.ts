/**
 * MCP Server HTTP Endpoint
 *
 * Streamable HTTP transport for Model Context Protocol
 * Supports OAuth via Clerk + API key authentication
 *
 * POST /mcp
 * Content-Type: application/json
 * Authorization: Bearer <token>
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer, handleHttpRequest } from "@ovenlovin/mcp";

// Create singleton server instance
const mcpServer = createServer({
  name: "ovenlovin-mcp",
  version: "0.1.0",
  databaseUrl: process.env.DATABASE_URL,
  clerkSecretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * Handle MCP requests
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Extract headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Handle the MCP request
    const result = await handleHttpRequest(
      mcpServer,
      {
        method: "POST",
        body,
        headers,
      },
      {
        // Auth will be implemented in a later PR
        onAuth: async (authHeader: string) => {
          // TODO: Validate Clerk OAuth token or API key
          // For now, stub implementation
          return {
            householdId: "stub-household",
            userId: "stub-user",
            scopes: ["recipes:read", "recipes:write", "plans:write"],
          };
        },
      }
    );

    // Return response
    if (typeof result.body === "string") {
      return new NextResponse(result.body, {
        status: result.status,
        headers: result.headers,
      });
    }

    // Handle streaming response (future enhancement)
    return new NextResponse(JSON.stringify(result.body), {
      status: result.status,
      headers: result.headers,
    });
  } catch (error) {
    console.error("MCP request error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    service: "ovenlovin-mcp",
    version: "0.1.0",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
