import { DEMO_IMPORT_LIMIT, DEMO_WRITE_LIMIT_PER_HOUR } from "./fixture";

export const DEMO_WRITE_WINDOW_MS = 60 * 60 * 1000;

export type DemoLimitCounters = {
  importCount: number;
  writesInWindow: number;
  windowStartedAt: Date;
};

export type DemoLimitDecision =
  | { ok: true; next: DemoLimitCounters }
  | { ok: false; reason: string; code: "import_cap" | "write_rate" | "uploads_off" | "ai_off" };

export function isMutatingMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export function isDemoUploadPath(pathname: string): boolean {
  return pathname === "/api/v1/uploads/images" || pathname.startsWith("/api/v1/uploads/images/");
}

export function isDemoImportPath(pathname: string): boolean {
  return (
    pathname === "/api/v1/recipes/import" ||
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

export function decideDemoWrite(input: {
  pathname: string;
  method: string;
  counters: DemoLimitCounters;
  now?: Date;
}): DemoLimitDecision {
  if (!isMutatingMethod(input.method)) {
    return { ok: true, next: input.counters };
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
        reason: `This demo sandbox allows ${DEMO_IMPORT_LIMIT} recipe imports.`,
      };
    }
    // Import count increments only after a successful import (see recordSuccessfulDemoImport).
  }

  if (next.writesInWindow >= DEMO_WRITE_LIMIT_PER_HOUR) {
    return {
      ok: false,
      code: "write_rate",
      reason: `This demo sandbox allows ${DEMO_WRITE_LIMIT_PER_HOUR} writes per hour.`,
    };
  }

  return {
    ok: true,
    next: {
      ...next,
      writesInWindow: next.writesInWindow + 1,
    },
  };
}

export function nextCountersAfterSuccessfulImport(counters: DemoLimitCounters): DemoLimitCounters {
  return { ...counters, importCount: counters.importCount + 1 };
}
