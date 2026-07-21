/**
 * Reemplaza los servicios de Malala Yerba Buena (seed-000002) con la lista de
 * precios de julio 2026 (scripts/data/yb-lista-julio26.json, parseada del xlsx
 * "lista final precios + servicios julio 26").
 *
 * Criterios acordados:
 *  - `rubro` = Subrubro de la planilla (más granular que el Rubro).
 *  - Se cargan los rubros de servicio (Peluqueria..Corporal) + Gift Cards.
 *  - Se OMITEN los productos de stock (VPC/VDJ) y "Otros Ingresos" (COM/MOV).
 *  - Se corrigen 6 filas con lista/efectivo invertidos (efectivo = lista*1.25).
 *  - Filas sin precio ("Pendiente"/"no tenemos") entran en 0 y `activo=false`.
 *  - La duración se copia del servicio actual de YB cuyo nombre más se parezca.
 *  - `id` = "yb-<Cod_Servicio>" para que la carga sea idempotente y trazable.
 *
 * Borra los servicios cuya membresía es de YB. Aborta si alguno está
 * referenciado por turnos/ventas/fichas (habría que desactivarlo, no borrarlo).
 * NO toca clientes, empleadas, horarios ni la sucursal Centro.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/import-yb-julio26.ts [--commit]
 */
import "../envConfig";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  servicios as serviciosTable,
  servicioSucursal as servicioSucursalTable,
} from "../src/lib/db/schema";

const YB_ID = "seed-000002";

/** Rubros de la planilla que se cargan como servicios. */
const RUBROS_SERVICIO = new Set([
  "Peluqueria",
  "Nails",
  "Cejas y pestañas",
  "Facial",
  "Masajes",
  "Corporal",
  "Gift Cards",
]);

type Fila = {
  cod: string;
  nombre: string;
  rubro: string;
  subrubro: string;
  precioLista: number | null;
  precioEfectivo: number | null;
  notaPrecio: string | null;
};

/** Normaliza para comparar nombres: sin acentos, sin puntuación, minúsculas. */
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
 * Duración declarada en el propio nombre ("30 min", "(1hora)", "1 h").
 * Tiene prioridad sobre el match por similitud: sin esto "Masaje relajante
 * 60 min" hereda los 30 min de "Masajes Relajantes 30 min".
 */
function duracionDelNombre(nombre: string): number | null {
  const n = nombre.toLowerCase();
  const min = n.match(/(\d+)\s*min/);
  if (min) return Number(min[1]);
  const hs = n.match(/(\d+)\s*h(?:ora)?s?\b/);
  if (hs) return Number(hs[1]) * 60;
  return null;
}

