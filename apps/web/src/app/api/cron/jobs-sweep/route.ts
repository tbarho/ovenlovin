import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { isBooksEnabled, jobQueue, kickWorker } from "@/lib/jobs";

/** Parks items that ran out of attempts and restarts the worker chain if anything is left. */
export async function GET(request: NextRequest) {
  if (!isBooksEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queue = jobQueue();
  const parked = await queue.park();
  const claimable = await queue.claimable();
  if (claimable > 0) await kickWorker(request.nextUrl.origin);

  return NextResponse.json({ ok: true, parked, claimable, at: new Date().toISOString() });
}
