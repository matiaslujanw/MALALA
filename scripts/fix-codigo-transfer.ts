/**
 * Corrige el typo del código del medio de transferencia: TRASNFER → TRANSFER.
 * El código solo se usa como etiqueta visible (la lógica identifica los medios
 * por cuenta), así que es un cambio cosmético y reversible.
 *
 * Uso: npx tsx scripts/fix-codigo-transfer.ts
 */
import "../envConfig";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/client/postgres";
import { mediosPago } from "../src/lib/db/schema";

async function main() {
  const db = getDb();
  const updated = await db
    .update(mediosPago)
    .set({ codigo: "TRANSFER" })
    .where(eq(mediosPago.codigo, "TRASNFER"))
    .returning({ id: mediosPago.id, nombre: mediosPago.nombre, codigo: mediosPago.codigo });

  if (updated.length === 0) {
    console.log("No se encontró ningún medio con código TRASNFER (¿ya corregido?).");
  } else {
    for (const m of updated) {
      console.log(`✓ ${m.nombre}: código → ${m.codigo}`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
