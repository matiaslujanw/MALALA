import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getSupabaseDatabaseUrl } from "@/lib/db/env";
import * as schema from "@/lib/db/schema";

let sqlClient: ReturnType<typeof postgres> | undefined;
let dbClient: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getSqlClient() {
  if (!sqlClient) {
    sqlClient = postgres(getSupabaseDatabaseUrl(), {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }
  return sqlClient;
}

export function getDb() {
  if (!dbClient) {
    dbClient = drizzle(getSqlClient(), { schema });
  }
  return dbClient;
}
