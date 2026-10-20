/**
 * MCP Streamable HTTP endpoint.
 *
 * POST /mcp - JSON-RPC (stateless, one request per POST)
 * GET  /mcp - health
 *
 * Auth: `Authorization: ApiKey <rkapi_…>` or `Bearer <rkapi_…>` / Clerk JWT.
 * Household is derived from the key. No stub household, no shared transport.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, handleHttpRequest } from "@ovenlovin/mcp";
import { ForbiddenError } from "@/lib/api/errors";
import { recordSuccessfulDemoImport } from "@/lib/demo/enforce";
import { enforceDemoMcpGuards, isSuccessfulImportRecipeCall } from "@/lib/demo/mcp-guard";
import { isDemoModeEnabled } from "@/lib/demo/mode";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function jsonRpcError(id: unknown, status: number, code: number, message: string) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    },
    { status, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: NextRequest) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, 400, -32700, "Parse error");
  }

  const headers = collectHeaders(request);
  const id =
    body && typeof body === "object" && !Array.isArray(body) && "id" in body
      ? (body as { id?: unknown }).id
      : null;

  try {
    const auth = await authenticateRequest(headers);
    if (isDemoModeEnabled()) {
      await enforceDemoMcpGuards(request, auth.householdId, body);
    }

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
        onAuth: async () => auth,
      }
    );

    if (
      isDemoModeEnabled() &&
      result.status < 400 &&
      isSuccessfulImportRecipeCall(body, result.body)
    ) {
      await recordSuccessfulDemoImport(auth.householdId);
    }

    if (!result.body) {
      return new NextResponse(null, { status: result.status, headers: result.headers });
    }

    return new NextResponse(result.body, {
      status: result.status,
      headers: result.headers,
    });
  } catch (error) {
    const message = authErrorMessage(error, "Unauthorized");
    if (error instanceof ForbiddenError) {
      return jsonRpcError(id, 403, -32003, error.detail ?? message);
    }
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "forbidden") {
        return jsonRpcError(id, 403, -32003, message);
      }
      if (code === "unauthorized" || code === "invalid_token") {
        return jsonRpcError(id, 401, -32001, message);
      }
    }
    console.error("MCP request error:", error);
    return jsonRpcError(id, 500, -32603, authErrorMessage(error, "Internal error"));
  }
}

export async function GET() {
  return NextResponse.json({
    service: "ovenlovin-mcp",
    version: SERVER_INFO.version,
    status: "ok",
    transport: "stateless-http",
    auth: "ApiKey or Bearer rkapi_",
    timestamp: new Date().toISOString(),
  });
}
