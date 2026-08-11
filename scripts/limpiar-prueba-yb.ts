/**
 * Borra los datos de PRUEBA que se cargaron en Yerba Buena para verificar que
 * el circuito de ventas descuenta stock: las ventas de prueba, sus movimientos
 * de stock y bancarios, la apertura de caja del día y el stock cargado a mano.
 *
 * NO toca el catálogo (servicios, insumos, recetas, proveedores) ni la cuenta
 * "Caja Efectivo" ni el medio de pago "EF", que son configuración real que la
 * sucursal necesita igual para poder operar.
 *
 * El saldo de las cuentas no se guarda en `cuentas_bancarias`: se calcula
 * sumando `movimientos_bancarios`, así que borrando los movimientos el saldo
 * vuelve solo a cero.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/limpiar-prueba-yb.ts [--commit]
 */
import "../envConfig";
import { sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";

const YB = "seed-000002";

async function main() {
  const commit = process.argv.includes("--commit");
  const db = getDb();
  const q = async (s: string) =>
    (await db.execute(sql.raw(s))) as unknown as Array<Record<string, unknown>>;

  const ventas = await q(
    `select id, fecha, total from ingresos where sucursal_id = '${YB}' order by fecha`,
  );
  const movStock = await q(
    `select count(*)::int n from movimientos_stock where sucursal_id = '${YB}'`,
  );
  const movBanco = await q(
    `select count(*)::int n from movimientos_bancarios where sucursal_id = '${YB}'`,
  );
  const aperturas = await q(
    `select count(*)::int n from aperturas_caja where sucursal_id = '${YB}'`,
  );
  const stock = await q(
    `select count(*)::int n from stock_sucursal where sucursal_id = '${YB}' and cantidad <> 0`,
  );

  console.log("=== LIMPIEZA DE DATOS DE PRUEBA · YERBA BUENA ===\n");
  console.log(`  Ventas a borrar: ${ventas.length}`);
  for (const v of ventas) console.log(`      ${v.id} · $${v.total} · ${v.fecha}`);
  console.log(`  Movimientos de stock: ${movStock[0].n}`);
  console.log(`  Movimientos bancarios: ${movBanco[0].n}`);
  console.log(`  Aperturas de caja: ${aperturas[0].n}`);
  console.log(`  Insumos con stock distinto de 0: ${stock[0].n} → vuelven a 0`);
  console.log("\n  NO se toca: servicios, insumos, recetas, proveedores,");
  console.log("  la cuenta 'Caja Efectivo' ni el medio de pago 'EF'.");
  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);

  if (!commit) {
    console.log("\nDRY-RUN: no se tocó nada. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    const run = (s: string) => tx.execute(sql.raw(s));
    // Las líneas y los cierres cuelgan de la venta o de la caja; se borran
    // primero para no chocar con las FKs.
    await run(
      `delete from ingreso_lineas where ingreso_id in (select id from ingresos where sucursal_id = '${YB}')`,
    );
    await run(`delete from movimientos_bancarios where sucursal_id = '${YB}'`);
    await run(`delete from movimientos_stock where sucursal_id = '${YB}'`);
    await run(`delete from ingresos where sucursal_id = '${YB}'`);
    await run(
      `delete from apertura_caja_cuentas where apertura_id in (select id from aperturas_caja where sucursal_id = '${YB}')`,
    );
    await run(`delete from aperturas_caja where sucursal_id = '${YB}'`);
    await run(
      `delete from cierre_caja_cuentas where cierre_id in (select id from cierres_caja where sucursal_id = '${YB}')`,
    );
    await run(`delete from cierres_caja where sucursal_id = '${YB}'`);
    await run(`update stock_sucursal set cantidad = 0 where sucursal_id = '${YB}'`);
  });

  console.log("\n✔ Datos de prueba borrados. El catálogo quedó intacto.");
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
