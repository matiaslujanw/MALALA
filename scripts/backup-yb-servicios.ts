/**
 * SOLO LECTURA: respalda a un JSON los servicios cuya membresía es de
 * Yerba Buena (seed-000002), antes de reemplazarlos.
 * Uso: npx tsx scripts/backup-yb-servicios.ts <archivo-salida.json>
 */
import "../envConfig";
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";

async function main() {
  const salida = process.argv[2];
  if (!salida) {
    console.error("Falta el archivo de salida.");
    process.exit(1);
  }
  const db = getDb();
  const rows = (await db.execute(
    sql.raw(`select sv.* from servicios sv
               join servicio_sucursal ss on ss.servicio_id = sv.id and ss.sucursal_id = 'seed-000002'
              order by sv.rubro, sv.nombre`),
  )) as unknown as Array<Record<string, unknown>>;
  writeFileSync(salida, JSON.stringify(rows, null, 1));
  console.log(`Respaldados ${rows.length} servicios de YB en ${salida}`);
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
