/**
 * Pone en 0 el recargo automático (recargo_pct) de TODOS los medios de pago.
 * Se usa para quitar el recargo de tarjeta (ej. 10%) sin desarmar el sistema:
 * el panel de admin sigue permitiendo reconfigurarlo si hiciera falta.
 *
 * Uso:
 *   npx tsx scripts/reset-recargos.ts
 */
import "../envConfig";
import { getDb } from "../src/lib/db/client/postgres";
import { mediosPago } from "../src/lib/db/schema";

async function main() {
  const db = getDb();
  console.log("→ Poniendo recargo_pct = 0 en todos los medios de pago…");
  const updated = await db
    .update(mediosPago)
    .set({ recargoPct: 0 })
    .returning({ id: mediosPago.id, nombre: mediosPago.nombre });
  for (const m of updated) {
    console.log(`   ✓ ${m.nombre}`);
  }
  console.log(`✓ Listo: ${updated.length} medios actualizados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
