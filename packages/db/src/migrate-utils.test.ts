import { describe, expect, it } from "vitest";
import {
  migrationHash,
  resolveMigrateDatabaseUrl,
  shouldBaseline,
  splitMigrationSql,
} from "./migrate-utils";

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
