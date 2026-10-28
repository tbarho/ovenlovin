/* eslint-disable no-undef */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDbClient, type DbClient } from "@ovenlovin/db/client";
import { household } from "@ovenlovin/db";
import { JobQueue } from "./queue";
import { runNext } from "./run";

// Needs a migrated Postgres. CI provides one; locally:
// TEST_DATABASE_URL=postgresql://... pnpm --filter @ovenlovin/db db:migrate:deploy (with DATABASE_URL set to it)
const url = process.env.TEST_DATABASE_URL;
if (!url && process.env.CI) throw new Error("TEST_DATABASE_URL is required in CI");

describe.skipIf(!url)("JobQueue on Postgres", () => {
  let db: DbClient;
  let householdId: string;

  beforeAll(async () => {
    db = createDbClient(url!);
    const [row] = await db
      .insert(household)
      .values({
        name: "Job spine test",
        slug: `job-spine-${randomUUID()}`,
        createdBy: randomUUID(),
      })
      .returning({ id: household.id });
    householdId = row!.id;
  });

  beforeEach(async () => {
    await db.execute(sql`delete from job`);
  });

  afterAll(async () => {
    await db.execute(sql`delete from job`);
    await db.execute(sql`delete from household where id = ${householdId}`);
    await db.$client.end({ timeout: 5 });
  });

  const payloads = (count: number) => Array.from({ length: count }, (_, index) => ({ index }));

  it("never hands the same item to two concurrent claimers", async () => {
    const queue = new JobQueue(db);
    await queue.enqueue(householdId, "book_import", {}, payloads(5));

    const claims = await Promise.all(Array.from({ length: 20 }, () => queue.claim()));
    const ids = claims.filter(Boolean).map((item) => item!.id);

    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it("processes every item exactly once across parallel workers", async () => {
    const queue = new JobQueue(db);
    const jobId = await queue.enqueue(householdId, "book_import", {}, payloads(30));
    const seen: number[] = [];
    const handlers = {
      book_import: async (item: any) => {
        seen.push(item.seq);
        return { seq: item.seq };
      },
    };

    const worker = async () => {
      while ((await runNext(queue, handlers)).status !== "idle");
    };
    await Promise.all(Array.from({ length: 8 }, worker));

    expect(seen.sort((a, b) => a - b)).toEqual(payloads(30).map((p) => p.index));
    const done = await queue.get(jobId);
    expect(done).toMatchObject({ status: "done", doneItems: 30, failedItems: 0, totalItems: 30 });
    expect(done!.completedAt).toBeInstanceOf(Date);
  });

  it("re-claims an item once its lease expires and fences the stale worker", async () => {
    const queue = new JobQueue(db, { leaseMs: 1000 });
    await queue.enqueue(householdId, "book_import", {}, payloads(1));
    const t0 = new Date("2026-10-27T12:00:00.000Z");

    const first = await queue.claim(t0);
    expect(first).toMatchObject({ attempts: 1 });
    expect(await queue.claim(new Date(t0.getTime() + 500))).toBeNull();

    const second = await queue.claim(new Date(t0.getTime() + 2000));
    expect(second).toMatchObject({ id: first!.id, attempts: 2 });

    expect(await queue.complete(first!, { from: "stale" })).toBe(false);
    expect(await queue.complete(second!, { from: "fresh" })).toBe(true);
    const [item] = await queue.items(first!.jobId);
    expect(item).toMatchObject({ status: "done", result: { from: "fresh" } });
  });

  it("retries a failing item, then parks it with the error", async () => {
    const queue = new JobQueue(db, { maxAttempts: 3 });
    const jobId = await queue.enqueue(householdId, "book_import", {}, payloads(1));
    const handlers = {
      book_import: async () => {
        throw new Error("Page could not be read");
      },
    };

    const statuses = [];
    for (let run = 0; run < 4; run++) statuses.push((await runNext(queue, handlers)).status);

    expect(statuses).toEqual(["pending", "pending", "failed", "idle"]);
    const [item] = await queue.items(jobId);
    expect(item).toMatchObject({ status: "failed", attempts: 3, error: "Page could not be read" });
    expect(await queue.get(jobId)).toMatchObject({ status: "failed", failedItems: 1 });
  });

  it("parks an item whose last lease expired without a write back", async () => {
    const queue = new JobQueue(db, { leaseMs: 1000, maxAttempts: 1 });
    const jobId = await queue.enqueue(householdId, "book_import", {}, payloads(1));
    const t0 = new Date("2026-10-27T12:00:00.000Z");

    await queue.claim(t0);
    const later = new Date(t0.getTime() + 5000);
    expect(await queue.claimable(later)).toBe(0);
    expect(await queue.park(later)).toBe(1);

    const [item] = await queue.items(jobId);
    expect(item).toMatchObject({ status: "failed", error: "Timed out after 1 attempts" });
  });

  it("finds the live job for a file fingerprint so re-uploads resume", async () => {
    const queue = new JobQueue(db);
    const sha256 = "b".repeat(64);
    const jobId = await queue.enqueue(householdId, "book_import", { sha256 });

    expect(await queue.findBySha(householdId, "book_import", sha256)).toBe(jobId);
    expect(await queue.findBySha(householdId, "book_import", "c".repeat(64))).toBeNull();
    expect(await queue.findBySha(randomUUID(), "book_import", sha256)).toBeNull();

    await db.execute(sql`update job set status = 'failed' where id = ${jobId}`);
    expect(await queue.findBySha(householdId, "book_import", sha256)).toBeNull();
  });

  it("counts open jobs and jobs this month for entitlement checks", async () => {
    const queue = new JobQueue(db);
    await queue.enqueue(householdId, "book_import", {}, payloads(1));
    await queue.enqueue(householdId, "book_pdf", {}, payloads(1));

    expect(await queue.usage(householdId, "book_import")).toEqual({
      activeJobs: 1,
      jobsThisMonth: 1,
    });
  });
});