async function main() {
  const commit = process.argv.includes("--commit");
  const db = getDb();

  const dataPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "data",
    "yb-lista-julio26.json",
  );
  const todas = JSON.parse(readFileSync(dataPath, "utf8")) as Fila[];

  const omitidas = todas.filter((f) => !RUBROS_SERVICIO.has(f.rubro));
  const filas = todas.filter((f) => RUBROS_SERVICIO.has(f.rubro));

  // --- Normalización de precios ---
  const invertidas: Fila[] = [];
  const sinPrecio: Fila[] = [];
  const nuevos = filas.map((f) => {
    let lista = f.precioLista;
    let efectivo = f.precioEfectivo;
    if (lista === null || efectivo === null) {
      sinPrecio.push(f);
      lista = 0;
      efectivo = 0;
    } else if (efectivo > lista) {
      // Columnas invertidas en la planilla (ratio exacto 1.25 = 1/0.8).
      invertidas.push(f);
      [lista, efectivo] = [efectivo, lista];
    }
    return {
      id: `yb-${f.cod}`,
      cod: f.cod,
      rubro: f.subrubro,
      nombre: f.nombre,
      precioLista: lista,
      precioEfectivo: efectivo,
      comisionDefaultPct: 0,
      activo: f.precioLista !== null,
      esPromo: false,
      duracionMin: null as number | null,
    };
  });

  // --- Duración: copiada del servicio actual de YB con el nombre más parecido ---
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

  const candidatos = actuales
    .filter((a) => a.duracionMin != null)
    .map((a) => ({ nombre: a.nombre, norm: norm(a.nombre), dur: a.duracionMin! }));

  const matches: Array<{ nuevo: string; viejo: string; dur: number; sim: number }> = [];
  const porNombre: Array<{ nuevo: string; dur: number }> = [];
  for (const n of nuevos) {
    const propia = duracionDelNombre(n.nombre);
    if (propia !== null) {
      n.duracionMin = propia;
      porNombre.push({ nuevo: n.nombre, dur: propia });
      continue;
    }
    const nn = norm(n.nombre);
    let mejor: (typeof candidatos)[number] | null = null;
    let mejorSim = 0;
    for (const c of candidatos) {
      // Un candidato que declara su propia duración ("... 30 min") no sirve de
      // referencia para un servicio que no la declara.
      if (duracionDelNombre(c.nombre) !== null) continue;
      const s = similitud(nn, c.norm);
      if (s > mejorSim) {
        mejorSim = s;
        mejor = c;
      }
    }
    if (mejor && mejorSim >= UMBRAL_SIMILITUD) {
      n.duracionMin = mejor.dur;
      matches.push({ nuevo: n.nombre, viejo: mejor.nombre, dur: mejor.dur, sim: mejorSim });
    }
  }

  // --- Chequeo de referencias sobre los servicios actuales de YB ---
  const idsActuales = actuales.map((a) => a.id);
  let referenciados: Array<{ id: string; nombre: string; n: number }> = [];
  if (idsActuales.length) {
    const lista = idsActuales.map((i) => `'${i.replace(/'/g, "''")}'`).join(",");
    referenciados = (await db.execute(
      sql.raw(`
        select sv.id, sv.nombre,
          (select count(*) from turnos t where t.servicio_id = sv.id)
        + (select count(*) from ingreso_lineas il where il.servicio_id = sv.id or il.promo_servicio_id = sv.id)
        + (select count(*) from cliente_ficha_registros f where f.servicio_id = sv.id) as n
        from servicios sv where sv.id in (${lista})`),
    )) as unknown as Array<{ id: string; nombre: string; n: number }>;
    referenciados = referenciados.filter((r) => Number(r.n) > 0);
  }

  // --- Reporte ---
  console.log("=== IMPORT YERBA BUENA · lista julio 2026 ===");
  console.log(`  Filas en la planilla: ${todas.length}`);
  console.log(`  A cargar como servicios: ${nuevos.length}`);
  console.log(`  Omitidas (stock / otros ingresos): ${omitidas.length}`);
  const porRubro = new Map<string, number>();
  for (const o of omitidas) porRubro.set(o.rubro, (porRubro.get(o.rubro) ?? 0) + 1);
  for (const [r, n] of porRubro) console.log(`      - ${r}: ${n}`);

  console.log(`\n  Rubros resultantes (${new Set(nuevos.map((n) => n.rubro)).size}):`);
  const cuenta = new Map<string, number>();
  for (const n of nuevos) cuenta.set(n.rubro, (cuenta.get(n.rubro) ?? 0) + 1);
  for (const [r, n] of [...cuenta].sort((a, b) => b[1] - a[1]))
    console.log(`      ${String(n).padStart(3)}  ${r}`);

  console.log(`\n  Precios invertidos corregidos: ${invertidas.length}`);
  for (const f of invertidas)
    console.log(`      ${f.cod} ${f.nombre}: lista ${f.precioEfectivo} / efectivo ${f.precioLista}`);

  console.log(`\n  Sin precio → 0 e inactivos: ${sinPrecio.length}`);
  for (const f of sinPrecio) console.log(`      ${f.cod} ${f.nombre} ("${f.notaPrecio}")`);

  const conDur = matches.length + porNombre.length;
  console.log(`\n  Duración leída del propio nombre: ${porNombre.length}`);
  for (const m of porNombre) console.log(`      ${m.dur}min · "${m.nuevo}"`);
  console.log(
    `\n  Duración copiada por similitud: ${matches.length} (total con duración: ${conDur}/${nuevos.length}, resto null)`,
  );
  for (const m of matches.sort((a, b) => a.sim - b.sim))
    console.log(
      `      ${m.sim.toFixed(2)} ${m.dur}min · "${m.nuevo}"  ←  "${m.viejo}"`,
    );

  console.log(`\n  Servicios actuales de YB a borrar: ${idsActuales.length}`);
  if (referenciados.length) {
    console.log(`\n  ⚠ ${referenciados.length} servicios actuales TIENEN referencias:`);
    for (const r of referenciados) console.log(`      ${r.nombre} (${r.n} refs)`);
    console.log("  Abortado: habría que desactivarlos en vez de borrarlos.");
    await getSqlClient().end({ timeout: 5 });
    process.exit(1);
  }

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    if (idsActuales.length)
      await tx.delete(serviciosTable).where(inArray(serviciosTable.id, idsActuales));

    for (let i = 0; i < nuevos.length; i += 400) {
      const lote = nuevos.slice(i, i + 400);
      await tx.insert(serviciosTable).values(
        lote.map(({ cod: _cod, ...s }) => s),
      );
      await tx.insert(servicioSucursalTable).values(
        lote.map((s) => ({
          id: crypto.randomUUID(),
          servicioId: s.id,
          sucursalId: YB_ID,
        })),
      );
    }
  });

  console.log(
    `\n✔ Yerba Buena: ${idsActuales.length} servicios reemplazados por ${nuevos.length}.`,
  );
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
