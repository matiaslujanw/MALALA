/**
 * Aplica el excel de pendientes que el salón de Yerba Buena completó y devolvió
 * (el que genera scripts/exportar-pendientes-yb.ts).
 *
 * Cubre tres de las cinco hojas:
 *
 *  - HOJA 1 (recetas a confirmar): la columna "¿Está bien?" es la validación que
 *    faltaba. "OK" y "N/A" cuentan las dos como confirmada: los N/A están todos
 *    en promos y la observación aclara que la receta es la del servicio
 *    equivalente ("Confirmado = NAI105, sin cambios"), no que esté mal. Si
 *    además escribieron una cantidad correcta, se actualiza.
 *  - HOJA 3 (costos de reventa): el precio de costo de cada producto. Se guarda
 *    como envase 1 + precio del envase, que es de donde el sistema deriva el
 *    precio unitario con el que costea la venta.
 *  - HOJA 4 (duraciones): cuánto tarda cada servicio, en texto libre
 *    ("45 min", "1 hora y 30"). Sin este dato el servicio no se puede reservar.
 *
 * La hoja 2 volvió vacía (esos insumos los cargaron en su propia planilla) y la
 * hoja 5 se aplica aparte, porque hay que deducirle la unidad y el envase a cada
 * producto y eso no es mecánico.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/import-pendientes-yb.ts [--commit] [--xlsx <ruta>]
 */
import "../envConfig";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  insumos as insumosTable,
  recetas as recetasTable,
  servicioSucursal as servicioSucursalTable,
  servicios as serviciosTable,
} from "../src/lib/db/schema";
import { leerXlsx } from "./lib/xlsx";

const YB_ID = "seed-000002";
const XLSX_DEFAULT =
  "C:/Users/LBonilla-DIA/Downloads/pendientes malala yerba buena.xlsx";

