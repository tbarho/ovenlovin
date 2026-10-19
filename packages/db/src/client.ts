import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { Sql } from "postgres";
import * as schema from "./schema";

type DbClient = PostgresJsDatabase<typeof schema> & { $client: Sql };

const clients = new Map<string, DbClient>();

export function getDatabase(): DbClient {
  // eslint-disable-next-line no-undef
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. See .env.example for setup instructions."
    );
  }
  return createDbClient(connectionString);
}

export function createDbClient(connectionString: string): DbClient {
  const existing = clients.get(connectionString);
  if (existing) return existing;
  const client = postgres(connectionString);
  const db = drizzle(client, { schema }) as DbClient;
  clients.set(connectionString, db);
  return db;
}

export type { DbClient };
