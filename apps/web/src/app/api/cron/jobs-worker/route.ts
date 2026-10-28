import { after, NextRequest, NextResponse } from "next/server";
import { runNext } from "@ovenlovin/core/jobs";
import { cronAuthorized } from "@/lib/cron-auth";
import { jobHandlers } from "@/lib/job-handlers";
import { isBooksEnabled, jobQueue, kickWorker } from "@/lib/jobs";

/** Answers at once, runs one item after the response, then chains itself while work remains. */
export async function POST(request: NextRequest) {
  if (!isBooksEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = request.nextUrl.origin;
  after(async () => {
    const result = await runNext(jobQueue(), jobHandlers);
    if (result.status === "idle") return;
    await kickWorker(origin);
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
