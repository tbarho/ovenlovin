/* eslint-disable no-undef */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  migrationHash,
  resolveMigrateDatabaseUrl,
  shouldBaseline,
  splitMigrationSql,
} from "./migrate-utils";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, "../drizzle");

type Journal = { entries: Array<{ tag: string; when: number }> };

async function main() {
  const connectionString = resolveMigrateDatabaseUrl(process.env);
  if (!connectionString) {
    console.log("DATABASE_URL is not set; skipping migrations.");
    return;
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });

  try {
    const journal = JSON.parse(
      readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8")
    ) as Journal;
    const migrations = journal.entries.map((entry) => {
      const query = readFileSync(join(migrationsFolder, `${entry.tag}.sql`), "utf8");
      return { ...entry, query, hash: migrationHash(query) };
    });

    const household = await sql`
      select 1 from pg_tables
      where schemaname = 'public' and tablename = 'household'
    `;

    await sql`create schema if not exists drizzle`;
    await sql`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `;

    const appliedRows = await sql`select hash from drizzle.__drizzle_migrations`;

    if (
      shouldBaseline({ householdExists: household.length > 0, appliedCount: appliedRows.length })
    ) {
      for (const migration of migrations) {
        await sql`
          insert into drizzle.__drizzle_migrations (hash, created_at)
          values (${migration.hash}, ${migration.when})
        `;
      }
      console.log(`Baselined existing schema (${migrations.map((item) => item.tag).join(", ")})`);
    }

    const applied = new Set(
      (await sql`select hash from drizzle.__drizzle_migrations`).map((row) => String(row.hash))
    );

    for (const migration of migrations) {
      if (applied.has(migration.hash)) continue;
      for (const statement of splitMigrationSql(migration.query)) {
        await sql.unsafe(statement);
      }
      await sql`
        insert into drizzle.__drizzle_migrations (hash, created_at)
        values (${migration.hash}, ${migration.when})
      `;
      console.log(`Applied ${migration.tag}`);
    }

    console.log("Migrations applied.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
