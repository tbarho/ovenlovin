import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { Sql } from "postgres";
import * as schema from "./schema";

type DbClient = PostgresJsDatabase<typeof schema> & { $client: Sql };

// On globalThis: Next dev gives every route bundle its own copy of this module,
// and a pool per bundle exhausts Postgres connections.
const store = globalThis as { __ovenlovinDbClients?: Map<string, DbClient> };
const clients = (store.__ovenlovinDbClients ??= new Map<string, DbClient>());

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
