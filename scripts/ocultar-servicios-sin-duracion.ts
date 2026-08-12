/**
 * Saca de la reserva pública los servicios que no tienen duración cargada.
 *
 * El motor de turnos usa `duracion_min` para saber cuánto ocupa el slot: un
 * servicio sin ese dato no se puede reservar, pero igual aparecía en el menú de
 * la web, así que el cliente lo elegía y se encontraba con que no había horarios.
 *
 * `visible_reserva = false` los deja SOLO-CAJA: se siguen pudiendo cobrar en el
 * mostrador y siguen en el catálogo, pero no se muestran en la web ni generan
 * turnos. Cuando el salón mande la duración, se vuelven a mostrar con
 * `--mostrar`.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/ocultar-servicios-sin-duracion.ts [--sucursal <id>] [--mostrar] [--commit]
 */
import "../envConfig";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  servicioSucursal as servicioSucursalTable,
  servicios as serviciosTable,
} from "../src/lib/db/schema";

const YB_ID = "seed-000002";

async function main() {
  const commit = process.argv.includes("--commit");
  // --mostrar hace lo inverso: vuelve a publicar los que ya tienen duración.
  const mostrar = process.argv.includes("--mostrar");
  const i = process.argv.indexOf("--sucursal");
  const sucursalId = i >= 0 ? process.argv[i + 1] : YB_ID;

  const db = getDb();
  const objetivo = await db
    .select({
      id: serviciosTable.id,
      codigo: serviciosTable.codigo,
      nombre: serviciosTable.nombre,
      rubro: serviciosTable.rubro,
    })
    .from(serviciosTable)
    .innerJoin(
      servicioSucursalTable,
      eq(servicioSucursalTable.servicioId, serviciosTable.id),
    )
    .where(
      and(
        eq(servicioSucursalTable.sucursalId, sucursalId),
        eq(serviciosTable.activo, true),
        eq(serviciosTable.visibleReserva, mostrar ? false : true),
        mostrar
          ? isNotNull(serviciosTable.duracionMin)
          : isNull(serviciosTable.duracionMin),
      ),
    );

  console.log(
    `=== ${mostrar ? "PUBLICAR" : "OCULTAR"} SERVICIOS EN LA RESERVA · ${sucursalId} ===\n`,
  );
  console.log(
    `  Servicios activos ${mostrar ? "con" : "sin"} duración que hoy ${mostrar ? "NO se ven" : "se ven"} en la web: ${objetivo.length}\n`,
  );
  const porRubro = new Map<string, typeof objetivo>();
  for (const s of objetivo) {
    if (!porRubro.has(s.rubro)) porRubro.set(s.rubro, []);
    porRubro.get(s.rubro)!.push(s);
  }
  for (const [rubro, lista] of [...porRubro].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${rubro} (${lista.length})`);
    for (const s of lista) console.log(`      ${(s.codigo ?? "").padEnd(7)} ${s.nombre}`);
  }

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }
  if (objetivo.length) {
    await db
      .update(serviciosTable)
      .set({ visibleReserva: mostrar })
      .where(
        inArray(
          serviciosTable.id,
          objetivo.map((s) => s.id),
        ),
      );
  }

  console.log(
    `\n✔ ${objetivo.length} servicios ${mostrar ? "vuelven a la reserva pública" : "quedaron solo-caja"}.`,
  );
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
