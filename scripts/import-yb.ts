/**
 * Carga REAL de la sucursal Malala Yerba Buena (servicios + clientes) a partir de
 * los Excel exportados. Hace un "reset total" de la data de prueba conservando
 * SOLO las 2 sucursales y los usuarios de login (profiles), renombra la sucursal
 * placeholder "Malala Barrio Norte" -> "Malala Yerba Buena" y carga los datos.
 *
 * Por seguridad corre en DRY-RUN salvo que se pase --commit.
 *
 * Uso:
 *   npx tsx scripts/import-yb.ts <dirServiciosXlsxDescomprimido> <dirClientesXlsxDescomprimido> [--commit]
 *
 * Los dir* son carpetas con la estructura de un .xlsx descomprimido (xl/worksheets/sheet1.xml, etc.).
 */
import "../envConfig";
import fs from "node:fs";
import { sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  sucursales,
  servicios as serviciosTable,
  servicioSucursal as servicioSucursalTable,
  clientes as clientesTable,
  clienteSucursal as clienteSucursalTable,
} from "../src/lib/db/schema";
import { tryNormalizarTelefonoAR } from "../src/lib/phone";

const YB_SUCURSAL_ID = "seed-000002"; // placeholder "Malala Barrio Norte"

// ---------------------------------------------------------------------------
// Parser mínimo de .xlsx descomprimido (sheet1.xml + sharedStrings.xml)
// ---------------------------------------------------------------------------
function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}
function parseShared(dir: string): string[] {
  const p = `${dir}/xl/sharedStrings.xml`;
  if (!fs.existsSync(p)) return [];
  const xml = fs.readFileSync(p, "utf8");
  const out: string[] = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    let t = "";
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(m[1]))) t += tm[1];
    out.push(decode(t));
  }
  return out;
}
function colToNum(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function parseSheet(dir: string): string[][] {
  const shared = parseShared(dir);
  const xml = fs.readFileSync(`${dir}/xl/worksheets/sheet1.xml`, "utf8");
  const rows: string[][] = [];
  const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const cells: Record<number, string> = {};
    const cellRe =
      /<c[^>]*r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>|<c[^>]*r="([A-Z]+)\d+"([^>]*)\/>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[2]))) {
      const col = cm[1] ?? cm[4];
      const attrs = (cm[2] ?? cm[5]) || "";
      const body = cm[3] ?? "";
      let val = "";
      const isStr = /t="s"/.test(attrs);
      const isInline = /t="inlineStr"/.test(attrs);
      const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
      if (isInline) {
        const tM = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
        val = tM ? decode(tM[1]) : "";
      } else if (vM) {
        val = isStr ? shared[+vM[1]] : decode(vM[1]);
      }
      cells[colToNum(col)] = val;
    }
    const maxCol = Math.max(-1, ...Object.keys(cells).map(Number));
    const arr: string[] = [];
    for (let i = 0; i <= maxCol; i++) arr.push(cells[i] ?? "");
    rows.push(arr);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

// ---------------------------------------------------------------------------
// Construcción de filas
// ---------------------------------------------------------------------------
type ServicioRow = typeof serviciosTable.$inferInsert;
type ClienteRow = typeof clientesTable.$inferInsert;

function buildServicios(dir: string): ServicioRow[] {
  const rows = parseSheet(dir).slice(1); // saltar encabezado
  const out: ServicioRow[] = [];
  for (const r of rows) {
    const nombre = (r[2] ?? "").trim();
    if (!nombre) continue;
    const rubro = (r[1] ?? "").trim().toUpperCase() || "SIN RUBRO";
    const precio = Number.parseFloat(r[3] ?? "0");
    const precioLista = Number.isFinite(precio) ? precio : 0;
    out.push({
      id: crypto.randomUUID(),
      rubro,
      nombre,
      precioLista, // = precio tarjeta / lista (valor del Excel)
      precioEfectivo: precioLista, // sin dato de contado -> igualamos por ahora
      comisionDefaultPct: 0,
      activo: true,
      esPromo: false,
    });
  }
  return out;
}

function buildClientes(dir: string): {
  clientes: ClienteRow[];
  stats: { total: number; conE164: number; sinTel: number; e164Dedup: number };
} {
  const rows = parseSheet(dir).slice(1);
  const usedE164 = new Set<string>();
  const out: ClienteRow[] = [];
  let conE164 = 0;
  let sinTel = 0;
  let e164Dedup = 0;
  for (const r of rows) {
    const nombre = (r[0] ?? "").trim();
    if (!nombre) continue;
    const rawTel = (r[1] ?? "").trim();
    const telPresente = rawTel !== "" && rawTel !== "---";
    const e164 = telPresente ? tryNormalizarTelefonoAR(rawTel) : null;
    let telefonoE164: string | null = null;
    if (e164) {
      if (usedE164.has(e164)) {
        e164Dedup++; // otra persona con el mismo número -> no repetimos el e164 (índice único)
      } else {
        usedE164.add(e164);
        telefonoE164 = e164;
        conE164++;
      }
    }
    if (!telPresente) sinTel++;
    const estado = (r[6] ?? "").trim().toLowerCase();
    out.push({
      id: crypto.randomUUID(),
      nombre,
      telefono: telPresente ? rawTel : null,
      telefonoE164,
      email: null,
      activo: estado ? estado === "activo" : true,
      saldoCc: 0,
    });
  }
  return { clientes: out, stats: { total: out.length, conE164, sinTel, e164Dedup } };
}

