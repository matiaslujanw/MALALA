/**
 * Carga en Malala Yerba Buena (seed-000002) la planilla que mandó el salón,
 * ya parseada en scripts/data/yb-planilla-ago26.json por
 * scripts/parse-planilla-yb.ts.
 *
 * Qué carga, en este orden (obligado por las FKs):
 *   1. proveedores + membresía proveedor_sucursal (11)
 *   2. insumos de bacha (116) y productos de venta (53, tipo='venta')
 *   3. insumo_proveedores (N:N) y stock_sucursal en 0
 *   4. servicios (226) + membresía servicio_sucursal
 *   5. recetas (884 líneas), marcando confirmada=false las que la planilla dejó
 *      como "Propuesta (a confirmar)"
 *
 * Criterios:
 *  - `rubro` = Subrubro de la planilla EN MAYÚSCULAS, que es como están los
 *    rubros existentes y como los normaliza el formulario al editar. Si se
 *    cargaran en minúscula, editar un servicio desde la app crearía un rubro
 *    duplicado ("Coloracion" y "COLORACION").
 *  - `codigo` = Cod_Servicio / Cod_Insumo de la planilla.
 *  - `id` = "yb-<codigo>", para que la carga sea idempotente y trazable.
 *  - Servicios sin precio ("Pendiente" / "no tenemos") entran en 0 e inactivos.
 *  - La duración no viene en la planilla: se hereda del servicio actual de YB
 *    con el nombre más parecido, o se lee del propio nombre ("30 min", "1 hora").
 *    Lo que no matchea queda en null y se lista en el reporte.
 *  - Los productos de venta no traen costo de compra: se cargan con
 *    precio_unitario = null (desconocido, NO cero) para no inflar el margen con
 *    un costo inventado.
 *  - Los combos y promos de la planilla entran como servicios comunes
 *    (es_promo=false): la planilla no dice qué servicios combina cada uno.
 *
 * Borra el catálogo actual de YB (servicios, insumos y recetas). Aborta si algo
 * está referenciado por turnos, ventas, fichas o movimientos de stock: en ese
 * caso habría que desactivar en vez de borrar. NO toca clientes, empleadas,
 * horarios ni la sucursal Centro.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/import-yb-planilla.ts [--commit] [--ocultar-tiers]
 */
import "../envConfig";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
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

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Coeficiente de Dice sobre bigramas de caracteres. 1 = idéntico. */
function similitud(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigramas = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ma = bigramas(a);
  const mb = bigramas(b);
  let comunes = 0;
  for (const [g, n] of ma) comunes += Math.min(n, mb.get(g) ?? 0);
  return (2 * comunes) / (a.length - 1 + (b.length - 1));
}

const UMBRAL_SIMILITUD = 0.72;

/**
 * Duración declarada en el propio nombre ("30 min", "(1hora)", "1 h"). Tiene
 * prioridad sobre el match por similitud: sin esto "Masaje relajante 60 min"
 * hereda los 30 min de "Masajes Relajantes 30 min".
 */
function duracionDelNombre(nombre: string): number | null {
  const n = nombre.toLowerCase();
  const min = n.match(/(\d+)\s*min/);
  if (min) return Number(min[1]);
  const hs = n.match(/(\d+)\s*h(?:ora)?s?\b/);
  if (hs) return Number(hs[1]) * 60;
  return null;
}

/**
 * Saca el sufijo de largo de pelo de un nombre: "Keraplex antifrizz 2" y
 * "Celulas Madres ALFAPARF (3)" son el mismo trabajo. Devuelve null si no lo
 * tiene.
 */
function sinTier(nombre: string): string | null {
  const m = /^(.*?)[\s(]*(?:precio\s*)?([1-4])\)?$/i.exec(nombre.trim());
  const base = m?.[1]?.trim();
  return base ? base : null;
}

/**
 * Servicios que son el mismo trabajo con precio por largo de pelo ("Keraplex
 * antifrizz 1 / 2 / 3"). Devuelve, por grupo, los ítems ordenados por precio.
 */
