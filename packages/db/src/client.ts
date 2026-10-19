import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { Sql } from "postgres";
import * as schema from "./schema";

type DbClient = PostgresJsDatabase<typeof schema> & { $client: Sql };

let dbInstance: DbClient | null = null;

export function getDatabase(): DbClient {
  if (!dbInstance) {
    // eslint-disable-next-line no-undef
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL environment variable is not set. See .env.example for setup instructions."
      );
    }
    const client = postgres(connectionString);
    dbInstance = drizzle(client, { schema }) as DbClient;
  }
  return dbInstance;
}

export function createDbClient(connectionString: string): DbClient {
  // shortcut: one process-wide pool, when a tool needs a second database
  process.env.DATABASE_URL ??= connectionString;
  return getDatabase();
}

export type { DbClient };
