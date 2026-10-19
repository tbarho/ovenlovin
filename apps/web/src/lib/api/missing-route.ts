import { NextRequest, NextResponse } from "next/server";

export function missingApiMessage(pathname: string): string {
  return `${pathname} is not an API route. Use /api/v1/{resource}, or mint a demo key with /api/demo/enter?format=json.`;
}

export function isApiOrMcpPath(pathname: string): boolean {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/mcp" ||
    pathname.startsWith("/mcp/")
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
  let origin = "https://your-app.vercel.app";
  try {
    origin = new URL(instance).origin;
  } catch {
    const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (configured) origin = configured;
  }
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
