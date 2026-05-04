import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getSupabaseDatabaseUrl } from "@/lib/db/env";
import * as schema from "@/lib/db/schema";

const globalForPostgres = globalThis as unknown as {
  sqlClient: ReturnType<typeof postgres> | undefined;
  dbClient: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

export function getSqlClient() {
  if (!globalForPostgres.sqlClient) {
    globalForPostgres.sqlClient = postgres(getSupabaseDatabaseUrl(), {
      prepare: false,
      max: 15,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }
  return globalForPostgres.sqlClient;
}

export function getDb() {
  if (!globalForPostgres.dbClient) {
    globalForPostgres.dbClient = drizzle(getSqlClient(), { schema });
  }
  return globalForPostgres.dbClient;
}
