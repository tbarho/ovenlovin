import { NextRequest, NextResponse } from "next/server";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { wipeExpiredDemoSandboxes } from "@/lib/demo/sandbox";

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

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
