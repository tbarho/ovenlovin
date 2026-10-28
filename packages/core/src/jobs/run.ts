/* eslint-disable @typescript-eslint/no-explicit-any -- jsonb job payloads */
import type { ClaimedItem, JobKind, JobQueue } from "./queue";

// eslint-disable-next-line no-unused-vars
export type JobHandler = (item: ClaimedItem) => Promise<any>;
export type JobHandlers = Partial<Record<JobKind, JobHandler>>;

export type RunResult =
  { status: "idle" } | { status: "done" | "pending" | "failed" | "lost"; item: ClaimedItem };

const message = (error: any) => (error instanceof Error ? error.message : String(error));

/**
 * One unit of work: claim an item, run its handler, write the result.
 * Substrate-agnostic: a Vercel route, a Lambda, or a spot box can call this
 * in a loop. Handlers must be idempotent per item; a retry may repeat work.
 */
export async function runNext(queue: JobQueue, handlers: JobHandlers): Promise<RunResult> {
  await queue.park();
  const item = await queue.claim();
  if (!item) return { status: "idle" };

  const handler = handlers[item.kind];
  if (!handler) {
    return { status: await queue.fail(item, `No handler for ${item.kind}`), item };
  }

  try {
    const result = await handler(item);
    return { status: (await queue.complete(item, result)) ? "done" : "lost", item };
  } catch (error) {
    return { status: await queue.fail(item, message(error)), item };
  }
}
