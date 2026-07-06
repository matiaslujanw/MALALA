/**
 * Borra los servicios cargados para Yerba Buena (datos malos). NO toca clientes.
 * Corre dry-run salvo --commit.
 * Uso: npx tsx scripts/wipe-yb-servicios.ts [--commit]
 */
import "../envConfig";
import { sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";

async function main() {
  const commit = process.argv.includes("--commit");
  const db = getDb();
  const q = async (s: string) =>
    (await db.execute(sql.raw(s))) as unknown as Array<Record<string, unknown>>;

  const antes = (await q(`select count(*)::int n from servicios`))[0].n;
  const memb = (await q(`select count(*)::int n from servicio_sucursal`))[0].n;
  console.log(`servicios: ${antes} | servicio_sucursal: ${memb}`);

  if (!commit) {
    console.log("DRY-RUN: no borro nada. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  // Todos los servicios actuales son de YB (Centro aún no tiene). servicio_sucursal
  // y promocion_items caen por cascade. Las tablas operativas ya están vacías.
  await db.execute(sql.raw(`DELETE FROM servicios`));
  const despues = (await q(`select count(*)::int n from servicios`))[0].n;
  console.log(`✔ Borrado. servicios ahora: ${despues}`);
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
