/**
 * Carga las duraciones de los servicios de Malala Yerba Buena (seed-000002)
 * desde "Tiempos_Servicios.xlsx", la planilla donde el salón anotó cuánto tarda
 * cada trabajo.
 *
 * Sin duración un servicio NO se puede reservar online: el motor de turnos la
 * usa para saber cuánto ocupa el slot. Después de cargar la planilla de precios
 * quedaron ~103 servicios sin ese dato.
 *
 * La planilla trae 73 tiempos con nombres GENÉRICOS ("Color global", "Gloss")
 * mientras que el catálogo los tiene abiertos por marca y por largo de pelo
 * ("Color global Loreal 1", "Color global Question 3"). Por eso el cruce es por
 * parecido de nombre: para cada servicio se busca el tiempo más parecido,
 * probando también sin el sufijo de largo de pelo. Todo lo que no llega al
 * umbral queda sin tocar y se lista.
 *
 * Las duraciones de la planilla PISAN a las que había: las anteriores se
 * heredaron por similitud de los servicios viejos, ésta es la respuesta directa
 * del salón. Ojo con los masajes: "Masajes Relajantes 30 min" dura 40 minutos
 * (incluye preparación), así que leer el nombre daba mal.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/import-tiempos-yb.ts [--commit] [--xlsx <ruta>] [--umbral 0.65]
 */
import "../envConfig";
import { eq, inArray } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  servicioSucursal as servicioSucursalTable,
  servicios as serviciosTable,
} from "../src/lib/db/schema";
import { leerXlsx } from "./lib/xlsx";
import { norm, similitud, sinTier } from "./lib/texto";

const YB_ID = "seed-000002";
const XLSX_DEFAULT = "C:/Users/LBonilla-DIA/Downloads/Tiempos_Servicios.xlsx";
const UMBRAL_DEFAULT = 0.65;

/** "1 hora y 30 minutos" → 90. Devuelve null si no se entiende. */
function aMinutos(texto: string): number | null {
  const t = texto.toLowerCase();
  const horas = /(\d+)\s*h(?:ora)?s?/.exec(t);
  const minutos = /(\d+)\s*min/.exec(t);
  const total = (horas ? Number(horas[1]) * 60 : 0) + (minutos ? Number(minutos[1]) : 0);
  return total > 0 ? total : null;
}

/**
 * Duración que declara el propio nombre ("Masaje relajante 60 min", "1 h").
 * Sirve para no cruzar el servicio de 60 minutos con el tiempo del de 30, que
 * por parecido de texto gana igual.
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
 * Casos donde el nombre genérico de la planilla le gana por parecido al
 * específico, y hay que forzar el correcto. Clave = código del servicio.
 */
const FORZADOS: Record<string, string> = {
  // "Lifting de Pestañas (coreano)" se parece más a "Lifting de Pestañas" que a
  // "Lifting Coreano", pero el coreano es el que corresponde (y dura el doble).
  CEP106: "Lifting Coreano",
  CEP110: "Lifting Coreano",
  // "Laminado" a secas se parece peligrosamente a "Peinado"; es de cejas.
  CEP101: "Laminado de cejas",
  // La línea Igora quedó abajo del umbral sólo porque el nombre de la marca
  // alarga el texto; son el color raíz y el color global de siempre.
  PEL464: "Color raiz",
  PEL465: "Color global",
  PEL466: "Color global",
  PEL467: "Color global",
  PEL615: "Reflejos + Corte + Nutricion reparadora + Bushing + Planchita",
  // Ultimate Repair es la nutrición intensa de Wella.
  PEL324: "Nutrición Intensa Wella",
  PEL326: "Nutrición Intensa Wella",
  PEL327: "Nutrición Intensa Wella",
};

