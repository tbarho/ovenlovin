/**
 * Stateless MCP over HTTP.
 *
 * Each POST creates a fresh server whose household comes from the API key
 * (or Clerk token) on that request. No session id, no shared stub household.
 *
 * POST /mcp
 * Authorization: ApiKey rkapi_…   or   Bearer rkapi_…
 */

import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  createServer,
  handleHttpRequest,
  type AuthError,
} from "@ovenlovin/mcp";

function headersFrom(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function unauthorized(error: unknown): NextResponse {
  const authError = error as AuthError | undefined;
  const message =
    authError && typeof authError === "object" && "message" in authError
      ? String(authError.message)
      : error instanceof Error
        ? error.message
        : "Unauthorized";
  return NextResponse.json(
    { error: "Unauthorized", message },
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Handle one JSON-RPC MCP request. Transport is stateless: no Mcp-Session-Id.
 */
export async function POST(request: NextRequest) {
  try {
    const headers = headersFrom(request);
    let auth;
    try {
      auth = await authenticateRequest(headers);
    } catch (error) {
      return unauthorized(error);
    }

    const body = await request.json();
    const mcpServer = createServer({
      name: "ovenlovin-mcp",
      version: "0.1.0",
      databaseUrl: process.env.DATABASE_URL,
      clerkSecretKey: process.env.CLERK_SECRET_KEY,
      auth,
    });

    const result = await handleHttpRequest(
      mcpServer,
      {
        method: "POST",
        body,
        headers,
      },
      {
        onAuth: async () => ({
          householdId: auth.householdId,
          userId: auth.userId ?? auth.apiKeyId ?? auth.householdId,
          scopes: auth.scopes,
        }),
      }
    );

    if (typeof result.body === "string") {
      return new NextResponse(result.body, {
        status: result.status,
        headers: result.headers,
      });
    }

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
 * Discovery / health. Auth is not required so agents can probe the URL.
 */
export async function GET() {
  return NextResponse.json({
    service: "ovenlovin-mcp",
    version: "0.1.0",
    status: "ok",
    transport: "stateless-http",
    auth: "ApiKey or Bearer rkapi_",
    timestamp: new Date().toISOString(),
  });
}
