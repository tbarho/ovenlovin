import { DEMO_IMPORT_LIMIT, DEMO_WRITE_LIMIT_PER_HOUR } from "./fixture";

export const DEMO_WRITE_WINDOW_MS = 60 * 60 * 1000;

export type DemoLimitCounters = {
  importCount: number;
  writesInWindow: number;
  windowStartedAt: Date;
};

export type DemoLimitDecision =
  | { ok: true; next: DemoLimitCounters; remainingImports: number }
  | {
      ok: false;
      reason: string;
      code: "import_cap" | "write_rate" | "uploads_off" | "ai_off";
      remainingImports?: number;
      importLimit?: number;
      importCount?: number;
      resetAt?: string;
      retryAfter?: number;
    };

export function remainingImportsFromCount(importCount: number): number {
  return Math.max(0, DEMO_IMPORT_LIMIT - importCount);
}

/** Demo write quota: POST/PUT/PATCH only. Deletes stay free so testers can clean up. */
export function isMutatingMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH"].includes(method.toUpperCase());
}

export function isDemoUploadPath(pathname: string): boolean {
  return pathname === "/api/v1/uploads/images" || pathname.startsWith("/api/v1/uploads/images/");
}

export function isDemoImportPath(pathname: string): boolean {
  return (
    pathname === "/api/v1/recipes/import" ||
    pathname === "/api/v1/recipes/import/page" ||
    pathname === "/api/v1/recipes/import/photo" ||
    pathname.includes("import_recipe") ||
    pathname.includes("import_recipe_from_image")
  );
}

export function rollWriteWindow(counters: DemoLimitCounters, now = new Date()): DemoLimitCounters {
  if (now.getTime() - counters.windowStartedAt.getTime() >= DEMO_WRITE_WINDOW_MS) {
    return { ...counters, windowStartedAt: now, writesInWindow: 0 };
  }
  return counters;
}

export function writeWindowReset(
  counters: DemoLimitCounters,
  now = new Date()
): { resetAt: string; retryAfter: number } {
  const resetAt = new Date(counters.windowStartedAt.getTime() + DEMO_WRITE_WINDOW_MS);
  return {
    resetAt: resetAt.toISOString(),
    retryAfter: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  };
}

export function decideDemoWrite(input: {
  pathname: string;
  method: string;
  counters: DemoLimitCounters;
  now?: Date;
  preview?: boolean;
}): DemoLimitDecision {
  if (!isMutatingMethod(input.method) || input.preview) {
    return {
      ok: true,
      next: input.counters,
      remainingImports: remainingImportsFromCount(input.counters.importCount),
    };
  }
  if (isDemoUploadPath(input.pathname)) {
    return {
      ok: false,
      code: "uploads_off",
      reason: "Image uploads are turned off in the public demo.",
    };
  }

  const now = input.now ?? new Date();
  let next = rollWriteWindow(input.counters, now);

  if (isDemoImportPath(input.pathname)) {
    if (next.importCount >= DEMO_IMPORT_LIMIT) {
      return {
        ok: false,
        code: "import_cap",
        remainingImports: 0,
        importLimit: DEMO_IMPORT_LIMIT,
        importCount: next.importCount,
        reason: `This demo sandbox allows ${DEMO_IMPORT_LIMIT} recipe imports. 0 remaining.`,
      };
    }
    // Import count increments only after a successful import (see recordSuccessfulDemoImport).
  }

  if (next.writesInWindow >= DEMO_WRITE_LIMIT_PER_HOUR) {
    return {
      ok: false,
      code: "write_rate",
      reason: `This demo sandbox allows ${DEMO_WRITE_LIMIT_PER_HOUR} writes per hour.`,
      ...writeWindowReset(next, now),
    };
  }

  return {
    ok: true,
    remainingImports: remainingImportsFromCount(next.importCount),
    next: {
      ...next,
      writesInWindow: next.writesInWindow + 1,
    },
  };
}

export function nextCountersAfterSuccessfulImport(counters: DemoLimitCounters): DemoLimitCounters {
  return { ...counters, importCount: counters.importCount + 1 };
}
