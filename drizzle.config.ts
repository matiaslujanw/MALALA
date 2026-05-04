import "./envConfig";
import { defineConfig } from "drizzle-kit";

const connectionString =
  process.env.SUPABASE_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: connectionString,
  },
  strict: true,
  verbose: true,
});
