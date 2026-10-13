import { createHash } from "node:crypto";

export function migrationHash(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

export function shouldBaseline(input: { householdExists: boolean; appliedCount: number }): boolean {
  return input.householdExists && input.appliedCount === 0;
}

/** Prefer a direct (non-pooled) Neon URL so DDL works on deploy. */
export function resolveMigrateDatabaseUrl(env: {
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
  POSTGRES_URL_NON_POOLING?: string;
}): string | undefined {
  return env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
}

export function splitMigrationSql(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}
