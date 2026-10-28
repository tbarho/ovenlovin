import { JobQueue, PermanentJobError, type JobHandlers } from "@ovenlovin/core/jobs";
import { getDatabase } from "@ovenlovin/db";
import { mapBookContents } from "@/lib/book-contents";
import { verifyBookImport } from "@/lib/book-import-verify";
import { cronHeaders } from "@/lib/cron-auth";

type EnvLike = Record<string, string | undefined>;

/** One flag for the whole bulk import + art book release. Off unless OVENLOVIN_BOOKS=1. */
export function isBooksEnabled(env: EnvLike = process.env): boolean {
  const flag = env.OVENLOVIN_BOOKS?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

export const jobHandlers: JobHandlers = {
  book_import: async (item) => {
    if (item.payload?.step === "verify") {
      return verifyBookImport(jobQueue(), item);
    }
    if (item.payload?.step === "contents") {
      return mapBookContents(jobQueue(), item);
    }
    throw new PermanentJobError(`No book_import step for ${JSON.stringify(item.payload)}`);
  },
};

export function jobQueue() {
  return new JobQueue(getDatabase());
}

/**
 * Starts a worker chain. The worker answers 202 before doing any work, so this
 * returns fast and never holds the caller open. A lost kick is safe: the
 * sweeper restarts the chain from whatever is still queued.
 */
export async function kickWorker(origin: string) {
  try {
    await fetch(`${origin}/api/cron/jobs-worker`, { method: "POST", headers: cronHeaders() });
  } catch (error) {
    console.error("Job worker kick failed", error);
  }
}
