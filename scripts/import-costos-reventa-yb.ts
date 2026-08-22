/**
 * Carga el PRECIO DE COSTO de los productos de reventa de Malala Yerba Buena
 * (seed-000002), desde la versión corregida del recuento de reventa, que agregó
 * una columna "Precio de costo".
 *
 * Por qué hace falta: los 53 productos de reventa se cargaron sin costo, porque
 * la planilla de precios sólo traía el precio de venta. Sin costo el sistema
 * toma la venta de un producto como margen del 100% y el neto sale inflado.
 *
 * Cómo se guarda: el sistema no tiene un campo "costo" aparte. El costo de
 * cualquier insumo sale de `tamano_envase` + `precio_envase`, y de ahí deriva
 * `precio_unitario`, que es lo que usa para costear. Estos productos se venden
 * por unidad, así que el envase es 1 y el precio del envase es el costo de esa
 * unidad: precio_unitario = costo.
 *
 * NO toca el precio de venta ni el stock: sólo el costo.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/import-costos-reventa-yb.ts [--commit] [--xlsx <ruta>]
 */
import "../envConfig";
import { eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import { insumos as insumosTable } from "../src/lib/db/schema";
import { leerXlsx } from "./lib/xlsx";
import { MAPEO, SIN_CATALOGO } from "./lib/mapeo-recuento-yb";

const YB_ID = "seed-000002";
const XLSX_DEFAULT =
  "C:/Users/LBonilla-DIA/Downloads/recuento_fisico_reventa_yerba_buena_costos_corregido.xlsx";

function num(s: string): number | null {
  const t = (s ?? "").toString().trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function main() {
  const commit = process.argv.includes("--commit");
  const i = process.argv.indexOf("--xlsx");
  const ruta = i >= 0 ? process.argv[i + 1] : XLSX_DEFAULT;

  const hoja = leerXlsx(ruta).get("Recuento Reventa") ?? [];
  // Columna B = producto, E = cantidad contada, H = precio de costo.
  const filas: Array<{ nombre: string; costo: number | null }> = [];
  for (const f of hoja.slice(6)) {
    const nombre = (f?.[1] ?? "").trim();
    if (!nombre) continue;
    filas.push({ nombre, costo: num(f?.[7] ?? "") });
  }

  const db = getDb();
  const catalogo = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.sucursalId, YB_ID));
  const porCodigo = new Map(catalogo.filter((x) => x.codigo).map((x) => [x.codigo!, x]));

  const aActualizar: Array<{
    id: string;
    codigo: string;
    nombre: string;
    costo: number;
    antes: number | null;
    precioVenta: number | null;
  }> = [];
  const sinCosto: string[] = [];
  const sinMapear: Array<{ nombre: string; costo: number | null }> = [];
  const yaIgual: string[] = [];

  for (const f of filas) {
    if (f.costo == null) {
      sinCosto.push(f.nombre);
      continue;
    }
    const codigo = f.nombre in MAPEO ? MAPEO[f.nombre] : null;
    const insumo = codigo ? porCodigo.get(codigo) : undefined;
    if (!insumo) {
      sinMapear.push(f);
      continue;
    }
    if (insumo.precioUnitario === f.costo && insumo.tamanoEnvase === 1) {
      yaIgual.push(`${insumo.codigo} ${insumo.nombre}`);
      continue;
    }
    aActualizar.push({
      id: insumo.id,
      codigo: insumo.codigo!,
      nombre: insumo.nombre,
      costo: f.costo,
      antes: insumo.precioUnitario,
      precioVenta: insumo.precioVenta,
    });
  }

  const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");
  console.log("=== COSTOS DE REVENTA · YERBA BUENA ===\n");
  console.log(`  Filas en la planilla: ${filas.length}`);
  console.log(`  A actualizar: ${aActualizar.length}\n`);
  for (const a of aActualizar.sort((x, y) => x.codigo.localeCompare(y.codigo))) {
    const margen =
      a.precioVenta && a.precioVenta > 0
        ? `${(((a.precioVenta - a.costo) / a.precioVenta) * 100).toFixed(0)}%`
        : "s/precio de venta";
    console.log(
      `      ${a.codigo} ${a.nombre.slice(0, 40).padEnd(40)} costo $${fmt(a.costo).padStart(9)} · venta $${a.precioVenta ? fmt(a.precioVenta).padStart(9) : "        —"} · margen ${margen}`,
    );
  }

  if (yaIgual.length) {
    console.log(`\n  Ya tenían ese costo (${yaIgual.length}): ${yaIgual.join(", ")}`);
  }
  if (sinCosto.length) {
    console.log(`\n  ⚠ Sin precio de costo en la planilla (${sinCosto.length}):`);
    for (const n of sinCosto) console.log(`      ${n}`);
  }
  if (sinMapear.length) {
    console.log(`\n  ⚠ Con costo pero sin producto en el catálogo (${sinMapear.length}):`);
    for (const f of sinMapear)
      console.log(
        `      $${fmt(f.costo!).padStart(9)} · ${f.nombre}${SIN_CATALOGO[f.nombre] ? ` — ${SIN_CATALOGO[f.nombre]}` : ""}`,
      );
  }

  // Un costo mayor al precio de venta se vendería a pérdida: hay que avisarlo.
  const enRojo = aActualizar.filter((a) => a.precioVenta && a.costo >= a.precioVenta);
  if (enRojo.length) {
    console.log(`\n  ⚠ El costo SUPERA el precio de venta (${enRojo.length}):`);
    for (const a of enRojo)
      console.log(`      ${a.codigo} ${a.nombre}: costo $${fmt(a.costo)} vs venta $${fmt(a.precioVenta!)}`);
  }

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    for (const a of aActualizar)
      await tx
        .update(insumosTable)
        .set({ tamanoEnvase: 1, precioEnvase: a.costo, precioUnitario: a.costo })
        .where(eq(insumosTable.id, a.id));
  });

  console.log(`\n✔ ${aActualizar.length} productos con su costo cargado.`);
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
