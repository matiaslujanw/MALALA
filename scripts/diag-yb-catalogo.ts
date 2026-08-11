/**
 * SOLO LECTURA. Verifica cómo quedó el catálogo de Yerba Buena después de
 * cargar la planilla (scripts/import-yb-planilla.ts): conteos, códigos
 * duplicados, costo y margen por servicio, y todo lo que quedó incompleto y
 * hay que pedirle al salón.
 *
 * Uso: npx tsx scripts/diag-yb-catalogo.ts [--todos]
 *   --todos  lista completa en vez de los primeros de cada sección.
 */
import "../envConfig";
import { sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";

const YB = "seed-000002";

async function main() {
  const todos = process.argv.includes("--todos");
  const db = getDb();
  const q = async (s: string) =>
    (await db.execute(sql.raw(s))) as unknown as Array<Record<string, unknown>>;
  const recorta = <T>(xs: T[]) => (todos ? xs : xs.slice(0, 15));
  const resto = (n: number) =>
    !todos && n > 15 ? `      … y ${n - 15} más (corré con --todos)` : null;

  console.log("=== CATÁLOGO YERBA BUENA ===\n");

  const [conteos] = await q(`
    select
      (select count(*) from servicios sv join servicio_sucursal ss on ss.servicio_id = sv.id
        where ss.sucursal_id = '${YB}')::int servicios,
      (select count(*) from servicios sv join servicio_sucursal ss on ss.servicio_id = sv.id
        where ss.sucursal_id = '${YB}' and sv.activo)::int servicios_activos,
      (select count(*) from servicios sv join servicio_sucursal ss on ss.servicio_id = sv.id
        where ss.sucursal_id = '${YB}' and sv.visible_reserva and sv.activo)::int en_reserva,
      (select count(*) from insumos where sucursal_id = '${YB}' and tipo = 'bacha')::int bacha,
      (select count(*) from insumos where sucursal_id = '${YB}' and tipo = 'venta')::int venta,
      (select count(*) from insumos where sucursal_id = '${YB}' and precio_unitario is null)::int sin_precio,
      (select count(*) from recetas where sucursal_id = '${YB}')::int recetas,
      (select count(*) from recetas where sucursal_id = '${YB}' and confirmada)::int confirmadas,
      (select count(*) from stock_sucursal where sucursal_id = '${YB}')::int stock,
      (select count(*) from proveedor_sucursal where sucursal_id = '${YB}')::int proveedores,
      (select count(*) from insumo_proveedores ip join insumos i on i.id = ip.insumo_id
        where i.sucursal_id = '${YB}')::int vinculos`);

  console.log(
    `  Servicios: ${conteos.servicios} (${conteos.servicios_activos} activos, ${conteos.en_reserva} visibles en la reserva pública)`,
  );
  console.log(`  Insumos: ${conteos.bacha} de bacha + ${conteos.venta} de venta`);
  console.log(`  Proveedores: ${conteos.proveedores} · vínculos insumo↔proveedor: ${conteos.vinculos}`);
  console.log(
    `  Recetas: ${conteos.recetas} líneas (${conteos.confirmadas} confirmadas / ${Number(conteos.recetas) - Number(conteos.confirmadas)} propuestas)`,
  );
  console.log(`  Filas de stock: ${conteos.stock}`);

  const dupServ = await q(
    `select codigo, count(*)::int n from servicios where codigo is not null group by 1 having count(*) > 1`,
  );
  const dupIns = await q(
    `select codigo, count(*)::int n from insumos where sucursal_id = '${YB}' and codigo is not null group by 1 having count(*) > 1`,
  );
  console.log(
    `\n  Códigos duplicados: ${dupServ.length} en servicios, ${dupIns.length} en insumos ${dupServ.length + dupIns.length === 0 ? "✔" : "⚠"}`,
  );
  for (const r of [...dupServ, ...dupIns]) console.log(`      ⚠ ${r.codigo} x${r.n}`);

  // --- Costo y margen ------------------------------------------------------
  const costos = await q(`
    select sv.codigo, sv.nombre, sv.precio_efectivo,
           coalesce(sum(r.cantidad * i.precio_unitario), 0) costo,
           count(r.id)::int lineas,
           count(*) filter (where i.precio_unitario is null)::int lineas_sin_precio
      from servicios sv
      join servicio_sucursal ss on ss.servicio_id = sv.id and ss.sucursal_id = '${YB}'
      left join recetas r on r.servicio_id = sv.id and r.sucursal_id = '${YB}'
      left join insumos i on i.id = r.insumo_id
     where sv.activo
     group by sv.id, sv.codigo, sv.nombre, sv.precio_efectivo
     order by sv.codigo`);

  const conReceta = costos.filter((c) => Number(c.lineas) > 0);
  const sinReceta = costos.filter((c) => Number(c.lineas) === 0);
  const negativos = conReceta.filter(
    (c) => Number(c.costo) > Number(c.precio_efectivo) && Number(c.precio_efectivo) > 0,
  );
  const margenes = conReceta
    .filter((c) => Number(c.precio_efectivo) > 0 && Number(c.lineas_sin_precio) === 0)
    .map((c) => ({
      codigo: String(c.codigo ?? ""),
      nombre: String(c.nombre ?? ""),
      precioEfectivo: Number(c.precio_efectivo),
      costo: Number(c.costo),
      pct: (1 - Number(c.costo) / Number(c.precio_efectivo)) * 100,
    }))
    .sort((a, b) => a.pct - b.pct);

  console.log(`\n  Servicios activos con receta: ${conReceta.length} / ${costos.length}`);
  console.log(
    `  Margen sobre precio efectivo (solo los ${margenes.length} con todos los insumos costeados):`,
  );
  if (margenes.length) {
    const prom = margenes.reduce((a, m) => a + m.pct, 0) / margenes.length;
    console.log(`      promedio ${prom.toFixed(1)}%`);
    console.log("      los 10 más ajustados:");
    for (const m of margenes.slice(0, 10))
      console.log(
        `        ${m.pct.toFixed(1).padStart(6)}%  ${m.codigo} ${m.nombre} · precio $${m.precioEfectivo.toLocaleString("es-AR")} / costo $${Math.round(m.costo).toLocaleString("es-AR")}`,
      );
  }

  console.log(`\n  ⚠ Servicios donde el costo SUPERA el precio efectivo: ${negativos.length}`);
  for (const c of recorta(negativos))
    console.log(
      `      ${c.codigo} ${c.nombre}: precio $${Number(c.precio_efectivo).toLocaleString("es-AR")} vs costo $${Math.round(Number(c.costo)).toLocaleString("es-AR")}`,
    );
  const r1 = resto(negativos.length);
  if (r1) console.log(r1);

  console.log(`\n  Servicios activos SIN receta: ${sinReceta.length}`);
  for (const c of recorta(sinReceta)) console.log(`      ${c.codigo} ${c.nombre}`);
  const r2 = resto(sinReceta.length);
  if (r2) console.log(r2);

  // --- Lo que falta pedirle al salón ---------------------------------------
  const insumosSinPrecio = await q(`
    select i.codigo, i.nombre,
           (select count(*) from recetas r where r.insumo_id = i.id)::int usos
      from insumos i
     where i.sucursal_id = '${YB}' and i.tipo = 'bacha' and i.precio_unitario is null
     order by usos desc, i.codigo`);
  console.log(
    `\n  ⚠ Insumos de bacha sin precio (el costo de ${insumosSinPrecio.reduce((a, i) => a + Number(i.usos), 0)} líneas de receta queda en $0): ${insumosSinPrecio.length}`,
  );
  for (const i of recorta(insumosSinPrecio))
    console.log(`      ${i.codigo} ${i.nombre} · usado en ${i.usos} recetas`);
  const r3 = resto(insumosSinPrecio.length);
  if (r3) console.log(r3);

  const sinDuracion = await q(`
    select sv.codigo, sv.nombre from servicios sv
      join servicio_sucursal ss on ss.servicio_id = sv.id and ss.sucursal_id = '${YB}'
     where sv.activo and sv.duracion_min is null order by sv.codigo`);
  console.log(
    `\n  ⚠ Servicios activos sin duración (no se pueden reservar online): ${sinDuracion.length}`,
  );
  for (const s of recorta(sinDuracion)) console.log(`      ${s.codigo} ${s.nombre}`);
  const r4 = resto(sinDuracion.length);
  if (r4) console.log(r4);

  const propuestas = await q(`
    select sv.codigo, sv.nombre, count(*)::int n from recetas r
      join servicios sv on sv.id = r.servicio_id
     where r.sucursal_id = '${YB}' and not r.confirmada
     group by 1, 2 order by n desc, sv.codigo`);
  console.log(
    `\n  Recetas con líneas a confirmar por el salón: ${propuestas.length} servicios`,
  );
  for (const p of recorta(propuestas)) console.log(`      ${p.codigo} ${p.nombre} · ${p.n} líneas`);
  const r5 = resto(propuestas.length);
  if (r5) console.log(r5);

  // --- Que no se haya tocado la otra sucursal ------------------------------
  const [centro] = await q(`
    select
      (select count(*) from servicios sv join servicio_sucursal ss on ss.servicio_id = sv.id
        where ss.sucursal_id = 'seed-000001')::int servicios,
      (select count(*) from insumos where sucursal_id = 'seed-000001')::int insumos,
      (select count(*) from recetas where sucursal_id = 'seed-000001')::int recetas`);
  console.log(
    `\n  Centro (sin tocar): ${centro.servicios} servicios, ${centro.insumos} insumos, ${centro.recetas} recetas`,
  );

  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
