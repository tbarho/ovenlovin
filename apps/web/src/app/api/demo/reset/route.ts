import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE_NAME } from "@/lib/demo/fixture";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { demoCookieOptions, resetDemoSandbox } from "@/lib/demo/sandbox";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export async function POST(request: NextRequest) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const sandbox = await resetDemoSandbox(request.cookies.get(DEMO_COOKIE_NAME)?.value);
    const response = NextResponse.json({ ok: true, next: "/recipes" });
    response.cookies.set(DEMO_COOKIE_NAME, sandbox.id, demoCookieOptions(cookieSecure()));
    return response;
  } catch {
    return NextResponse.json(
      { error: "Could not reset this kitchen. Try again." },
      { status: 500 }
    );
  }
}
