/**
 * Aplica una REVISIÓN de la planilla de Yerba Buena sobre lo que ya está
 * cargado, sin borrar nada. Es lo contrario de import-yb-planilla.ts, que
 * reemplaza el catálogo entero: acá el catálogo ya está en producción con stock
 * real encima, así que se actualiza campo por campo.
 *
 * Reglas de la mezcla, y el porqué de cada una:
 *
 *  - PRECIOS Y ENVASES: si la planilla nueva trae un valor, gana. Si trae vacío
 *    y la base tiene un valor, NO se toca. Vacío en la planilla significa "no
 *    lo sé", no "borralo": la revisión no incluye la hoja "precios" de la que
 *    se habían completado ~23 envases, y tomarla al pie de la letra los perdería.
 *  - LO QUE LA PLANILLA YA NO TRAE se DESACTIVA, no se borra, y sólo si no
 *    tiene stock ni movimientos. Borrar un insumo se lleva su historial.
 *  - RECETAS: se agregan las líneas nuevas y se borran las que la planilla
 *    sacó. Las líneas que ya existían no se tocan: si alguien las confirmó a
 *    mano en la app, volver a marcarlas como propuesta sería pisar su trabajo.
 *  - PRODUCTOS DE VENTA: esta revisión no incluye los rubros VPC/VDJ, así que
 *    los 53 productos cargados y su stock quedan intactos.
 *  - SERVICIOS NUEVOS: nacen solo-caja (visible_reserva=false) porque todavía
 *    no tienen duración, y sin duración no se pueden reservar.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/actualizar-planilla-yb.ts --json <planilla.json> [--commit]
 */
import "../envConfig";
import { and, eq, inArray } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  insumoProveedores as insumoProveedoresTable,
  insumos as insumosTable,
  proveedorSucursal as proveedorSucursalTable,
  proveedores as proveedoresTable,
  recetas as recetasTable,
  servicioSucursal as servicioSucursalTable,
  servicios as serviciosTable,
  stockSucursal as stockSucursalTable,
} from "../src/lib/db/schema";
import type { PlanillaYB } from "./parse-planilla-yb";

const YB_ID = "seed-000002";

