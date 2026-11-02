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

const BYPASS_QUERY = "x-vercel-protection-bypass";

/** URL and headers for a self-kick to /api/cron/jobs-worker. */
export function workerKickRequest(origin: string, env: EnvLike = process.env) {
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  const url = new URL("/api/cron/jobs-worker", origin);
  if (bypass) url.searchParams.set(BYPASS_QUERY, bypass);
  const headers: Record<string, string> = {
    ...cronHeaders(env),
    ...(bypass
      ? {
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "true",
        }
      : {}),
  };
  return { url: url.toString(), headers };
}

/**
 * Starts a worker chain. The worker answers 202 before doing any work, so this
 * returns fast and never holds the caller open. A lost kick is safe: the
 * sweeper restarts the chain from whatever is still queued.
 */
export async function kickWorker(origin: string, env: EnvLike = process.env) {
  try {
    const { url, headers } = workerKickRequest(origin, env);
    const response = await fetch(url, { method: "POST", headers });
    if (!response.ok) {
      console.error("Job worker kick failed", response.status, {
        hasAuthorization: Boolean(headers.authorization),
        hasProtectionBypass: Boolean(env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()),
      });
    }
  } catch (error) {
    console.error("Job worker kick failed", error);
  }
}
