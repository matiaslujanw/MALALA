/**
 * Verificación SOLO LECTURA post-carga (Centro + Yerba Buena). Sin PII.
 * Uso: npx tsx scripts/diag-import-yb.ts
 */
import "../envConfig";
import { sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";

async function main() {
  const db = getDb();
  const q = async (s: string) =>
    (await db.execute(sql.raw(s))) as unknown as Array<Record<string, unknown>>;

  console.log("=== SUCURSALES ===");
  for (const s of await q(
    `select id, nombre, slug, direccion, rating, reviews from sucursales order by id`,
  ))
    console.log(`  ${s.id} | "${s.nombre}" | ${s.slug} | ${s.direccion ?? "-"} | rating=${s.rating ?? "-"} reviews=${s.reviews ?? "-"}`);

  console.log("\n=== TOTALES ===");
  for (const t of ["servicios", "clientes", "empleados", "horarios_sucursal"])
    console.log(`  ${t}: ${(await q(`select count(*)::int n from "${t}"`))[0].n}`);

  console.log("\n=== MEMBRESÍAS servicio_sucursal ===");
  for (const r of await q(
    `select sucursal_id s, count(*)::int n from servicio_sucursal group by 1 order by 1`,
  ))
    console.log(`  ${r.s}: ${r.n}`);
  console.log("=== MEMBRESÍAS cliente_sucursal ===");
  for (const r of await q(
    `select sucursal_id s, count(*)::int n from cliente_sucursal group by 1 order by 1`,
  ))
    console.log(`  ${r.s}: ${r.n}`);

  console.log("\n=== EMPLEADOS por sucursal ===");
  for (const r of await q(
    `select sucursal_principal_id s, count(*)::int n from empleados group by 1 order by 1`,
  ))
    console.log(`  ${r.s}: ${r.n}`);

  console.log("\n=== HORARIOS Centro ===");
  for (const r of await q(
    `select dia_semana d, apertura, cierre from horarios_sucursal where sucursal_id='seed-000001' order by dia_semana`,
  ))
    console.log(`  día ${r.d}: ${r.apertura}-${r.cierre}`);

  console.log("\n=== Servicios Centro por rubro / duración cargada ===");
  for (const r of await q(
    `select rubro, count(*)::int n, count(duracion_min)::int con_dur from servicios s
       join servicio_sucursal ss on ss.servicio_id=s.id and ss.sucursal_id='seed-000001'
       group by rubro order by n desc`,
  ))
    console.log(`  ${String(r.n).padStart(3)} (${r.con_dur} c/dur)  ${r.rubro}`);

  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
