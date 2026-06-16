/**
 * Diagnóstico SOLO LECTURA de caja: muestra los códigos de los medios de pago
 * y lo que quedó guardado en los últimos cierres (baldes fijos EF/TR/TC/TD).
 * No modifica nada.
 *
 * Uso: npx tsx scripts/diag-caja.ts
 */
import "../envConfig";
import { desc } from "drizzle-orm";
import { getDb } from "../src/lib/db/client/postgres";
import { mediosPago, cierresCaja } from "../src/lib/db/schema";

async function main() {
  const db = getDb();

  console.log("\n=== MEDIOS DE PAGO (codigo | nombre | cuentaId) ===");
  const medios = await db
    .select({
      codigo: mediosPago.codigo,
      nombre: mediosPago.nombre,
      cuentaId: mediosPago.cuentaId,
      activo: mediosPago.activo,
    })
    .from(mediosPago);
  for (const m of medios) {
    console.log(
      `  ${m.codigo.padEnd(6)} | ${(m.nombre ?? "").padEnd(20)} | cuenta=${m.cuentaId ?? "-"} | activo=${m.activo}`,
    );
  }

  console.log("\n=== ÚLTIMOS CIERRES (lo guardado) ===");
  const cierres = await db
    .select({
      fecha: cierresCaja.fecha,
      saldoIni: cierresCaja.saldoInicialEf,
      ingEf: cierresCaja.ingresosEf,
      egEf: cierresCaja.egresosEf,
      ingBanc: cierresCaja.ingresosBanc,
      tc: cierresCaja.cobrosTc,
      td: cierresCaja.cobrosTd,
      obs: cierresCaja.observacion,
    })
    .from(cierresCaja)
    .orderBy(desc(cierresCaja.fecha))
    .limit(15);
  for (const c of cierres) {
    console.log(
      `  ${c.fecha} | saldoIni=${c.saldoIni} ingEf=${c.ingEf} egEf=${c.egEf} ingBanc=${c.ingBanc} TC=${c.tc} TD=${c.td}${c.obs ? ` | ${c.obs}` : ""}`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
