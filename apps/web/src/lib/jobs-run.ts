import "@sparticuz/chromium";
import { after } from "next/server";
import { runNext } from "@ovenlovin/core/jobs";
import { jobHandlers } from "@/lib/job-handlers";
import { jobQueue, kickWorkerHttp, type EnvLike } from "@/lib/jobs";

/**
 * Runs queued work in this function when the public self-kick cannot reach
 * /api/cron/jobs-worker (Vercel SSO login redirect, missing bypass secret).
 * Tries an HTTP hop after each item so a later invocation can take over.
 */
export function continueWorker(origin: string, env: EnvLike = process.env, cookie?: string | null) {
  after(async () => {
    for (;;) {
      const result = await runNext(jobQueue(), jobHandlers);
      if (result.status === "idle") return;
      const kick = await kickWorkerHttp(origin, env, cookie);
      if (kick.ok) return;
    }
  });
}
