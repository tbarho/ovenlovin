import { NextRequest, NextResponse } from "next/server";
import { DEMO_ENTER_PATH, safeDemoEnterNext, wantsDemoEnterJson } from "@/lib/demo/enter";
import { DEMO_COOKIE_NAME } from "@/lib/demo/fixture";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { demoCookieOptions, getOrCreateDemoSandbox } from "@/lib/demo/sandbox";
import { resolveOrigin } from "@/lib/origin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

/**
 * Seeds (or reuses) a visitor sandbox and sets `ol_demo_sandbox`.
 *
 * Browser navigation: 303 to `next` (default `/recipes`).
 * Agents: `?format=json` returns the MCP URL and sandbox API key so a test
 * client can authenticate without scraping Settings. Accept: application/json
 * alone is not enough, so a wrong API base path does not mint a key.
 */
export async function GET(request: NextRequest) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sandbox = await getOrCreateDemoSandbox(request.cookies.get(DEMO_COOKIE_NAME)?.value);
  const origin = resolveOrigin(request.headers);
  const next = safeDemoEnterNext(request.nextUrl.searchParams.get("next"));
  const mcpUrl = `${origin.replace(/\/$/, "")}/mcp`;

  const json = wantsDemoEnterJson({
    accept: request.headers.get("accept"),
    format: request.nextUrl.searchParams.get("format"),
    secFetchDest: request.headers.get("sec-fetch-dest"),
  });

  const response = json
    ? NextResponse.json({
        ok: true,
        mcpUrl,
        apiKey: sandbox.apiKeyPlaintext,
        authorization: `ApiKey ${sandbox.apiKeyPlaintext}`,
        householdId: sandbox.householdId,
        expiresAt: sandbox.expiresAt.toISOString(),
        transport: "stateless-http",
        enter: DEMO_ENTER_PATH,
        next,
      })
    : NextResponse.redirect(new URL(next, request.url), 303);

  response.cookies.set(DEMO_COOKIE_NAME, sandbox.id, demoCookieOptions(cookieSecure()));
  return response;
}
