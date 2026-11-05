import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { isBooksEnabled, jobQueue, kickFromRequest } from "@/lib/jobs";

/** Fails jobs that stopped progressing, parks spent leases, and restarts the worker chain. */
export async function GET(request: NextRequest) {
  if (!isBooksEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queue = jobQueue();
  const stale = await queue.failStale();
  const parked = await queue.park();
  const claimable = await queue.claimable();
  if (claimable > 0) await kickFromRequest(request);

  return NextResponse.json({ ok: true, stale, parked, claimable, at: new Date().toISOString() });
}