async function main() {
  const commit = process.argv.includes("--commit");
  const arg = (n: string) => {
    const i = process.argv.indexOf(n);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const umbral = Number(arg("--umbral") ?? UMBRAL_DEFAULT);

  const hoja = leerXlsx(arg("--xlsx") ?? XLSX_DEFAULT).get("Servicios y Tiempos") ?? [];
  const tiempos: Array<{ categoria: string; nombre: string; min: number; norm: string }> = [];
  const ilegibles: string[] = [];
  for (const f of hoja.slice(1)) {
    const nombre = (f?.[1] ?? "").trim();
    const dur = (f?.[2] ?? "").trim();
    if (!nombre || !dur) continue;
    const min = aMinutos(dur);
    if (min == null) {
      ilegibles.push(`${nombre} → "${dur}"`);
      continue;
    }
    tiempos.push({ categoria: (f?.[0] ?? "").trim(), nombre, min, norm: norm(nombre) });
  }

  const db = getDb();
  const servicios = await db
    .select({
      id: serviciosTable.id,
      codigo: serviciosTable.codigo,
      nombre: serviciosTable.nombre,
      rubro: serviciosTable.rubro,
      duracionMin: serviciosTable.duracionMin,
      activo: serviciosTable.activo,
    })
    .from(serviciosTable)
    .innerJoin(
      servicioSucursalTable,
      eq(servicioSucursalTable.servicioId, serviciosTable.id),
    )
    .where(eq(servicioSucursalTable.sucursalId, YB_ID));

  /** Mejor tiempo para un servicio, probando también sin el sufijo de tier. */
  function mejor(servicio: { codigo: string | null; nombre: string }) {
    const forzado = servicio.codigo ? FORZADOS[servicio.codigo] : undefined;
    if (forzado) {
      const t = tiempos.find((x) => x.nombre === forzado);
      if (t) return { ...t, sc: 1 };
    }
    // Si el nombre del servicio dice cuánto dura, el candidato tiene que decir
    // lo mismo: "Masaje relajante 60 min" no puede tomar el tiempo del de 30.
    const propia = duracionDelNombre(servicio.nombre);
    let elegido: (typeof tiempos)[number] | null = null;
    let sc = 0;
    for (const variante of [servicio.nombre, sinTier(servicio.nombre) ?? servicio.nombre]) {
      const n = norm(variante);
      for (const t of tiempos) {
        const suya = duracionDelNombre(t.nombre);
        if (propia != null && suya != null && propia !== suya) continue;
        const s = similitud(n, t.norm);
        if (s > sc) {
          sc = s;
          elegido = t;
        }
      }
    }
    return elegido && sc >= umbral ? { ...elegido, sc } : null;
  }

  const cambios: Array<{
    id: string;
    codigo: string | null;
    nombre: string;
    antes: number | null;
    ahora: number;
    desde: string;
    sc: number;
  }> = [];
  const sinMatch: typeof servicios = [];

  for (const s of servicios) {
    const m = mejor(s);
    if (!m) {
      sinMatch.push(s);
      continue;
    }
    if (s.duracionMin === m.min) continue;
    cambios.push({
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      antes: s.duracionMin,
      ahora: m.min,
      desde: m.nombre,
      sc: m.sc,
    });
  }

  // ---- Reporte ----
  console.log("=== TIEMPOS DE SERVICIOS · YERBA BUENA ===\n");
  console.log(`  Tiempos en la planilla: ${tiempos.length}`);
  if (ilegibles.length) {
    console.log(`  ⚠ Duraciones que no pude interpretar: ${ilegibles.length}`);
    for (const i of ilegibles) console.log(`      ${i}`);
  }
  console.log(`  Servicios de YB: ${servicios.length}`);
  console.log(`      con duración antes: ${servicios.filter((s) => s.duracionMin != null).length}`);
  console.log(`      a cambiar: ${cambios.length}`);
  console.log(`      sin match (quedan como están): ${sinMatch.length}\n`);

  const nuevos = cambios.filter((c) => c.antes == null);
  const pisados = cambios.filter((c) => c.antes != null);

  console.log(`  Servicios que pasan a TENER duración: ${nuevos.length}`);
  for (const c of nuevos.sort((a, b) => a.sc - b.sc))
    console.log(
      `      ${c.sc.toFixed(2)} ${String(c.ahora).padStart(3)}min  ${(c.codigo ?? "").padEnd(7)} ${c.nombre.slice(0, 42).padEnd(42)} ←  ${c.desde}`,
    );

  console.log(`\n  Servicios cuya duración CAMBIA: ${pisados.length}`);
  for (const c of pisados.sort((a, b) => a.sc - b.sc))
    console.log(
      `      ${c.sc.toFixed(2)} ${String(c.antes).padStart(3)}→${String(c.ahora).padStart(3)}min  ${(c.codigo ?? "").padEnd(7)} ${c.nombre.slice(0, 42).padEnd(42)} ←  ${c.desde}`,
    );

  const sinMatchActivos = sinMatch.filter((s) => s.activo && s.duracionMin == null);
  console.log(
    `\n  ⚠ Siguen SIN duración (activos, no se pueden reservar): ${sinMatchActivos.length}`,
  );
  for (const s of sinMatchActivos)
    console.log(`      ${(s.codigo ?? "").padEnd(7)} ${s.nombre}`);

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    // Se agrupan por duración para no hacer un UPDATE por servicio.
    const porDuracion = new Map<number, string[]>();
    for (const c of cambios) {
      if (!porDuracion.has(c.ahora)) porDuracion.set(c.ahora, []);
      porDuracion.get(c.ahora)!.push(c.id);
    }
    for (const [min, ids] of porDuracion)
      await tx
        .update(serviciosTable)
        .set({ duracionMin: min })
        .where(inArray(serviciosTable.id, ids));
  });

  console.log(`\n✔ Actualizados ${cambios.length} servicios.`);
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
