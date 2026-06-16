/**
 * Aplica la migración 0009: habilita la cuenta corriente para todos los
 * clientes (default true + backfill de los existentes, salvo Consumidor Final).
 *
 * Uso:
 *   npx tsx scripts/apply-cc-default.ts            (DRY-RUN: solo muestra)
 *   npx tsx scripts/apply-cc-default.ts --apply    (aplica)
 */
import "../envConfig";
import { sql } from "drizzle-orm";
import { getDb } from "../src/lib/db/client/postgres";

const APPLY = process.argv.includes("--apply");

async function main() {
  const db = getDb();

  const pend = await db.execute(sql`
    SELECT count(*)::int AS n
    FROM clientes
    WHERE cuenta_corriente_habilitada = false
      AND nombre <> 'Consumidor Final'
  `);
  const total = await db.execute(sql`SELECT count(*)::int AS n FROM clientes`);
  // postgres-js devuelve las filas como array directo.
  const porHabilitar = (pend as unknown as { n: number }[])[0].n;
  const totalClientes = (total as unknown as { n: number }[])[0].n;

  console.log(
    `\n${APPLY ? "APLICANDO" : "DRY-RUN (no escribe)"}\n` +
      `  Clientes totales: ${totalClientes}\n` +
      `  Se habilitarán: ${porHabilitar} (los que estaban en false, excepto Consumidor Final)\n`,
  );

  if (APPLY) {
    await db.execute(sql`
      ALTER TABLE clientes
        ALTER COLUMN cuenta_corriente_habilitada SET DEFAULT true
    `);
    const res = await db.execute(sql`
      UPDATE clientes
        SET cuenta_corriente_habilitada = true
        WHERE cuenta_corriente_habilitada = false
          AND nombre <> 'Consumidor Final'
    `);
    const afectados = (res as unknown as { count?: number }).count ?? "?";
    console.log(`✓ Default puesto en true. Clientes habilitados: ${afectados}\n`);
  } else {
    console.log("Para aplicar: npx tsx scripts/apply-cc-default.ts --apply\n");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