function detectarTiers(
  servicios: PlanillaYB["servicios"],
): Array<{ grupo: string; items: PlanillaYB["servicios"] }> {
  const grupos = new Map<string, PlanillaYB["servicios"]>();
  for (const s of servicios) {
    const base = sinTier(s.nombre);
    if (!base) continue;
    const clave = `${s.rubro}|${norm(base)}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(s);
  }
  return [...grupos.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([grupo, items]) => ({
      grupo,
      items: [...items].sort((a, b) => a.precioLista - b.precioLista),
    }));
}

async function main() {
  const commit = process.argv.includes("--commit");
  const ocultarTiers = process.argv.includes("--ocultar-tiers");
  const db = getDb();
  const q = async (s: string) =>
    (await db.execute(sql.raw(s))) as unknown as Array<Record<string, unknown>>;

  const planilla = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "data", "yb-planilla-ago26.json"),
      "utf8",
    ),
  ) as PlanillaYB;

  if (planilla.sucursalId !== YB_ID)
    throw new Error(`La planilla dice sucursal ${planilla.sucursalId}, esperaba ${YB_ID}`);

  // --- Estado actual de YB -------------------------------------------------
  const actuales = await db
    .select({
      id: serviciosTable.id,
      nombre: serviciosTable.nombre,
      duracionMin: serviciosTable.duracionMin,
    })
    .from(serviciosTable)
    .innerJoin(
      servicioSucursalTable,
      eq(servicioSucursalTable.servicioId, serviciosTable.id),
    )
    .where(eq(servicioSucursalTable.sucursalId, YB_ID));

  const insumosActuales = await db
    .select({ id: insumosTable.id })
    .from(insumosTable)
    .where(eq(insumosTable.sucursalId, YB_ID));

  // --- Servicios -----------------------------------------------------------
  const tiers = detectarTiers(planilla.servicios);
  const ocultos = new Set(
    ocultarTiers
      ? tiers.flatMap(({ items }) => items.slice(1).map((s) => s.codigo))
      : [],
  );

  const nuevosServicios = planilla.servicios.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    rubro: s.rubro.toUpperCase(),
    nombre: s.nombre,
    precioLista: s.precioLista,
    precioEfectivo: s.precioEfectivo,
    comisionDefaultPct: 0, // la comisión la define el % de cada empleada
    activo: s.activo,
    visibleReserva: !ocultos.has(s.codigo),
    duracionMin: null as number | null,
    esPromo: false,
  }));

  // Duración: primero la que declara el propio nombre, si no la del servicio
  // actual de YB más parecido.
  const candidatos = actuales
    .filter((a) => a.duracionMin != null && duracionDelNombre(a.nombre) === null)
    .map((a) => ({ nombre: a.nombre, norm: norm(a.nombre), dur: a.duracionMin! }));

  const porNombre: Array<{ nombre: string; dur: number }> = [];
  const porSimilitud: Array<{ nuevo: string; viejo: string; dur: number; sim: number }> = [];

  function mejorMatch(nombre: string) {
    const nn = norm(nombre);
    let mejor: (typeof candidatos)[number] | null = null;
    let mejorSim = 0;
    for (const c of candidatos) {
      const s = similitud(nn, c.norm);
      if (s > mejorSim) {
        mejorSim = s;
        mejor = c;
      }
    }
    return mejor && mejorSim >= UMBRAL_SIMILITUD ? { ...mejor, sim: mejorSim } : null;
  }

  for (const n of nuevosServicios) {
    const propia = duracionDelNombre(n.nombre);
    if (propia !== null) {
      n.duracionMin = propia;
      porNombre.push({ nombre: n.nombre, dur: propia });
      continue;
    }
    // Segundo intento sin el sufijo de largo de pelo: el servicio viejo se
    // llamaba "Keraplex antifrizz" a secas, sin el 1/2/3.
    const m = mejorMatch(n.nombre) ?? mejorMatch(sinTier(n.nombre) ?? n.nombre);
    if (m) {
      n.duracionMin = m.dur;
      porSimilitud.push({ nuevo: n.nombre, viejo: m.nombre, dur: m.dur, sim: m.sim });
    }
  }

  // Dentro de un grupo por largo de pelo la duración es la misma: si alguno del
  // grupo la consiguió, se la pasa a los hermanos que quedaron sin nada.
  const porGrupo: Array<{ nombre: string; dur: number; desde: string }> = [];
  const servicioPorCodigo = new Map(nuevosServicios.map((s) => [s.codigo, s]));
  for (const { items } of tiers) {
    const conDuracion = items
      .map((i) => servicioPorCodigo.get(i.codigo)!)
      .find((s) => s.duracionMin != null);
    if (!conDuracion) continue;
    for (const i of items) {
      const s = servicioPorCodigo.get(i.codigo)!;
      if (s.duracionMin != null) continue;
      s.duracionMin = conDuracion.duracionMin;
      porGrupo.push({ nombre: s.nombre, dur: s.duracionMin!, desde: conDuracion.nombre });
    }
  }

  const sinDuracion = nuevosServicios.filter((n) => n.duracionMin == null);

  // --- Insumos (bacha) y productos de venta --------------------------------
  const nuevosInsumos = [
    ...planilla.insumos.map((i) => ({
      id: i.id,
      sucursalId: YB_ID,
      nombre: i.nombre,
      codigo: i.codigo,
      unidadMedida: i.unidadMedida,
      // Sin envase conocido se carga 1/0: el costo real queda como
      // precio_unitario = null, que es lo que el sistema lee como "no sé".
      tamanoEnvase: i.tamanoEnvase ?? 1,
      precioEnvase: i.precioEnvase ?? 0,
      precioUnitario: i.precioUnitario,
      rinde: null,
      umbralStockBajo: 0,
      activo: true,
      tipo: "bacha" as const,
      vendible: false,
      precioVenta: null as number | null,
    })),
    ...planilla.productos.map((p) => ({
      id: p.id,
      sucursalId: YB_ID,
      nombre: p.nombre,
      codigo: p.codigo,
      unidadMedida: "ud" as const,
      tamanoEnvase: 1,
      precioEnvase: 0,
      // La planilla no trae a cuánto compran el producto: null = desconocido.
      // Con 0 el sistema costearía la venta en cero e inflaría el neto.
      precioUnitario: null as number | null,
      rinde: null,
      umbralStockBajo: 0,
      activo: p.activo,
      tipo: "venta" as const,
      vendible: true,
      precioVenta: p.precioVenta,
    })),
  ];

  const vinculos = planilla.insumos
    .filter((i) => i.proveedorId)
    .map((i) => ({
      id: crypto.randomUUID(),
      insumoId: i.id,
      proveedorId: i.proveedorId!,
    }));

  // --- Recetas -------------------------------------------------------------
  const nuevasRecetas = planilla.recetas.flatMap((r) =>
    r.lineas.map((l) => ({
      id: `yb-rec-${r.servicioCodigo}-${l.insumoCodigo}`,
      sucursalId: YB_ID,
      servicioId: `yb-${r.servicioCodigo}`,
      insumoId: `yb-${l.insumoCodigo}`,
      cantidad: l.cantidad,
      confirmada: r.confirmada,
    })),
  );

  // --- Chequeo de referencias ---------------------------------------------
  const lista = (ids: string[]) =>
    ids.map((i) => `'${i.replace(/'/g, "''")}'`).join(",");

  let servRef: Array<Record<string, unknown>> = [];
  if (actuales.length)
    servRef = (
      await q(`
        select sv.id, sv.nombre,
            (select count(*) from turnos t where t.servicio_id = sv.id)
          + (select count(*) from ingreso_lineas il where il.servicio_id = sv.id or il.promo_servicio_id = sv.id)
          + (select count(*) from cliente_ficha_registros f where f.servicio_id = sv.id) as n
        from servicios sv where sv.id in (${lista(actuales.map((a) => a.id))})`)
    ).filter((r) => Number(r.n) > 0);

  let insRef: Array<Record<string, unknown>> = [];
  if (insumosActuales.length)
    insRef = (
      await q(`
        select i.id, i.nombre,
            (select count(*) from movimientos_stock m where m.insumo_id = i.id)
          + (select count(*) from ingreso_lineas il where il.insumo_id = i.id)
          + (select count(*) from egresos e where e.insumo_id = i.id) as n
        from insumos i where i.id in (${lista(insumosActuales.map((i) => i.id))})`)
    ).filter((r) => Number(r.n) > 0);

  // --- Reporte -------------------------------------------------------------
  console.log("=== CARGA YERBA BUENA · planilla agosto 2026 ===");
  console.log(`  Fuente: ${planilla.fuente}`);
  console.log(`  Modo: ${commit ? "COMMIT" : "DRY-RUN"}\n`);

  console.log(`  Proveedores: ${planilla.proveedores.length}`);
  console.log(
    `  Insumos de bacha: ${planilla.insumos.length} · productos de venta: ${planilla.productos.length}`,
  );
  const sinPrecio = planilla.insumos.filter((i) => i.precioUnitario == null);
  console.log(`  Insumos sin precio unitario (costo incompleto): ${sinPrecio.length}`);
  for (const i of sinPrecio) console.log(`      ${i.codigo} ${i.nombre}`);

  console.log(`\n  Servicios: ${nuevosServicios.length}`);
  const porRubro = new Map<string, number>();
  for (const s of nuevosServicios) porRubro.set(s.rubro, (porRubro.get(s.rubro) ?? 0) + 1);
  for (const [r, n] of [...porRubro].sort((a, b) => b[1] - a[1]))
    console.log(`      ${String(n).padStart(3)}  ${r}`);
  const inactivos = nuevosServicios.filter((s) => !s.activo);
  console.log(`\n  Sin precio → 0 e inactivos: ${inactivos.length}`);
  for (const s of inactivos) console.log(`      ${s.codigo} ${s.nombre}`);

  console.log(
    `\n  Duración: ${porNombre.length} leída del nombre + ${porSimilitud.length} por similitud + ${porGrupo.length} del grupo de largo de pelo = ${nuevosServicios.length - sinDuracion.length}/${nuevosServicios.length}`,
  );
  for (const m of porSimilitud.sort((a, b) => a.sim - b.sim))
    console.log(`      ${m.sim.toFixed(2)} ${m.dur}min · "${m.nuevo}"  ←  "${m.viejo}"`);
  for (const m of porGrupo)
    console.log(`      grupo ${m.dur}min · "${m.nombre}"  ←  "${m.desde}"`);
  console.log(`\n  ⚠ Sin duración (no se pueden reservar online): ${sinDuracion.length}`);
  for (const s of sinDuracion) console.log(`      ${s.codigo} ${s.nombre}`);

  console.log(`\n  Precios por largo de pelo detectados: ${tiers.length} grupos`);
  for (const { items } of tiers)
    console.log(
      `      ${items.map((i) => `${i.codigo} $${i.precioLista}`).join("  ")}  · ${items[0].nombre}`,
    );
  console.log(
    ocultarTiers
      ? `      → ${ocultos.size} servicios quedan solo-caja (visible_reserva=false); en la web se ve el más barato de cada grupo.`
      : `      → sin --ocultar-tiers los ${tiers.reduce((a, t) => a + t.items.length - 1, 0)} se muestran todos en la reserva pública.`,
  );

  const confirmadas = nuevasRecetas.filter((r) => r.confirmada).length;
  console.log(
    `\n  Recetas: ${nuevasRecetas.length} líneas (${confirmadas} confirmadas / ${nuevasRecetas.length - confirmadas} propuestas)`,
  );
  const insumosSinPrecioIds = new Set(sinPrecio.map((i) => i.id));
  console.log(
    `      líneas cuyo insumo no tiene precio: ${nuevasRecetas.filter((r) => insumosSinPrecioIds.has(r.insumoId)).length}`,
  );

  console.log(`\n  A borrar en YB: ${actuales.length} servicios, ${insumosActuales.length} insumos`);
  if (servRef.length || insRef.length) {
    console.log("\n  ⚠ HAY REGISTROS REFERENCIADOS (turnos / ventas / fichas / stock):");
    for (const r of [...servRef, ...insRef]) console.log(`      ${r.nombre} (${r.n} refs)`);
    console.log("  Abortado: habría que desactivarlos en vez de borrarlos.");
    await getSqlClient().end({ timeout: 5 });
    process.exit(1);
  }

  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  // --- Carga ---------------------------------------------------------------
  await db.transaction(async (tx) => {
    // Borrar primero lo viejo. recetas, stock_sucursal e insumo_proveedores
    // caen solos por cascade al borrar insumos y servicios.
    if (insumosActuales.length)
      await tx.delete(insumosTable).where(eq(insumosTable.sucursalId, YB_ID));
    if (actuales.length)
      await tx.delete(serviciosTable).where(
        inArray(
          serviciosTable.id,
          actuales.map((a) => a.id),
        ),
      );

    for (const p of planilla.proveedores) {
      await tx
        .insert(proveedoresTable)
        .values({ id: p.id, nombre: p.nombre })
        .onConflictDoUpdate({ target: proveedoresTable.id, set: { nombre: p.nombre } });
      await tx
        .insert(proveedorSucursalTable)
        .values({ id: crypto.randomUUID(), proveedorId: p.id, sucursalId: YB_ID })
        .onConflictDoNothing();
    }

    for (let i = 0; i < nuevosInsumos.length; i += 200)
      await tx.insert(insumosTable).values(nuevosInsumos.slice(i, i + 200));
    for (let i = 0; i < vinculos.length; i += 200)
      await tx.insert(insumoProveedoresTable).values(vinculos.slice(i, i + 200));

    // Stock en 0 para que todos aparezcan en la pantalla de Stock listos para
    // el conteo inicial. Sin esta fila el insumo no se ve ahí.
    for (let i = 0; i < nuevosInsumos.length; i += 200)
      await tx.insert(stockSucursalTable).values(
        nuevosInsumos.slice(i, i + 200).map((n) => ({
          id: `yb-stk-${n.codigo}`,
          insumoId: n.id,
          sucursalId: YB_ID,
          cantidad: 0,
        })),
      );

    for (let i = 0; i < nuevosServicios.length; i += 200) {
      const lote = nuevosServicios.slice(i, i + 200);
      await tx.insert(serviciosTable).values(lote);
      await tx.insert(servicioSucursalTable).values(
        lote.map((s) => ({
          id: crypto.randomUUID(),
          servicioId: s.id,
          sucursalId: YB_ID,
        })),
      );
    }

    for (let i = 0; i < nuevasRecetas.length; i += 200)
      await tx.insert(recetasTable).values(nuevasRecetas.slice(i, i + 200));
  });

  console.log(
    `\n✔ Yerba Buena: ${nuevosServicios.length} servicios, ${nuevosInsumos.length} insumos (${planilla.productos.length} de venta), ${planilla.proveedores.length} proveedores y ${nuevasRecetas.length} líneas de receta.`,
  );
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
