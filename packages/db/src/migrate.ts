/* eslint-disable no-undef */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { migrationHash, resolveMigrateDatabaseUrl, shouldBaseline } from "./migrate-utils";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, "../drizzle");

async function main() {
  const connectionString = resolveMigrateDatabaseUrl(process.env);
  if (!connectionString) {
    console.log("DATABASE_URL is not set; skipping migrations.");
    return;
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    const household = await sql`
      select 1 from pg_tables
      where schemaname = 'public' and tablename = 'household'
    `;
    const applied = await sql`
      select count(*)::int as count
      from information_schema.tables
      where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
    `;
    let appliedCount = 0;
    if ((applied[0]?.count ?? 0) > 0) {
      const rows = await sql`select count(*)::int as count from drizzle.__drizzle_migrations`;
      appliedCount = rows[0]?.count ?? 0;
    }

    if (shouldBaseline({ householdExists: household.length > 0, appliedCount })) {
      const journal = JSON.parse(
        readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8")
      ) as {
        entries: Array<{ tag: string; when: number }>;
      };
      const first = journal.entries[0];
      if (!first) throw new Error("No migrations found to baseline");
      const query = readFileSync(join(migrationsFolder, `${first.tag}.sql`), "utf8");
      await sql`create schema if not exists drizzle`;
      await sql`
        create table if not exists drizzle.__drizzle_migrations (
          id serial primary key,
          hash text not null,
          created_at bigint
        )
      `;
      await sql`
        insert into drizzle.__drizzle_migrations (hash, created_at)
        values (${migrationHash(query)}, ${first.when})
      `;
      console.log(`Baselined existing schema as ${first.tag}`);
    }

    const db = drizzle(sql);
    await migrate(db, { migrationsFolder });
    console.log("Migrations applied.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