async function chunkedInsert<T>(rows: T[], insertFn: (batch: T[]) => Promise<unknown>) {
  const SIZE = 400;
  for (let i = 0; i < rows.length; i += SIZE) {
    await insertFn(rows.slice(i, i + SIZE));
  }
}

// Tablas de la app a limpiar (todas menos sucursales, profiles y empleados;
// empleados se borra aparte tras nulear profiles.empleado_id). CASCADE limpia
// también las tablas puente y auxiliares no listadas.
const TABLES_TO_TRUNCATE = [
  "turno_eventos",
  "turnos",
  "anticipos",
  "liquidacion_lineas",
  "liquidaciones",
  "movimientos_cc",
  "movimientos_bancarios",
  "cierre_caja_cuentas",
  "apertura_caja_cuentas",
  "aperturas_caja",
  "cierres_caja",
  "ingreso_lineas",
  "ingresos",
  "egresos",
  "movimientos_stock",
  "stock_sucursal",
  "recetas",
  "promocion_items",
  "profesionales_servicios",
  "profesionales_horarios",
  "profesionales_agenda",
  "servicios_horarios",
  "horarios_sucursal",
  "cuentas_bancarias",
  "motivos_descuento",
  "rubros_gasto",
  "medios_pago",
  "insumos",
  "servicios",
  "cliente_ficha_registros",
  "clientes",
  "proveedores",
  "whatsapp_envios",
  "integraciones_manychat",
  "push_notification_queue",
  "push_subscriptions",
];

async function main() {
  const [dirServ, dirCli] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const commit = process.argv.includes("--commit");
  if (!dirServ || !dirCli) {
    console.error("Faltan rutas: <dirServicios> <dirClientes> [--commit]");
    process.exit(1);
  }

  const servicios = buildServicios(dirServ);
  const { clientes, stats } = buildClientes(dirCli);

  console.log("=== RESUMEN DE LO QUE SE VA A CARGAR (sin PII) ===");
  console.log(`  Servicios: ${servicios.length}`);
  const rubroCount: Record<string, number> = {};
  for (const s of servicios) rubroCount[s.rubro] = (rubroCount[s.rubro] ?? 0) + 1;
  console.log(`  Rubros distintos: ${Object.keys(rubroCount).length}`);
  const precio0 = servicios.filter((s) => s.precioLista === 0).length;
  console.log(`  Servicios con precio 0: ${precio0}`);
  console.log(
    `  Clientes: ${stats.total} | con e164: ${stats.conE164} | sin teléfono: ${stats.sinTel} | e164 duplicados omitidos: ${stats.e164Dedup}`,
  );
  console.log(`  Modo: ${commit ? "COMMIT (escribe en la base)" : "DRY-RUN (no escribe)"}`);

  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Volvé a correr con --commit para aplicar.");
    process.exit(0);
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    // 1) Reset de data de prueba conservando sucursales + profiles.
    await tx.execute(sql.raw(`UPDATE profiles SET empleado_id = NULL`));
    const list = TABLES_TO_TRUNCATE.map((t) => `"${t}"`).join(", ");
    await tx.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`));
    await tx.execute(sql.raw(`DELETE FROM empleados`));

    // 2) Renombrar placeholder -> Yerba Buena.
    await tx
      .update(sucursales)
      .set({ nombre: "Malala Yerba Buena", slug: "yerba-buena" })
      .where(sql`${sucursales.id} = ${YB_SUCURSAL_ID}`);

    // 3) Insertar servicios + membresía a YB.
    await chunkedInsert(servicios, (b) => tx.insert(serviciosTable).values(b));
    const servMembership = servicios.map((s) => ({
      id: crypto.randomUUID(),
      servicioId: s.id!,
      sucursalId: YB_SUCURSAL_ID,
    }));
    await chunkedInsert(servMembership, (b) => tx.insert(servicioSucursalTable).values(b));

    // 4) Insertar clientes + membresía a YB.
    await chunkedInsert(clientes, (b) => tx.insert(clientesTable).values(b));
    const cliMembership = clientes.map((c) => ({
      id: crypto.randomUUID(),
      clienteId: c.id!,
      sucursalId: YB_SUCURSAL_ID,
    }));
    await chunkedInsert(cliMembership, (b) => tx.insert(clienteSucursalTable).values(b));
  });

  console.log("\n✔ Carga aplicada en una transacción.");
  process.exit(0);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end({ timeout: 5 });
  });
