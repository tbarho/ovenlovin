import { JobQueue } from "@ovenlovin/core/jobs";
import { getDatabase } from "@ovenlovin/db";
import { cronHeaders } from "@/lib/cron-auth";

export type EnvLike = Record<string, string | undefined>;

/** One flag for the whole bulk import + art book release. Off unless OVENLOVIN_BOOKS=1. */
export function isBooksEnabled(env: EnvLike = process.env): boolean {
  const flag = env.OVENLOVIN_BOOKS?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

export function jobQueue() {
  return new JobQueue(getDatabase());
}

const BYPASS_QUERY = "x-vercel-protection-bypass";

export type KickResult = {
  ok: boolean;
  redirected: boolean;
  status: number;
  location: string | null;
};

/** Unique deployment host when Vercel provides one; otherwise the request origin. */
export function workerKickOrigin(origin: string, env: EnvLike = process.env) {
  const host = env.VERCEL_URL?.trim().replace(/^https?:\/\//, "");
  return host ? `https://${host}` : origin;
}

export function readKickResponse(response: {
  status: number;
  headers: { get: (name: string) => string | null };
}): KickResult {
  const redirected = response.status >= 300 && response.status < 400;
  return {
    ok: response.status >= 200 && response.status < 300,
    redirected,
    status: response.status,
    location: response.headers.get("location"),
  };
}

/** URL and headers for a self-kick to /api/cron/jobs-worker. */
export function workerKickRequest(
  origin: string,
  env: EnvLike = process.env,
  cookie?: string | null
) {
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  const url = new URL("/api/cron/jobs-worker", workerKickOrigin(origin, env));
  if (bypass) url.searchParams.set(BYPASS_QUERY, bypass);
  const headers: Record<string, string> = {
    ...cronHeaders(env),
    ...(bypass
      ? {
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "true",
        }
      : {}),
    ...(cookie?.trim() ? { cookie: cookie.trim() } : {}),
  };
  return { url: url.toString(), headers };
}

export async function kickWorkerHttp(
  origin: string,
  env: EnvLike = process.env,
  cookie?: string | null
): Promise<KickResult> {
  const { url, headers } = workerKickRequest(origin, env, cookie);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const result = readKickResponse(response);
    if (!result.ok) {
      console.error("Job worker kick failed", result.status, {
        redirected: result.redirected,
        location: result.location,
        hasAuthorization: Boolean(headers.authorization),
        hasProtectionBypass: Boolean(env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()),
        hasCookie: Boolean(cookie?.trim()),
        usedVercelUrl: Boolean(env.VERCEL_URL?.trim()),
      });
    }
    return result;
  } catch (error) {
    console.error("Job worker kick failed", error);
    return { ok: false, redirected: false, status: 0, location: null };
  }
}

/**
 * Starts a worker chain. Prefers a new jobs-worker invocation (180s / 2GB).
 * If that HTTP hop is redirected or unauthorized, run the queue in-process
 * after the response so preview SSO cannot leave the job at 0/N.
 */
export async function kickWorker(
  origin: string,
  env: EnvLike = process.env,
  cookie?: string | null
) {
  const kick = await kickWorkerHttp(origin, env, cookie);
  if (kick.ok) return;
  const { continueWorker } = await import("@/lib/jobs-run");
  continueWorker(origin, env, cookie);
}

export function kickFromRequest(
  request: { url: string; headers: Headers },
  env: EnvLike = process.env
) {
  return kickWorker(new URL(request.url).origin, env, request.headers.get("cookie"));
}
