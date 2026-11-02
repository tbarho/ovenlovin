import { JobQueue } from "@ovenlovin/core/jobs";
import { getDatabase } from "@ovenlovin/db";
import { cronHeaders } from "@/lib/cron-auth";

type EnvLike = Record<string, string | undefined>;

/** One flag for the whole bulk import + art book release. Off unless OVENLOVIN_BOOKS=1. */
export function isBooksEnabled(env: EnvLike = process.env): boolean {
  const flag = env.OVENLOVIN_BOOKS?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

export function jobQueue() {
  return new JobQueue(getDatabase());
}

/**
 * Starts a worker chain. The worker answers 202 before doing any work, so this
 * returns fast and never holds the caller open. A lost kick is safe: the
 * sweeper restarts the chain from whatever is still queued.
 */
export async function kickWorker(origin: string, env: EnvLike = process.env) {
  try {
    const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
    const response = await fetch(`${origin}/api/cron/jobs-worker`, {
      method: "POST",
      headers: {
        ...cronHeaders(),
        ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
      },
    });
    if (!response.ok) {
      console.error("Job worker kick failed", response.status);
    }
  } catch (error) {
    console.error("Job worker kick failed", error);
  }
}
