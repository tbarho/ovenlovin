/* eslint-disable @typescript-eslint/no-explicit-any -- jsonb job payloads */
import { eq, sql, type SQL } from "drizzle-orm";
import { job, jobItem } from "@ovenlovin/db";
import { BaseService } from "../services/base";

export const JOB_KINDS = ["book_import", "book_pdf"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_LEASE_MS = 2 * 60 * 1000;
export const JOB_MAX_ATTEMPTS = 3;

export type ClaimedItem = {
  id: string;
  jobId: string;
  householdId: string;
  kind: JobKind;
  seq: number;
  payload: any;
  attempts: number;
  leaseUntil: Date;
};

export type QueueOptions = { leaseMs?: number; maxAttempts?: number };

// Raw sql params skip drizzle's column mapping, so timestamps go over as ISO text.
const ts = (date: Date) => sql`${date.toISOString()}::timestamptz`;

const toItem = (row: any): ClaimedItem => ({
  id: row.id,
  jobId: row.job_id,
  householdId: row.household_id,
  kind: row.kind,
  seq: row.seq,
  payload: row.payload,
  attempts: row.attempts,
  leaseUntil: new Date(row.lease_until),
});

/**
 * Leased work queue on Postgres. Workers claim one item at a time with
 * FOR UPDATE SKIP LOCKED; every write back is fenced on (id, attempts) so a
 * worker whose lease expired can never overwrite the worker that replaced it.
 */
export class JobQueue extends BaseService {
  private leaseMs: number;
  private maxAttempts: number;

  constructor(db: any, options: QueueOptions = {}) {
    super(db);
    this.leaseMs = options.leaseMs ?? JOB_LEASE_MS;
    this.maxAttempts = options.maxAttempts ?? JOB_MAX_ATTEMPTS;
  }

  async enqueue(householdId: string, kind: JobKind, input: any, payloads: any[] = []) {
    const [created] = await this._db
      .insert(job)
      .values({ householdId, kind, input })
      .returning({ id: job.id });
    await this.addItems(created!.id, payloads);
    return created!.id;
  }

  /**
   * Appends items under the job row lock. With `uniqueBy`, payloads whose
   * value for that key is already queued on the job are skipped, so a repeated
   * request never doubles the work. Returns how many were added.
   */
  async addItems(jobId: string, payloads: any[], now = new Date(), uniqueBy?: string) {
    if (payloads.length === 0) return 0;
    return this._db.transaction(async (tx: any) => {
      const [locked] = await tx.execute(
        sql`select total_items from job where id = ${jobId} for update`
      );
      const start = Number(locked.total_items);
      const taken = uniqueBy
        ? new Set(
            [
              ...(await tx.execute(
                sql`select payload->>${uniqueBy} as key from job_item where job_id = ${jobId}`
              )),
            ].map((row: any) => row.key)
          )
        : new Set();
      const fresh = payloads.filter(
        (payload) => !uniqueBy || !taken.has(String(payload[uniqueBy]))
      );
      if (fresh.length === 0) return 0;
      await tx
        .insert(jobItem)
        .values(fresh.map((payload, index) => ({ jobId, seq: start + index, payload })));
      await tx.execute(sql`
        update job set
          total_items = total_items + ${fresh.length},
          status = case when status = 'running' then 'running' else 'queued' end,
          completed_at = null,
          updated_at = ${ts(now)}
        where id = ${jobId}
      `);
      return fresh.length;
    });
  }

  async claim(now = new Date()): Promise<ClaimedItem | null> {
    const leaseUntil = new Date(now.getTime() + this.leaseMs);
    const [row] = await this.rows(sql`
      with claimed as (
        update job_item set
          status = 'running',
          attempts = attempts + 1,
          lease_until = ${ts(leaseUntil)},
          updated_at = ${ts(now)}
        where id = (
          select id from job_item
          where attempts < ${this.maxAttempts}
            and (status = 'pending' or (status = 'running' and lease_until < ${ts(now)}))
          order by created_at, seq
          for update skip locked
          limit 1
        )
        returning *
      ),
      started as (
        update job set status = 'running', updated_at = ${ts(now)}
        from claimed
        where job.id = claimed.job_id and job.status = 'queued'
      )
      select claimed.*, job.kind, job.household_id
      from claimed join job on job.id = claimed.job_id
    `);
    return row ? toItem(row) : null;
  }

  async complete(item: ClaimedItem, result: any, now = new Date()) {
    const [row] = await this.rows(sql`
      update job_item set
        status = 'done',
        result = ${JSON.stringify(result ?? null)}::jsonb,
        error = null,
        lease_until = null,
        updated_at = ${ts(now)}
      where id = ${item.id} and status = 'running' and attempts = ${item.attempts}
      returning id
    `);
    if (!row) return false;
    await this.refresh([item.jobId], now);
    return true;
  }

  /** Back to pending for another try, or parked as failed once attempts run out. */
  async fail(item: ClaimedItem, error: string, now = new Date()) {
    const [row] = await this.rows(sql`
      update job_item set
        status = case when attempts >= ${this.maxAttempts} then 'failed' else 'pending' end,
        error = ${error},
        lease_until = null,
        updated_at = ${ts(now)}
      where id = ${item.id} and status = 'running' and attempts = ${item.attempts}
      returning status
    `);
    if (!row) return "lost" as const;
    await this.refresh([item.jobId], now);
    return row.status as "pending" | "failed";
  }

  /** Parks the item as failed now - for errors that will never succeed on retry. */
  async failPermanent(item: ClaimedItem, error: string, now = new Date()) {
    const [row] = await this.rows(sql`
      update job_item set
        status = 'failed',
        attempts = ${this.maxAttempts},
        error = ${error},
        lease_until = null,
        updated_at = ${ts(now)}
      where id = ${item.id} and status = 'running' and attempts = ${item.attempts}
      returning status
    `);
    if (!row) return "lost" as const;
    await this.refresh([item.jobId], now);
    return "failed" as const;
  }

  /** Parks items whose last allowed lease expired (the worker died mid-item). */
  async park(now = new Date()) {
    const rows = await this.rows(sql`
      update job_item set
        status = 'failed',
        error = coalesce(error, 'Timed out after ' || attempts || ' attempts'),
        lease_until = null,
        updated_at = ${ts(now)}
      where status = 'running' and lease_until < ${ts(now)} and attempts >= ${this.maxAttempts}
      returning job_id
    `);
    const jobIds = [...new Set(rows.map((row) => row.job_id as string))];
    await this.refresh(jobIds, now);
    return jobIds.length;
  }

  async claimable(now = new Date()) {
    const [row] = await this.rows(sql`
      select count(*)::int as count from job_item
      where attempts < ${this.maxAttempts}
        and (status = 'pending' or (status = 'running' and lease_until < ${ts(now)}))
    `);
    return Number(row.count);
  }

  /** Inputs for entitlement checks: jobs still open, and jobs started this calendar month (UTC). */
  async usage(householdId: string, kind: JobKind, now = new Date()) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [row] = await this.rows(sql`
      select
        count(*) filter (where status in ('queued', 'running'))::int as active,
        count(*) filter (where created_at >= ${ts(monthStart)})::int as month
      from job
      where household_id = ${householdId} and kind = ${kind}
    `);
    return { activeJobs: Number(row.active), jobsThisMonth: Number(row.month) };
  }

  /** The household's live job for this file, so the same upload resumes instead of starting over. */
  async findBySha(householdId: string, kind: JobKind, sha256: string) {
    const [row] = await this.rows(sql`
      select id from job
      where household_id = ${householdId} and kind = ${kind}
        and input->>'sha256' = ${sha256} and status <> 'failed'
      order by created_at desc
      limit 1
    `);
    return (row?.id as string | undefined) ?? null;
  }

  async get(jobId: string) {
    const [row] = await this._db.select().from(job).where(eq(job.id, jobId));
    return row ?? null;
  }

  /** Merges fields into job.input (used after the verify step finishes). */
  async patchInput(jobId: string, patch: Record<string, unknown>, now = new Date()) {
    await this._db.execute(sql`
      update job set
        input = coalesce(input, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb,
        updated_at = ${ts(now)}
      where id = ${jobId}
    `);
  }

  async items(jobId: string) {
    return this._db.select().from(jobItem).where(eq(jobItem.jobId, jobId)).orderBy(jobItem.seq);
  }

  private async rows(query: SQL): Promise<any[]> {
    return [...(await this._db.execute(query))];
  }

  /**
   * Rolls item counts up to the job. The job rows are locked first so the
   * counting statement takes its snapshot after every earlier writer committed;
   * otherwise two racing completions could leave stale totals behind.
   */
  private async refresh(jobIds: string[], now: Date) {
    if (jobIds.length === 0) return;
    const ids = sql.join(
      jobIds.map((id) => sql`${id}`),
      sql`, `
    );
    await this._db.transaction(async (tx: any) => {
      await tx.execute(sql`select id from job where id in (${ids}) order by id for update`);
      await tx.execute(sql`
        update job set
          done_items = c.done,
          failed_items = c.failed,
          status = case
            when c.open > 0 then 'running'
            when c.done = 0 and c.failed > 0 then 'failed'
            else 'done'
          end,
          completed_at = case when c.open > 0 then null else coalesce(job.completed_at, ${ts(now)}) end,
          updated_at = ${ts(now)}
        from (
          select job_id,
            count(*) filter (where status = 'done')::int as done,
            count(*) filter (where status = 'failed')::int as failed,
            count(*) filter (where status in ('pending', 'running'))::int as open
          from job_item
          where job_id in (${ids})
          group by job_id
        ) c
        where job.id = c.job_id
      `);
    });
  }
}
