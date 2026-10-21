import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  migrationHash,
  resolveMigrateDatabaseUrl,
  shouldBaseline,
  splitMigrationSql,
} from "./migrate-utils";

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");

describe("migrate helpers", () => {
  it("hashes migration SQL the same way drizzle-orm does", () => {
    expect(migrationHash("create table household();")).toMatch(/^[a-f0-9]{64}$/);
    expect(migrationHash("a")).not.toBe(migrationHash("b"));
  });

  it("baselines only when tables already exist and drizzle has no history", () => {
    expect(shouldBaseline({ householdExists: true, appliedCount: 0 })).toBe(true);
    expect(shouldBaseline({ householdExists: true, appliedCount: 1 })).toBe(false);
    expect(shouldBaseline({ householdExists: false, appliedCount: 0 })).toBe(false);
  });

  it("splits drizzle statement breakpoints", () => {
    expect(splitMigrationSql("create type a;--> statement-breakpoint\ncreate table b;")).toEqual([
      "create type a;",
      "create table b;",
    ]);
  });

  it("backfills meal_plan.cook_for when every night agrees", () => {
    const sql = readFileSync(join(drizzleDir, "0014_meal_plan_cook_for.sql"), "utf8");
    const statements = splitMigrationSql(sql);
    expect(statements[0]).toContain('ADD COLUMN "cook_for"');
    expect(statements[1]).toContain('COUNT(DISTINCT e."servings") = 1');
    expect(statements[1]).toContain('mp."cook_for" IS NULL');

    const nights = [
      { planId: "agreed", servings: 8 },
      { planId: "agreed", servings: 8 },
      { planId: "mixed", servings: 48 },
      { planId: "mixed", servings: 8 },
      { planId: "empty", servings: null },
    ];
    const backfill = new Map<string, number>();
    for (const planId of new Set(nights.map((night) => night.planId))) {
      const values = nights
        .filter((night) => night.planId === planId)
        .map((night) => night.servings)
        .filter((n): n is number => n != null && n > 0);
      const first = values[0];
      if (first != null && values.every((n) => n === first)) backfill.set(planId, first);
    }
    expect(Object.fromEntries(backfill)).toEqual({ agreed: 8 });
  });

  it("prefers an unpooled Neon URL for migrations", () => {
    expect(
      resolveMigrateDatabaseUrl({
        DATABASE_URL: "pooled",
        DATABASE_URL_UNPOOLED: "direct",
      })
    ).toBe("direct");
    expect(resolveMigrateDatabaseUrl({ POSTGRES_URL_NON_POOLING: "direct" })).toBe("direct");
    expect(resolveMigrateDatabaseUrl({ DATABASE_URL: "pooled" })).toBe("pooled");
    expect(resolveMigrateDatabaseUrl({})).toBeUndefined();
  });
});
