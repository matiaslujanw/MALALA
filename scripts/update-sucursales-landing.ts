/**
 * Actualiza los campos de contacto/landing en ambas sucursales:
 * telefono, horario_resumen, mapa_url y descripcion_corta.
 *
 * Idempotente: puede correrse varias veces sin efecto secundario.
 * Uso: npx tsx scripts/update-sucursales-landing.ts [--commit]
 */
import "../envConfig";
import { eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import { sucursales } from "../src/lib/db/schema";

const CENTRO_ID = "seed-000001";
const YB_ID = "seed-000002";

const CENTRO = {
  telefono: "+54 9 381 239-3260",
  horarioResumen: "Lun 14–21 h · Mar–Vie 10–21 h · Sáb 9–21 h",
  mapaUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3560.6623312336574!2d-65.2204963!3d-26.8188784!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94225df9c2bdc3f9%3A0x4f503c4c1aeea6f6!2sMalala%20club%20de%20belleza!5e0!3m2!1ses-419!2sar!4v1777588681376!5m2!1ses-419!2sar",
  descripcionCorta: "Sede principal en el corazón del centro tucumano.",
};

const YB = {
  direccion: "Mariano Moreno 107, Mercato Shopping Viejo, Yerba Buena",
  telefono: "+54 381 338-4503",
  horarioResumen: "Lun–Sáb 9–21 h · Estacionamiento propio",
  mapaUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7121.801419279513!2d-65.29898302477942!3d-26.81128997670779!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x942242d74b8c7563%3A0xaa3cd23bfe39c8f9!2sMariano%20Moreno%20107%2C%20T4107%20Yerba%20Buena%2C%20Tucum%C3%A1n!5e0!3m2!1ses-419!2sar!4v1783510352791!5m2!1ses-419!2sar",
  descripcionCorta: "Mariano Moreno 107, Mercato Shopping Viejo. Con estacionamiento propio.",
};

async function main() {
  const commit = process.argv.includes("--commit");
  console.log(`Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  console.log("\nMalala Centro →", CENTRO);
  console.log("\nMalala Yerba Buena →", YB);

  if (!commit) {
    console.log("\nDRY-RUN: nada fue modificado. Corré con --commit para aplicar.");
    return;
  }

  const db = getDb();
  await db.update(sucursales).set(CENTRO).where(eq(sucursales.id, CENTRO_ID));
  console.log("\n✓ Centro actualizado.");
  await db.update(sucursales).set(YB).where(eq(sucursales.id, YB_ID));
  console.log("✓ Yerba Buena actualizado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => getSqlClient().end({ timeout: 5 }));
