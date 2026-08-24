/**
 * Cambia el precio de compra de un insumo de Malala Yerba Buena.
 *
 * El sistema no guarda un "costo" suelto: lo deriva de `precio_envase` dividido
 * `tamano_envase`. Este script toca el precio del envase y recalcula el unitario,
 * que es el número con el que se costean las recetas y las ventas.
 *
 * Existe porque los precios cambian seguido y conviene que cada cambio quede
 * registrado en el repo con su motivo, en vez de resolverlo con un UPDATE suelto.
 * Para un aumento a todos los insumos de un proveedor, la app ya tiene su propia
 * pantalla (Catálogos → Insumos → aumento por proveedor).
 *
 * Muestra qué servicios se ven afectados antes de tocar nada: un cambio de precio
 * mueve el costo de todas las recetas que usan ese insumo.
 *
 * Dry-run salvo --commit.
 * Uso:
 *   npx tsx scripts/actualizar-precio-yb.ts --codigo INS702 --precio-envase 24800 \
 *     --motivo "16 USD a $1550" [--commit]
 */
import "../envConfig";
import { and, eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  insumos as insumosTable,
  recetas as recetasTable,
  servicioSucursal as servicioSucursalTable,
  servicios as serviciosTable,
} from "../src/lib/db/schema";

const YB_ID = "seed-000002";

async function main() {
  const commit = process.argv.includes("--commit");
  const arg = (n: string) => {
    const i = process.argv.indexOf(n);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const codigo = arg("--codigo");
  const precioEnvase = Number(arg("--precio-envase"));
  const motivo = arg("--motivo") ?? "";

  if (!codigo || !Number.isFinite(precioEnvase) || precioEnvase <= 0) {
    console.error(
      "Uso: npx tsx scripts/actualizar-precio-yb.ts --codigo <COD> --precio-envase <n> [--motivo <texto>] [--commit]",
    );
    process.exit(1);
  }

  const db = getDb();
  const [insumo] = await db
    .select()
    .from(insumosTable)
    .where(and(eq(insumosTable.sucursalId, YB_ID), eq(insumosTable.codigo, codigo)))
    .limit(1);
  if (!insumo) {
    console.error(`No hay ningún insumo con código ${codigo} en Yerba Buena.`);
    await getSqlClient().end({ timeout: 5 });
    process.exit(1);
  }

  const unitarioNuevo = precioEnvase / insumo.tamanoEnvase;
  const afectados = await db
    .select({
      codigo: serviciosTable.codigo,
      nombre: serviciosTable.nombre,
      precioEfectivo: serviciosTable.precioEfectivo,
      cantidad: recetasTable.cantidad,
    })
    .from(recetasTable)
    .innerJoin(serviciosTable, eq(serviciosTable.id, recetasTable.servicioId))
    .innerJoin(
      servicioSucursalTable,
      and(
        eq(servicioSucursalTable.servicioId, serviciosTable.id),
        eq(servicioSucursalTable.sucursalId, YB_ID),
      ),
    )
    .where(
      and(eq(recetasTable.insumoId, insumo.id), eq(recetasTable.sucursalId, YB_ID)),
    );

  const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");
  console.log("=== CAMBIO DE PRECIO · YERBA BUENA ===\n");
  console.log(`  ${insumo.codigo} ${insumo.nombre}`);
  console.log(`  envase: ${insumo.tamanoEnvase} ${insumo.unidadMedida}`);
  console.log(
    `  precio del envase: $${fmt(insumo.precioEnvase)} → $${fmt(precioEnvase)}  (${precioEnvase > insumo.precioEnvase ? "+" : ""}${(((precioEnvase - insumo.precioEnvase) / (insumo.precioEnvase || 1)) * 100).toFixed(0)}%)`,
  );
  console.log(
    `  precio unitario:   $${(insumo.precioUnitario ?? 0).toFixed(2)} → $${unitarioNuevo.toFixed(2)} por ${insumo.unidadMedida}`,
  );
  if (motivo) console.log(`  motivo: ${motivo}`);

  if (insumo.tipo === "venta" && insumo.precioVenta)
    console.log(
      `\n  Es un producto de venta: el margen pasa de ${(((insumo.precioVenta - (insumo.precioUnitario ?? 0)) / insumo.precioVenta) * 100).toFixed(0)}% a ${(((insumo.precioVenta - unitarioNuevo) / insumo.precioVenta) * 100).toFixed(0)}%${unitarioNuevo >= insumo.precioVenta ? "  ⚠ SE VENDE A PÉRDIDA" : ""}`,
    );

  console.log(`\n  Servicios cuyo costo cambia: ${afectados.length}`);
  for (const s of afectados) {
    const antes = (insumo.precioUnitario ?? 0) * s.cantidad;
    const ahora = unitarioNuevo * s.cantidad;
    const pct = s.precioEfectivo > 0 ? ((ahora - antes) / s.precioEfectivo) * 100 : 0;
    console.log(
      `      ${(s.codigo ?? "").padEnd(7)} ${s.nombre.slice(0, 38).padEnd(38)} ${s.cantidad} ${insumo.unidadMedida} · $${fmt(antes)} → $${fmt(ahora)}${pct ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)} pts de margen)` : ""}`,
    );
  }

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db
    .update(insumosTable)
    .set({ precioEnvase, precioUnitario: unitarioNuevo })
    .where(eq(insumosTable.id, insumo.id));

  console.log(`\n✔ ${insumo.codigo} actualizado.`);
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