async function main() {
  const commit = process.argv.includes("--commit");
  const i = process.argv.indexOf("--json");
  const ruta = i >= 0 ? process.argv[i + 1] : undefined;
  if (!ruta) {
    console.error("Falta --json <planilla.json> (la salida de parse-planilla-yb.ts).");
    process.exit(1);
  }
  const nueva = JSON.parse(readFileSync(ruta, "utf8")) as PlanillaYB;
  if (nueva.sucursalId !== YB_ID)
    throw new Error(`La planilla dice sucursal ${nueva.sucursalId}, esperaba ${YB_ID}`);

  const db = getDb();

  // ---- Estado actual ----
  const insumosDb = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.sucursalId, YB_ID));
  const insDbPorCodigo = new Map(insumosDb.filter((x) => x.codigo).map((x) => [x.codigo!, x]));

  const serviciosDb = await db
    .select()
    .from(serviciosTable)
    .innerJoin(
      servicioSucursalTable,
      eq(servicioSucursalTable.servicioId, serviciosTable.id),
    )
    .where(eq(servicioSucursalTable.sucursalId, YB_ID));
  const svDbPorCodigo = new Map(
    serviciosDb.filter((r) => r.servicios.codigo).map((r) => [r.servicios.codigo!, r.servicios]),
  );

  const recetasDb = await db
    .select()
    .from(recetasTable)
    .where(eq(recetasTable.sucursalId, YB_ID));
  const stockPorInsumo = new Map(
    (
      await db
        .select()
        .from(stockSucursalTable)
        .where(eq(stockSucursalTable.sucursalId, YB_ID))
    ).map((s) => [s.insumoId, s.cantidad]),
  );

  const proveedoresDb = new Set((await db.select().from(proveedoresTable)).map((p) => p.id));

  // ---- Insumos: alta, actualización, baja ----
  const insNuevos = nueva.insumos.filter((i) => !insDbPorCodigo.has(i.codigo));
  const insBaja = insumosDb.filter(
    (d) =>
      d.tipo === "bacha" &&
      d.codigo &&
      d.activo &&
      !nueva.insumos.some((i) => i.codigo === d.codigo),
  );
  const insUpdates: Array<{
    id: string;
    codigo: string;
    nombre: string;
    campos: Record<string, number | string | null>;
    detalle: string[];
  }> = [];

  for (const n of nueva.insumos) {
    const d = insDbPorCodigo.get(n.codigo);
    if (!d) continue;
    const campos: Record<string, number | string | null> = {};
    const detalle: string[] = [];
    // Vacío en la planilla = "no sé": no se sobreescribe lo que ya hay.
    if (n.tamanoEnvase != null && n.tamanoEnvase !== d.tamanoEnvase) {
      campos.tamanoEnvase = n.tamanoEnvase;
      detalle.push(`envase ${d.tamanoEnvase} → ${n.tamanoEnvase}`);
    }
    if (n.precioEnvase != null && n.precioEnvase !== d.precioEnvase) {
      campos.precioEnvase = n.precioEnvase;
      detalle.push(`frasco $${d.precioEnvase} → $${n.precioEnvase}`);
    }
    if (n.precioUnitario != null && n.precioUnitario !== d.precioUnitario) {
      campos.precioUnitario = n.precioUnitario;
      detalle.push(`$unit ${d.precioUnitario ?? "—"} → ${n.precioUnitario}`);
    }
    if (n.unidadMedida !== d.unidadMedida) {
      campos.unidadMedida = n.unidadMedida;
      detalle.push(`um ${d.unidadMedida} → ${n.unidadMedida}`);
    }
    if (n.nombre !== d.nombre) {
      campos.nombre = n.nombre;
      detalle.push(`nombre "${d.nombre}" → "${n.nombre}"`);
    }
    if (detalle.length)
      insUpdates.push({ id: d.id, codigo: n.codigo, nombre: d.nombre, campos, detalle });
  }

  // ---- Servicios ----
  const svNuevos = nueva.servicios.filter((s) => !svDbPorCodigo.has(s.codigo));
  const svBaja = serviciosDb
    .map((r) => r.servicios)
    .filter((d) => d.codigo && d.activo && !nueva.servicios.some((s) => s.codigo === d.codigo));
  const svPrecio = nueva.servicios.filter((s) => {
    const d = svDbPorCodigo.get(s.codigo);
    return d && (d.precioLista !== s.precioLista || d.precioEfectivo !== s.precioEfectivo);
  });

  // ---- Proveedores ----
  const provNuevos = nueva.proveedores.filter((p) => !proveedoresDb.has(p.id));

  // ---- Recetas ----
  const insPorCodigoFinal = new Map(insDbPorCodigo);
  for (const n of insNuevos) insPorCodigoFinal.set(n.codigo, null as never);
  const claveDb = new Set(recetasDb.map((r) => `${r.servicioId}|${r.insumoId}`));
  const claveNueva = new Set<string>();
  const recAlta: Array<{ serv: string; ins: string; cantidad: number; confirmada: boolean }> = [];
  for (const r of nueva.recetas) {
    for (const l of r.lineas) {
      const k = `yb-${r.servicioCodigo}|yb-${l.insumoCodigo}`;
      claveNueva.add(k);
      if (!claveDb.has(k))
        recAlta.push({
          serv: r.servicioCodigo,
          ins: l.insumoCodigo,
          cantidad: l.cantidad,
          confirmada: r.confirmada,
        });
    }
  }
  const recBaja = recetasDb.filter((r) => !claveNueva.has(`${r.servicioId}|${r.insumoId}`));

  // ---- Reporte ----
  const fmt = (n: number) => n.toLocaleString("es-AR");
  console.log("=== REVISIÓN DE LA PLANILLA · YERBA BUENA ===\n");
  console.log(`  Fuente: ${nueva.fuente}`);
  console.log(`  (esta revisión no trae productos de venta: los ${await (async () => (await db.select().from(insumosTable).where(and(eq(insumosTable.sucursalId, YB_ID), eq(insumosTable.tipo, "venta")))).length)()} cargados quedan intactos)\n`);

  console.log(`  INSUMOS con datos nuevos: ${insUpdates.length}`);
  for (const u of insUpdates)
    console.log(`      ${u.codigo} ${u.nombre.slice(0, 34).padEnd(34)} ${u.detalle.join(" · ")}`);

  console.log(`\n  INSUMOS nuevos: ${insNuevos.length}`);
  for (const n of insNuevos)
    console.log(
      `      ${n.codigo} ${n.nombre.padEnd(30)} ${n.umPlanilla} · env ${n.tamanoEnvase ?? "—"} · $u ${n.precioUnitario ?? "—"} · ${n.proveedor ?? "sin proveedor"}`,
    );

  console.log(`\n  INSUMOS a desactivar (la planilla ya no los trae): ${insBaja.length}`);
  for (const d of insBaja) {
    const st = stockPorInsumo.get(d.id) ?? 0;
    console.log(`      ${d.codigo} ${d.nombre.padEnd(34)} stock=${st}${st !== 0 ? "  ⚠ TIENE STOCK, no se desactiva" : ""}`);
  }

  console.log(`\n  SERVICIOS nuevos: ${svNuevos.length}`);
  for (const s of svNuevos)
    console.log(`      ${s.codigo} ${s.nombre.padEnd(34)} ${s.rubro} · L=$${fmt(s.precioLista)} E=$${fmt(s.precioEfectivo)}`);
  console.log(`\n  SERVICIOS a desactivar: ${svBaja.length}`);
  for (const s of svBaja) console.log(`      ${s.codigo} ${s.nombre}`);
  console.log(`\n  SERVICIOS con precio distinto: ${svPrecio.length}`);
  for (const s of svPrecio) {
    const d = svDbPorCodigo.get(s.codigo)!;
    console.log(`      ${s.codigo} ${s.nombre}: ${fmt(d.precioLista)}/${fmt(d.precioEfectivo)} → ${fmt(s.precioLista)}/${fmt(s.precioEfectivo)}`);
  }

  console.log(`\n  PROVEEDORES nuevos: ${provNuevos.length}`);
  for (const p of provNuevos) console.log(`      ${p.nombre}`);

  console.log(`\n  RECETAS: +${recAlta.length} líneas nuevas, -${recBaja.length} que la planilla sacó`);
  console.log(`      (las ${recetasDb.length - recBaja.length} líneas que ya estaban no se tocan)`);
  for (const r of recBaja) {
    const ins = insumosDb.find((x) => x.id === r.insumoId);
    console.log(`      - ${r.servicioId.replace("yb-", "")} / ${ins?.codigo ?? r.insumoId} ${ins?.nombre ?? ""}`);
  }

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    for (const p of provNuevos) {
      await tx.insert(proveedoresTable).values({ id: p.id, nombre: p.nombre }).onConflictDoNothing();
      await tx
        .insert(proveedorSucursalTable)
        .values({ id: crypto.randomUUID(), proveedorId: p.id, sucursalId: YB_ID })
        .onConflictDoNothing();
    }

    for (const u of insUpdates)
      await tx.update(insumosTable).set(u.campos).where(eq(insumosTable.id, u.id));

    if (insNuevos.length) {
      await tx.insert(insumosTable).values(
        insNuevos.map((n) => ({
          id: n.id,
          sucursalId: YB_ID,
          nombre: n.nombre,
          codigo: n.codigo,
          unidadMedida: n.unidadMedida,
          tamanoEnvase: n.tamanoEnvase ?? 1,
          precioEnvase: n.precioEnvase ?? 0,
          precioUnitario: n.precioUnitario,
          rinde: null,
          umbralStockBajo: 0,
          activo: true,
          tipo: "bacha" as const,
          vendible: false,
          precioVenta: null,
        })),
      );
      await tx.insert(stockSucursalTable).values(
        insNuevos.map((n) => ({
          id: `yb-stk-${n.codigo}`,
          insumoId: n.id,
          sucursalId: YB_ID,
          cantidad: 0,
        })),
      );
      const vinculos = insNuevos
        .filter((n) => n.proveedorId)
        .map((n) => ({ id: crypto.randomUUID(), insumoId: n.id, proveedorId: n.proveedorId! }));
      if (vinculos.length)
        await tx.insert(insumoProveedoresTable).values(vinculos).onConflictDoNothing();
    }

    const bajasSeguras = insBaja.filter((d) => (stockPorInsumo.get(d.id) ?? 0) === 0);
    if (bajasSeguras.length)
      await tx
        .update(insumosTable)
        .set({ activo: false })
        .where(
          inArray(
            insumosTable.id,
            bajasSeguras.map((d) => d.id),
          ),
        );

    if (svNuevos.length) {
      await tx.insert(serviciosTable).values(
        svNuevos.map((s) => ({
          id: s.id,
          codigo: s.codigo,
          rubro: s.rubro.toUpperCase(),
          nombre: s.nombre,
          precioLista: s.precioLista,
          precioEfectivo: s.precioEfectivo,
          comisionDefaultPct: 0,
          activo: s.activo,
          // Sin duración no se puede reservar: nace solo-caja.
          visibleReserva: false,
          duracionMin: null,
          esPromo: false,
        })),
      );
      await tx.insert(servicioSucursalTable).values(
        svNuevos.map((s) => ({
          id: crypto.randomUUID(),
          servicioId: s.id,
          sucursalId: YB_ID,
        })),
      );
    }

    for (const s of svPrecio)
      await tx
        .update(serviciosTable)
        .set({ precioLista: s.precioLista, precioEfectivo: s.precioEfectivo })
        .where(eq(serviciosTable.id, s.id));

    if (svBaja.length)
      await tx
        .update(serviciosTable)
        .set({ activo: false })
        .where(
          inArray(
            serviciosTable.id,
            svBaja.map((s) => s.id),
          ),
        );

    if (recBaja.length)
      await tx.delete(recetasTable).where(
        inArray(
          recetasTable.id,
          recBaja.map((r) => r.id),
        ),
      );

    for (let k = 0; k < recAlta.length; k += 200)
      await tx.insert(recetasTable).values(
        recAlta.slice(k, k + 200).map((r) => ({
          id: `yb-rec-${r.serv}-${r.ins}`,
          sucursalId: YB_ID,
          servicioId: `yb-${r.serv}`,
          insumoId: `yb-${r.ins}`,
          cantidad: r.cantidad,
          confirmada: r.confirmada,
        })),
      );
  });

  console.log("\n✔ Revisión aplicada. Ni el stock ni los productos de venta se tocaron.");
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
