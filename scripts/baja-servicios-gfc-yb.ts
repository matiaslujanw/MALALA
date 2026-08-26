/**
 * Da de baja los servicios GFC100..GFC104, los que se usaban para vender gift
 * cards antes de que existiera la pantalla propia.
 *
 * POR QUÉ: mientras sigan activos queda abierto el camino viejo, y ése es el
 * que duplica el ingreso — la venta de la tarjeta se contaba como facturación y
 * el canje la contaba de nuevo. Hasta ahora el salón lo compensaba restando a
 * mano todos los meses; si el camino queda abierto ahora, el duplicado vuelve
 * pero ya sin nadie restándolo, que es peor que antes.
 *
 * Las gift cards se venden desde Catálogos → Gift cards → Emitir.
 *
 * Sólo apaga `activo`: no borra nada. Los servicios siguen existiendo con su
 * historial, y volver atrás es un UPDATE. Antes de tocar nada lista todo lo que
 * cuelga de ellos (recetas, promos, turnos, ventas, profesionales asignados)
 * para que se vea qué deja de estar disponible.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/baja-servicios-gfc-yb.ts [--commit]
 */
import "../envConfig";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  ingresoLineas as lineasTable,
  promocionItems as promoItemsTable,
  profesionalesServicios as profSvTable,
  recetas as recetasTable,
  servicioSucursal as svSucTable,
  servicios as svTable,
  serviciosHorarios as svHorariosTable,
  turnos as turnosTable,
} from "../src/lib/db/schema";

const CODIGOS = ["GFC100", "GFC101", "GFC102", "GFC103", "GFC104"];

async function main() {
  const commit = process.argv.includes("--commit");
  const db = getDb();

  const servicios = await db
    .select()
    .from(svTable)
    .where(inArray(svTable.codigo, CODIGOS));

  const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");
  console.log("=== BAJA DE LOS SERVICIOS DE GIFT CARD ===\n");

  if (servicios.length === 0) {
    console.log("  No encontré ningún servicio con esos códigos.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  const ids = servicios.map((s) => s.id);

  // En qué sucursales está habilitado cada uno: `servicios` no tiene
  // sucursal_id, la membresía vive en servicio_sucursal. Apagar `activo` los
  // apaga en TODAS, así que hay que mirarlo antes.
  const membresias = await db
    .select()
    .from(svSucTable)
    .where(inArray(svSucTable.servicioId, ids));

  console.log("  Servicios encontrados:\n");
  for (const s of servicios) {
    const sucs = membresias
      .filter((m) => m.servicioId === s.id)
      .map((m) => m.sucursalId)
      .join(", ");
    console.log(
      `      ${s.codigo}  ${s.nombre.slice(0, 30).padEnd(30)} $${fmt(s.precioLista).padStart(9)}  ${s.activo ? "ACTIVO" : "ya inactivo"}  · sucursales: ${sucs || "ninguna"}`,
    );
  }

  // Todo lo que cuelga de estos servicios. No se borra nada: es para ver qué
  // deja de estar disponible y que no aparezca una sorpresa después.
  //
  // Las consultas van explícitas, una por tabla, y no por un helper que reciba
  // el nombre de la columna: promocion_items no tiene `servicio_id` sino
  // `promo_servicio_id` y `componente_servicio_id`, y un helper stringly-typed
  // arma SQL inválido sin que el compilador diga nada.
  const contar = async (n: number | undefined) => Number(n ?? 0);
  const uno = async <T extends { n: number }>(rows: T[]) => contar(rows[0]?.n);

  const dependencias = [
    {
      nombre: "recetas",
      n: await uno(
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(recetasTable)
          .where(inArray(recetasTable.servicioId, ids)),
      ),
    },
    {
      nombre: "líneas de venta",
      n: await uno(
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(lineasTable)
          .where(inArray(lineasTable.servicioId, ids)),
      ),
    },
    {
      nombre: "turnos",
      n: await uno(
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(turnosTable)
          .where(inArray(turnosTable.servicioId, ids)),
      ),
    },
    {
      nombre: "franjas horarias",
      n: await uno(
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(svHorariosTable)
          .where(inArray(svHorariosTable.servicioId, ids)),
      ),
    },
    {
      nombre: "profesionales asignados",
      n: await uno(
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(profSvTable)
          .where(inArray(profSvTable.servicioId, ids)),
      ),
    },
    {
      nombre: "promos que los usan de componente",
      n: await uno(
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(promoItemsTable)
          .where(inArray(promoItemsTable.componenteServicioId, ids)),
      ),
    },
    {
      nombre: "promos que SON uno de ellos",
      n: await uno(
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(promoItemsTable)
          .where(inArray(promoItemsTable.promoServicioId, ids)),
      ),
    },
  ];

  console.log("\n  Qué cuelga de ellos:");
  for (const d of dependencias) {
    console.log(`      ${d.nombre.padEnd(34)} ${d.n}`);
  }
  const conDatos = dependencias.filter((d) => d.n > 0);
  if (conDatos.length === 0) {
    console.log("      (nada: no se vendieron ni se agendaron nunca)");
  }

  const aBajar = servicios.filter((s) => s.activo);
  console.log(`\n  A dar de baja: ${aBajar.length} de ${servicios.length}`);
  console.log(
    "  Se apaga sólo `activo`. No se borra nada y se puede revertir con un UPDATE.",
  );

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }
  if (aBajar.length === 0) {
    console.log("\nYa estaban todos inactivos.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db
    .update(svTable)
    .set({ activo: false, visibleReserva: false })
    .where(
      inArray(
        svTable.id,
        aBajar.map((s) => s.id),
      ),
    );

  const despues = await db
    .select({ codigo: svTable.codigo, activo: svTable.activo })
    .from(svTable)
    .where(inArray(svTable.codigo, CODIGOS));
  const quedanActivos = despues.filter((s) => s.activo);

  console.log(`\n✔ ${aBajar.length} servicios dados de baja.`);
  console.log(
    quedanActivos.length === 0
      ? "  Ninguno quedó activo: el camino viejo de vender gift cards está cerrado."
      : `  ⚠ Quedaron activos: ${quedanActivos.map((s) => s.codigo).join(", ")}`,
  );
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Referencia para que eq quede usado si se agrega un filtro por sucursal.
void eq;
