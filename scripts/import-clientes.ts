/**
 * Carga idempotente de clientes de una sucursal desde el Excel exportado
 * (clientes_*_LIMPIO.xlsx descomprimido). Dedup por telefono_e164 (índice único):
 *   - Si el e164 ya existe en la DB (ej. cliente que también va a la otra sucursal),
 *     NO se duplica: se reusa el cliente y se le agrega la membresía a esta sucursal.
 *   - Si el e164 es nuevo, se crea el cliente + membresía.
 *   - Sin teléfono / no normaliza: se crea igual con e164 NULL (no se puede deduplicar).
 *
 * NO borra nada. Corre dry-run salvo --commit.
 * Uso: npx tsx scripts/import-clientes.ts <dirXlsxDescomprimido> <sucursalId> [--commit]
 */
import "../envConfig";
import fs from "node:fs";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  clientes as clientesTable,
  clienteSucursal as clienteSucursalTable,
} from "../src/lib/db/schema";
import { tryNormalizarTelefonoAR } from "../src/lib/phone";

// --- parser xlsx (igual que import-yb.ts) ---
function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
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

async function chunked<T>(rows: T[], fn: (b: T[]) => Promise<unknown>, size = 400) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const [dir, sucursalId] = args;
  const commit = process.argv.includes("--commit");
  if (!dir || !sucursalId) {
    console.error("Uso: import-clientes.ts <dir> <sucursalId> [--commit]");
    process.exit(1);
  }

  const db = getDb();

  // Índice e164 -> clienteId de lo que YA existe en la DB.
  const existentes = await db
    .select({ id: clientesTable.id, e164: clientesTable.telefonoE164 })
    .from(clientesTable);
  const e164ToId = new Map<string, string>();
  for (const r of existentes) if (r.e164) e164ToId.set(r.e164, r.id);

  const rows = parseSheet(dir).slice(1);
  const nuevosClientes: (typeof clientesTable.$inferInsert)[] = [];
  const membresias = new Set<string>(); // clienteId a asociar a la sucursal
  const batchE164 = new Map<string, string>();
  let reusados = 0, nuevosConTel = 0, sinTel = 0, dupBatch = 0;

  for (const r of rows) {
    const nombre = (r[0] ?? "").trim();
    if (!nombre) continue;
    const rawTel = (r[1] ?? "").trim();
    const telPresente = rawTel !== "" && rawTel !== "---";
    const e164 = telPresente ? tryNormalizarTelefonoAR(rawTel) : null;
    const estado = (r[6] ?? "").trim().toLowerCase();
    const activo = estado ? estado === "activo" : true;

    if (e164 && e164ToId.has(e164)) {
      // Ya existe (otra sucursal o corrida previa): solo membresía.
      membresias.add(e164ToId.get(e164)!);
      reusados++;
      continue;
    }
    if (e164 && batchE164.has(e164)) {
      membresias.add(batchE164.get(e164)!); // misma persona repetida en el archivo
      dupBatch++;
      continue;
    }
    const id = crypto.randomUUID();
    nuevosClientes.push({
      id,
      nombre,
      telefono: telPresente ? rawTel : null,
      telefonoE164: e164 ?? null,
      email: null,
      activo,
      saldoCc: 0,
    });
    membresias.add(id);
    if (e164) {
      batchE164.set(e164, id);
      nuevosConTel++;
    } else {
      sinTel++;
    }
  }

  console.log(`=== IMPORT CLIENTES -> sucursal ${sucursalId} (sin PII) ===`);
  console.log(`  Filas en Excel:            ${rows.length}`);
  console.log(`  Clientes NUEVOS a crear:   ${nuevosClientes.length} (con tel ${nuevosConTel}, sin tel ${sinTel})`);
  console.log(`  Reusados (ya existían):    ${reusados} -> solo se les agrega membresía`);
  console.log(`  Duplicados dentro del Excel: ${dupBatch}`);
  console.log(`  Membresías a asegurar:     ${membresias.size}`);
  console.log(`  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);

  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    if (nuevosClientes.length) await chunked(nuevosClientes, (b) => tx.insert(clientesTable).values(b));
    const membRows = [...membresias].map((clienteId) => ({
      id: crypto.randomUUID(),
      clienteId,
      sucursalId,
    }));
    await chunked(membRows, (b) =>
      tx.insert(clienteSucursalTable).values(b).onConflictDoNothing(),
    );
  });

  console.log("\n✔ Clientes de la sucursal cargados (idempotente).");
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
