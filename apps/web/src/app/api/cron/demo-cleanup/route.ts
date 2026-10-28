import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { wipeExpiredDemoSandboxes } from "@/lib/demo/sandbox";

export async function GET(request: NextRequest) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await wipeExpiredDemoSandboxes();
  return NextResponse.json({
    ok: true,
    wiped: result.wiped,
    at: new Date().toISOString(),
  });
}
