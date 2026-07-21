/**
 * Aplica UN archivo .sql de drizzle/ a la base configurada en SUPABASE_DATABASE_URL.
 * A diferencia de `db:push`, no compara el schema entero: corre exactamente el SQL
 * del archivo. Pensado para migraciones aditivas idempotentes.
 * Uso: npx tsx scripts/apply-migration.ts drizzle/0024_servicios_visible_reserva.sql
 */
import "../envConfig";
import { readFileSync } from "node:fs";
import { getSqlClient } from "../src/lib/db/client/postgres";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Falta la ruta del .sql");
    process.exit(1);
  }
  const raw = readFileSync(file, "utf8");
  // El pooler corre en modo transacción (pgbouncer): rechaza BEGIN/COMMIT
  // explícitos. Los quitamos y corremos cada statement por separado.
  const statements = raw
    .split("\n")
    // Fuera líneas de comentario y control de transacción (el pooler las rechaza).
    .filter((l) => !/^\s*--/.test(l))
    .filter((l) => !/^\s*(BEGIN|COMMIT|START TRANSACTION)\s*;?\s*$/i.test(l))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Aplicando ${file} (${statements.length} statement/s) ...`);
  const client = getSqlClient();
  for (const st of statements) {
    console.log(`  → ${st.replace(/\s+/g, " ").slice(0, 90)}`);
    await client.unsafe(st);
  }
  console.log("✔ Aplicado.");
  await client.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
