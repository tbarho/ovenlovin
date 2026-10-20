import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDatabase } from "@ovenlovin/db";
import { demoSandbox } from "@ovenlovin/db/schema";
import { ForbiddenError } from "@/lib/api/errors";
import type { RequestContext } from "@/lib/api/middleware";
import { decideDemoWrite, isMutatingMethod, nextCountersAfterSuccessfulImport } from "./limits";
import { isDemoModeEnabled } from "./mode";

export async function enforceDemoRequestGuards(
  request: NextRequest,
  context: RequestContext
): Promise<void> {
  if (!isDemoModeEnabled()) return;
  if (!context.householdId) return;

  const db = getDatabase();
  const [row] = await db
    .select()
    .from(demoSandbox)
    .where(eq(demoSandbox.householdId, context.householdId))
    .limit(1);
  if (!row || row.deletedAt) return;

  const decision = decideDemoWrite({
    pathname: request.nextUrl.pathname,
    method: request.method,
    counters: {
      importCount: row.importCount,
      writesInWindow: row.writesInWindow,
      windowStartedAt: row.windowStartedAt,
    },
  });

  if (!decision.ok) {
    throw new ForbiddenError(decision.reason, {
      code: decision.code,
      remainingImports: decision.remainingImports,
      importLimit: decision.importLimit,
      importCount: decision.importCount,
    });
  }

  if (!isMutatingMethod(request.method)) return;

  await db
    .update(demoSandbox)
    .set({
      importCount: decision.next.importCount,
      writesInWindow: decision.next.writesInWindow,
      windowStartedAt: decision.next.windowStartedAt,
      writeCount: row.writeCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(demoSandbox.id, row.id));
}

/** Count a demo import only after the recipe was actually created. */
export async function recordSuccessfulDemoImport(householdId: string): Promise<void> {
  if (!isDemoModeEnabled()) return;

  const db = getDatabase();
  const [row] = await db
    .select()
    .from(demoSandbox)
    .where(eq(demoSandbox.householdId, householdId))
    .limit(1);
  if (!row || row.deletedAt) return;

  const next = nextCountersAfterSuccessfulImport({
    importCount: row.importCount,
    writesInWindow: row.writesInWindow,
    windowStartedAt: row.windowStartedAt,
  });

  await db
    .update(demoSandbox)
    .set({
      importCount: next.importCount,
      updatedAt: new Date(),
    })
    .where(eq(demoSandbox.id, row.id));
}
