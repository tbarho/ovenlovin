/**
 * MCP Streamable HTTP endpoint.
 *
 * POST /mcp  — JSON-RPC (stateless, one request per POST)
 * GET  /mcp  — health
 *
 * Auth: `Authorization: ApiKey <rkapi_…>` or `Bearer <rkapi_…>` / Clerk JWT.
 * Household is derived from the key. No stub household, no shared transport.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, handleHttpRequest } from "@ovenlovin/mcp";

const SERVER_INFO = {
  name: "ovenlovin-mcp",
  version: "0.1.0",
};

function collectHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function jsonRpcUnauthorized(id: unknown, message: string) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32001, message },
    },
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: NextRequest) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400 }
    );
  }

  const headers = collectHeaders(request);
  const id =
    body && typeof body === "object" && !Array.isArray(body) && "id" in body
      ? (body as { id?: unknown }).id
      : null;

  try {
    const result = await handleHttpRequest(
      null,
      {
        method: "POST",
        body: body as { jsonrpc?: string; id?: string | number | null; method?: string },
        headers,
      },
      {
        requireAuth: true,
        serverInfo: SERVER_INFO,
        onAuth: async () => authenticateRequest(headers),
      }
    );

    if (!result.body) {
      return new NextResponse(null, { status: result.status, headers: result.headers });
    }

    return new NextResponse(result.body, {
      status: result.status,
      headers: result.headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "unauthorized"
    ) {
      return jsonRpcUnauthorized(id, message);
    }
    console.error("MCP request error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: id ?? null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "ovenlovin-mcp",
    version: SERVER_INFO.version,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
