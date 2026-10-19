import { and, eq } from "drizzle-orm";
import { importDedupe } from "@ovenlovin/db";
import type { ImportDedupeKind } from "../media/prepare-import-draft";
import { BaseService } from "./base";

export const IMPORT_DEDUPE_TTL_MS = 3 * 60 * 1000;

export type ImportDedupeClaim =
  { status: "claimed" } | { status: "in_flight" } | { status: "completed"; recipeId: string };

export function resolveDedupeClaim(
  row: { status: string; recipeId: string | null; expiresAt: Date | null },
  now = new Date()
): "steal" | "in_flight" | "completed" {
  if (row.status === "completed" && row.recipeId) return "completed";
  if (row.status === "in_flight" && row.expiresAt && row.expiresAt.getTime() > now.getTime()) {
    return "in_flight";
  }
  return "steal";
}

export class ImportDedupeService extends BaseService {
  async claim(
    householdId: string,
    kind: ImportDedupeKind,
    key: string,
    now = new Date()
  ): Promise<ImportDedupeClaim> {
    const expiresAt = new Date(now.getTime() + IMPORT_DEDUPE_TTL_MS);
    const inserted = await this._db
      .insert(importDedupe)
      .values({
        householdId,
        kind,
        dedupeKey: key,
        status: "in_flight",
        expiresAt,
      })
      .onConflictDoNothing({
        target: [importDedupe.householdId, importDedupe.kind, importDedupe.dedupeKey],
      })
      .returning();

    if (inserted[0]) return { status: "claimed" };

    const [row] = await this._db
      .select()
      .from(importDedupe)
      .where(
        and(
          eq(importDedupe.householdId, householdId),
          eq(importDedupe.kind, kind),
          eq(importDedupe.dedupeKey, key)
        )
      )
      .limit(1);

    if (!row) return { status: "claimed" };

    const resolution = resolveDedupeClaim(row, now);
    if (resolution === "completed" && row.recipeId) {
      return { status: "completed", recipeId: row.recipeId };
    }
    if (resolution === "in_flight") {
      return { status: "in_flight" };
    }

    await this._db
      .update(importDedupe)
      .set({
        status: "in_flight",
        recipeId: null,
        expiresAt,
        updatedAt: now,
      })
      .where(eq(importDedupe.id, row.id));
    return { status: "claimed" };
  }

  async complete(
    householdId: string,
    kind: ImportDedupeKind,
    key: string,
    recipeId: string
  ): Promise<void> {
    await this._db
      .update(importDedupe)
      .set({
        status: "completed",
        recipeId,
        expiresAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(importDedupe.householdId, householdId),
          eq(importDedupe.kind, kind),
          eq(importDedupe.dedupeKey, key)
        )
      );
  }

  async release(householdId: string, kind: ImportDedupeKind, key: string): Promise<void> {
    await this._db
      .delete(importDedupe)
      .where(
        and(
          eq(importDedupe.householdId, householdId),
          eq(importDedupe.kind, kind),
          eq(importDedupe.dedupeKey, key),
          eq(importDedupe.status, "in_flight")
        )
      );
  }
}
