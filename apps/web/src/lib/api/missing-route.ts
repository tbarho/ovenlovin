import { NextRequest, NextResponse } from "next/server";
import { isClerkProtectExempt } from "@/lib/clerk-protect";
import { isDemoModeEnabled, type EnvLike } from "@/lib/demo/mode";

export function missingApiMessage(pathname: string, env: EnvLike = process.env): string {
  const prefix = `${pathname} is not an API route. Use /api/v1/{resource}.`;
  if (isDemoModeEnabled(env)) {
    return `${prefix} For a no-signup sandbox key, call /api/demo/enter?format=json.`;
  }
  return `${prefix} Create a key under Settings, then API keys, on this origin.`;
}

export function isApiOrMcpPath(pathname: string): boolean {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/mcp" ||
    pathname.startsWith("/mcp/") ||
    isClerkProtectExempt(pathname)
  );
}

/**
 * Agents that send an ApiKey (or JSON Accept without HTML) to a kitchen
 * HTML path must get problem+json 404, never a demo-sandbox redirect.
 */
export function isApiShapedRequest(input: {
  authorization: string | null | undefined;
  accept: string | null | undefined;
}): boolean {
  const auth = input.authorization ?? "";
  if (/^\s*apikey\b/i.test(auth)) return true;
  if (/^\s*bearer\s+rkapi_/i.test(auth)) return true;
  const accept = (input.accept ?? "").toLowerCase();
  if (!accept) return false;
  const wantsJson =
    accept.includes("application/json") || accept.includes("application/problem+json");
  const wantsHtml = accept.includes("text/html");
  return wantsJson && !wantsHtml;
}

export function missingApiResponse(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  const instance = request.url;
  const origin = new URL(instance).origin;
  return NextResponse.json(
    {
      type: `${origin}/problems/not-found`,
      title: "Not Found",
      status: 404,
      detail: missingApiMessage(pathname),
      instance,
    },
    {
      status: 404,
      headers: { "Content-Type": "application/problem+json" },
    }
  );
}
