/* eslint-disable @typescript-eslint/no-explicit-any -- jsonb job payloads */
import type { ClaimedItem, JobKind, JobQueue } from "./queue";

// eslint-disable-next-line no-unused-vars
export type JobHandler = (item: ClaimedItem) => Promise<any>;
export type JobHandlers = Partial<Record<JobKind, JobHandler>>;

export type RunResult =
  | { status: "idle" }
  | { status: "done"; itemId: string; result: any }
  | { status: "failed"; itemId: string; error: string };

/**
 * Claims one item, runs its handler, and records the outcome. Returns idle when
 * the queue is empty. Safe to call from many workers at once.
 */
export async function runNext(queue: JobQueue, handlers: JobHandlers, now = new Date()): Promise<RunResult> {
  const item = await queue.claim(now);
  if (!item) return { status: "idle" };

  const handler = handlers[item.kind];
  if (!handler) {
    const error = `No handler registered for job kind "${item.kind}"`;
    await queue.fail(item.id, item.attempts, error, now);
    return { status: "failed", itemId: item.id, error };
  }

  try {
    const result = await handler(item);
    await queue.complete(item.id, item.attempts, result ?? {}, now);
    return { status: "done", itemId: item.id, result: result ?? {} };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await queue.fail(item.id, item.attempts, message, now);
    return { status: "failed", itemId: item.id, error: message };
  }
}
