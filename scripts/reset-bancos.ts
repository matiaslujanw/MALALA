/**
 * Limpia datos de movimiento que se vuelven inconsistentes al introducir bancos:
 *   - ingresos, ingreso_lineas
 *   - egresos
 *   - movimientos_stock (ventas y compras refencian ingresos/egresos)
 *   - movimientos_bancarios
 *   - cierres_caja
 *   - liquidaciones, liquidacion_lineas
 *
 * Mantiene catálogos (servicios, insumos, clientes, empleados, recetas, medios de pago,
 * cuentas bancarias, sucursales, profiles).
 *
 * Uso:
 *   npx tsx scripts/reset-bancos.ts
 */
import "../envConfig";
import { getDb } from "../src/lib/db/client/postgres";
import {
  cierresCaja,
  egresos,
  ingresoLineas,
  ingresos,
  liquidacionLineas,
  liquidaciones,
  movimientosBancarios,
  movimientosStock,
} from "../src/lib/db/schema";

async function main() {
  const db = getDb();
  console.log("→ Borrando liquidacion_lineas…");
  await db.delete(liquidacionLineas);
  console.log("→ Borrando liquidaciones…");
  await db.delete(liquidaciones);
  console.log("→ Borrando cierres_caja…");
  await db.delete(cierresCaja);
  console.log("→ Borrando movimientos_bancarios…");
  await db.delete(movimientosBancarios);
  console.log("→ Borrando movimientos_stock…");
  await db.delete(movimientosStock);
  console.log("→ Borrando egresos…");
  await db.delete(egresos);
  console.log("→ Borrando ingreso_lineas…");
  await db.delete(ingresoLineas);
  console.log("→ Borrando ingresos…");
  await db.delete(ingresos);
  console.log("✓ Reset completo.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