function num(s: unknown): number | null {
  const t = String(s ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "1 hora y 30 minutos" → 90. Igual criterio que import-tiempos-yb.ts. */
function aMinutos(texto: string): number | null {
  const t = texto.toLowerCase();
  const horas = /(\d+)\s*h(?:ora)?s?/.exec(t);
  const minutos = /(\d+)\s*min/.exec(t);
  let total = (horas ? Number(horas[1]) * 60 : 0) + (minutos ? Number(minutos[1]) : 0);
  // "1 hora y 30" sin la palabra minutos.
  if (horas && !minutos) {
    const suelto = /h(?:ora)?s?\s*y\s*(\d+)/.exec(t);
    if (suelto) total += Number(suelto[1]);
  }
  return total > 0 ? total : null;
}

/** Filas de datos de una hoja: las que van después de la fila de títulos. */
function datosDe(filas: string[][] | undefined): string[][] {
  if (!filas) return [];
  const iTit = filas.findIndex((f) => f?.some((c) => String(c ?? "").startsWith("[")));
  if (iTit < 0) return [];
  return filas.slice(iTit + 1).filter((f) => f && f.some((c) => c));
}

async function main() {
  const commit = process.argv.includes("--commit");
  const i = process.argv.indexOf("--xlsx");
  const hojas = leerXlsx(i >= 0 ? process.argv[i + 1] : XLSX_DEFAULT);

  const db = getDb();
  const insumos = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.sucursalId, YB_ID));
  const servicios = (
    await db
      .select()
      .from(serviciosTable)
      .innerJoin(
        servicioSucursalTable,
        eq(servicioSucursalTable.servicioId, serviciosTable.id),
      )
      .where(eq(servicioSucursalTable.sucursalId, YB_ID))
  ).map((r) => r.servicios);
  const recetas = await db
    .select()
    .from(recetasTable)
    .where(eq(recetasTable.sucursalId, YB_ID));

  const insPorCodigo = new Map(insumos.filter((x) => x.codigo).map((x) => [x.codigo!, x]));
  const svPorCodigo = new Map(servicios.filter((x) => x.codigo).map((x) => [x.codigo!, x]));
  const recPorClave = new Map(recetas.map((r) => [`${r.servicioId}|${r.insumoId}`, r]));
  const insPorNombre = new Map(insumos.map((x) => [x.nombre, x]));

  // ---- HOJA 1: confirmaciones y correcciones de cantidad ----
  const aConfirmar: string[] = [];
  const aCorregir: Array<{ id: string; de: number; a: number; que: string }> = [];
  const h1NoEncontradas: string[] = [];
  for (const f of datosDe(hojas.get("1. Recetas a confirmar"))) {
    const codSv = String(f[0] ?? "").trim();
    const nombreIns = String(f[2] ?? "").trim();
    const respuesta = String(f[5] ?? "").trim().toUpperCase();
    if (!codSv || !nombreIns || !respuesta) continue;

    const sv = svPorCodigo.get(codSv);
    const ins = insPorNombre.get(nombreIns);
    const receta = sv && ins ? recPorClave.get(`${sv.id}|${ins.id}`) : undefined;
    if (!receta) {
      // Puede no existir más: la planilla del salón sacó 48 líneas.
      h1NoEncontradas.push(`${codSv} / ${nombreIns}`);
      continue;
    }
    // OK, N/A y CORREGIDO son las tres una validación: la línea quedó revisada.
    if (["OK", "N/A", "CORREGIDO"].includes(respuesta) && !receta.confirmada)
      aConfirmar.push(receta.id);

    const cantidadNueva = num(f[6]);
    if (cantidadNueva != null && cantidadNueva > 0 && cantidadNueva !== receta.cantidad)
      aCorregir.push({
        id: receta.id,
        de: receta.cantidad,
        a: cantidadNueva,
        que: `${codSv} / ${nombreIns}`,
      });
  }

  // ---- HOJA 3: costos de reventa ----
  const costos: Array<{ id: string; codigo: string; nombre: string; costo: number; venta: number | null }> = [];
  const h3SinCosto: Array<{ codigo: string; nombre: string; obs: string }> = [];
  for (const f of datosDe(hojas.get("3. Costos reventa"))) {
    const codigo = String(f[0] ?? "").trim();
    const ins = insPorCodigo.get(codigo);
    if (!ins) continue;
    const costo = num(f[3]);
    if (costo == null || costo <= 0) {
      h3SinCosto.push({ codigo, nombre: ins.nombre, obs: String(f[4] ?? "") });
      continue;
    }
    if (ins.precioUnitario === costo && ins.tamanoEnvase === 1) continue;
    costos.push({
      id: ins.id,
      codigo,
      nombre: ins.nombre,
      costo,
      venta: ins.precioVenta,
    });
  }

  // ---- HOJA 4: duraciones ----
  const duraciones: Array<{ id: string; codigo: string; nombre: string; min: number; texto: string }> = [];
  const h4Ilegibles: string[] = [];
  for (const f of datosDe(hojas.get("4. Duraciones"))) {
    const codigo = String(f[0] ?? "").trim();
    const sv = svPorCodigo.get(codigo);
    const texto = String(f[3] ?? "").trim();
    if (!sv || !texto) continue;
    const min = aMinutos(texto);
    if (min == null) {
      h4Ilegibles.push(`${codigo} ${sv.nombre} → "${texto}"`);
      continue;
    }
    if (sv.duracionMin === min) continue;
    duraciones.push({ id: sv.id, codigo, nombre: sv.nombre, min, texto });
  }

  // ---- Reporte ----
  const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");
  console.log("=== PENDIENTES COMPLETADOS POR EL SALÓN · YERBA BUENA ===\n");

  console.log(`  HOJA 1 · recetas que pasan a confirmadas: ${aConfirmar.length}`);
  console.log(`           cantidades corregidas: ${aCorregir.length}`);
  for (const c of aCorregir) console.log(`               ${c.que}: ${c.de} → ${c.a}`);
  if (h1NoEncontradas.length)
    console.log(
      `           líneas que ya no existen (las sacó su planilla): ${h1NoEncontradas.length}`,
    );

  console.log(`\n  HOJA 3 · productos de reventa con costo nuevo: ${costos.length}`);
  for (const c of costos) {
    const margen =
      c.venta && c.venta > 0 ? `${(((c.venta - c.costo) / c.venta) * 100).toFixed(0)}%` : "s/precio";
    console.log(
      `               ${c.codigo} ${c.nombre.slice(0, 38).padEnd(38)} costo $${fmt(c.costo).padStart(9)} · margen ${margen}`,
    );
  }
  const enRojo = costos.filter((c) => c.venta && c.costo >= c.venta);
  if (enRojo.length) {
    console.log(`           ⚠ el costo SUPERA el precio de venta: ${enRojo.length}`);
    for (const c of enRojo)
      console.log(`               ${c.codigo} ${c.nombre}: costo $${fmt(c.costo)} vs venta $${fmt(c.venta!)}`);
  }
  if (h3SinCosto.length) {
    console.log(`           sin costo (${h3SinCosto.length}):`);
    for (const x of h3SinCosto)
      console.log(`               ${x.codigo} ${x.nombre}${x.obs ? ` — ${x.obs}` : ""}`);
  }

  console.log(`\n  HOJA 4 · servicios con duración nueva: ${duraciones.length}`);
  for (const d of duraciones)
    console.log(`               ${d.codigo} ${d.nombre.slice(0, 40).padEnd(40)} ${d.min} min ("${d.texto}")`);
  if (h4Ilegibles.length) {
    console.log(`           ⚠ no pude interpretar la duración: ${h4Ilegibles.length}`);
    for (const x of h4Ilegibles) console.log(`               ${x}`);
  }

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    for (let k = 0; k < aConfirmar.length; k += 200)
      await tx
        .update(recetasTable)
        .set({ confirmada: true })
        .where(inArray(recetasTable.id, aConfirmar.slice(k, k + 200)));

    for (const c of aCorregir)
      await tx
        .update(recetasTable)
        .set({ cantidad: c.a, confirmada: true })
        .where(eq(recetasTable.id, c.id));

    for (const c of costos)
      await tx
        .update(insumosTable)
        .set({ tamanoEnvase: 1, precioEnvase: c.costo, precioUnitario: c.costo })
        .where(eq(insumosTable.id, c.id));

    // Se agrupan por duración para no hacer un UPDATE por servicio.
    const porMin = new Map<number, string[]>();
    for (const d of duraciones) {
      if (!porMin.has(d.min)) porMin.set(d.min, []);
      porMin.get(d.min)!.push(d.id);
    }
    for (const [min, ids] of porMin)
      await tx
        .update(serviciosTable)
        .set({ duracionMin: min })
        .where(and(inArray(serviciosTable.id, ids)));
  });

  console.log(
    `\n✔ ${aConfirmar.length} recetas confirmadas, ${aCorregir.length} cantidades corregidas, ${costos.length} costos y ${duraciones.length} duraciones.`,
  );
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
