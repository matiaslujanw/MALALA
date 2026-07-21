/**
 * SOLO LECTURA. Estado actual de Yerba Buena (seed-000002) antes de recargar
 * servicios/stock: cuántos servicios hay, cuáles están referenciados por
 * turnos/ventas/fichas (o sea, no borrables), y qué insumos existen.
 * Uso: npx tsx scripts/diag-yb-carga.ts
 */
import "../envConfig";
import { sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";

const YB = "seed-000002";

async function main() {
  const db = getDb();
  const q = async (s: string) =>
    (await db.execute(sql.raw(s))) as unknown as Array<Record<string, unknown>>;

  console.log("=== SUCURSALES ===");
  for (const s of await q(`select id, nombre, slug, activo from sucursales order by id`))
    console.log(`  ${s.id} | ${s.nombre} | ${s.slug} | activo=${s.activo}`);

  console.log("\n=== SERVICIOS por sucursal ===");
  for (const r of await q(
    `select ss.sucursal_id s, count(*)::int n, count(*) filter (where sv.activo)::int act
       from servicio_sucursal ss join servicios sv on sv.id = ss.servicio_id
      group by 1 order by 1`,
  ))
    console.log(`  ${r.s}: ${r.n} (activos ${r.act})`);
  console.log(
    `  servicios SIN membresía: ${(await q(`select count(*)::int n from servicios sv where not exists (select 1 from servicio_sucursal ss where ss.servicio_id=sv.id)`))[0].n}`,
  );

  console.log("\n=== Servicios de YB por rubro ===");
  for (const r of await q(
    `select sv.rubro, count(*)::int n from servicios sv
       join servicio_sucursal ss on ss.servicio_id=sv.id and ss.sucursal_id='${YB}'
      group by 1 order by 2 desc`,
  ))
    console.log(`  ${String(r.n).padStart(3)}  ${r.rubro}`);

  console.log("\n=== Servicios de YB REFERENCIADOS (no borrables con DELETE) ===");
  const refs = await q(`
    with yb as (select sv.id, sv.nombre, sv.rubro from servicios sv
                  join servicio_sucursal ss on ss.servicio_id=sv.id and ss.sucursal_id='${YB}')
    select yb.rubro, yb.nombre,
      (select count(*)::int from turnos t where t.servicio_id=yb.id) turnos,
      (select count(*)::int from ingreso_lineas il where il.servicio_id=yb.id or il.promo_servicio_id=yb.id) ventas,
      (select count(*)::int from cliente_ficha_registros f where f.servicio_id=yb.id) fichas
    from yb order by 3 desc, 4 desc`);
  const conRef = refs.filter(
    (r) => Number(r.turnos) + Number(r.ventas) + Number(r.fichas) > 0,
  );
  console.log(`  ${conRef.length} de ${refs.length} servicios tienen referencias.`);
  for (const r of conRef.slice(0, 40))
    console.log(`   turnos=${r.turnos} ventas=${r.ventas} fichas=${r.fichas} | ${r.rubro} / ${r.nombre}`);
  if (conRef.length > 40) console.log(`   ... y ${conRef.length - 40} más`);

  console.log("\n=== INSUMOS por sucursal ===");
  for (const r of await q(
    `select sucursal_id s, tipo, count(*)::int n from insumos group by 1,2 order by 1,2`,
  ))
    console.log(`  ${r.s} | tipo=${r.tipo}: ${r.n}`);

  console.log("\n=== Insumos de YB (todos) ===");
  const ins = await q(
    `select i.id, i.nombre, i.tipo, i.unidad_medida u, i.precio_venta pv, i.activo,
            coalesce((select sum(cantidad) from stock_sucursal ssx where ssx.insumo_id=i.id and ssx.sucursal_id='${YB}'),0) stock,
            (select count(*)::int from movimientos_stock ms where ms.insumo_id=i.id) movs,
            (select count(*)::int from ingreso_lineas il where il.insumo_id=i.id) ventas,
            (select count(*)::int from recetas r where r.insumo_id=i.id) recetas
       from insumos i where i.sucursal_id='${YB}' order by i.tipo, i.nombre`,
  );
  console.log(`  total: ${ins.length}`);
  for (const r of ins)
    console.log(
      `   [${r.tipo}] ${r.nombre} | pv=${r.pv ?? "-"} stock=${r.stock} movs=${r.movs} ventas=${r.ventas} recetas=${r.recetas} activo=${r.activo}`,
    );

  console.log("\n=== RECETAS por sucursal ===");
  for (const r of await q(`select sucursal_id s, count(*)::int n from recetas group by 1 order by 1`))
    console.log(`  ${r.s}: ${r.n}`);

  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
