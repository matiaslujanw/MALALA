/**
 * Carga en el sistema las gift cards de Malala Yerba Buena que ya estaban
 * vendidas y siguen dando vueltas sin canjearse.
 *
 * POR QUÉ HACE FALTA: el control de códigos nuevo funciona contra la lista de
 * tarjetas emitidas. El día que se prende, el 100% de las tarjetas que la gente
 * tiene en la cartera son las viejas — si la lista arranca vacía, el control no
 * sirve para nadie durante meses y encima el sistema le va a decir "no existe" a
 * tarjetas legítimas.
 *
 * DE DÓNDE SALEN LOS DATOS: de una lista que arma el salón, no de la base. Miré
 * la tabla `ingresos` y no hay nada que migrar: tiene una sola fila en toda la
 * base y es de Centro, sin líneas de gift card. O sea que las tarjetas viejas
 * nunca se cargaron en el sistema; existen en papel. Por eso la fuente es
 * scripts/data/gift-cards-viejas-yb.json, que se completa a mano con lo que
 * manden y queda versionado como constancia.
 *
 * NO EMITE MOVIMIENTO BANCARIO. La plata de estas tarjetas entró hace semanas y
 * ya está contada donde corresponda; generar un ingreso hoy inflaría el saldo de
 * la cuenta y rompería el arqueo. Estas filas sólo existen para poder canjear y
 * controlar el código.
 *
 * QUEDAN MARCADAS `emitida_pre_sistema = true`, y eso importa: su venta ya se
 * contó como facturación en su momento, así que cuando se canjeen el servicio va
 * a facturar de nuevo. La marca es lo que permite mostrar ese monto aparte para
 * descontarlo, en vez de tener que acordarse.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/import-gift-cards-viejas-yb.ts [--commit] [--json <ruta>]
 */
import "../envConfig";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  giftCardMovimientos as giftCardMovimientosTable,
  giftCards as giftCardsTable,
  profiles as profilesTable,
} from "../src/lib/db/schema";

const YB_ID = "seed-000002";
const USUARIO_EMAIL = "admin.yb@malala.com";
const JSON_DEFAULT = "scripts/data/gift-cards-viejas-yb.json";

interface Fila {
  codigo?: string;
  importe?: number;
  fechaVenta?: string | null;
  venceEl?: string | null;
  compradora?: string | null;
  beneficiaria?: string | null;
  usada?: boolean;
  observacion?: string | null;
}

function limpio(s: unknown): string | null {
  const t = String(s ?? "").trim();
  return t ? t : null;
}

async function main() {
  const commit = process.argv.includes("--commit");
  const i = process.argv.indexOf("--json");
  const ruta = i >= 0 ? process.argv[i + 1] : JSON_DEFAULT;

  const crudo = JSON.parse(readFileSync(ruta, "utf8")) as Fila[];
  // Las filas de ejemplo de la plantilla se ignoran solas.
  const filas = crudo.filter(
    (f) => f.codigo && !String(f.codigo).includes("EJEMPLO"),
  );

  const db = getDb();
  const [usuario] = await db
    .select({ id: profilesTable.userId })
    .from(profilesTable)
    .where(eq(profilesTable.email, USUARIO_EMAIL))
    .limit(1);
  if (!usuario) throw new Error(`No existe el perfil ${USUARIO_EMAIL}`);

  const yaCargadas = await db
    .select({ codigo: giftCardsTable.codigo })
    .from(giftCardsTable)
    .where(eq(giftCardsTable.sucursalId, YB_ID));
  const existentes = new Set(yaCargadas.map((g) => g.codigo.toUpperCase()));

  const problemas: string[] = [];
  const vistos = new Set<string>();
  const aCargar: Array<{
    codigo: string;
    importe: number;
    saldo: number;
    fechaEmision: Date;
    venceEl: string | null;
    compradora: string | null;
    beneficiaria: string | null;
    observacion: string | null;
  }> = [];

  for (const f of filas) {
    const codigo = String(f.codigo).trim().toUpperCase();
    const importe = Number(f.importe);

    if (!Number.isFinite(importe) || importe <= 0) {
      problemas.push(`${codigo}: importe inválido (${f.importe})`);
      continue;
    }
    if (existentes.has(codigo)) {
      problemas.push(`${codigo}: ya está cargada, se saltea`);
      continue;
    }
    if (vistos.has(codigo)) {
      problemas.push(`${codigo}: viene repetida en el JSON`);
      continue;
    }
    vistos.add(codigo);

    // Sin fecha de venta se usa hoy: es sólo informativa para estas filas, el
    // vencimiento va aparte y las viejas normalmente no lo tienen anotado.
    const fecha = f.fechaVenta ? new Date(`${f.fechaVenta}T12:00:00-03:00`) : new Date();
    if (Number.isNaN(fecha.getTime())) {
      problemas.push(`${codigo}: fecha de venta ilegible (${f.fechaVenta})`);
      continue;
    }

    aCargar.push({
      codigo,
      importe,
      saldo: f.usada ? 0 : importe,
      fechaEmision: fecha,
      venceEl: limpio(f.venceEl),
      compradora: limpio(f.compradora),
      beneficiaria: limpio(f.beneficiaria),
      observacion: limpio(f.observacion),
    });
  }

  const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");
  const vivas = aCargar.filter((g) => g.saldo > 0);
  const pasivo = vivas.reduce((acc, g) => acc + g.saldo, 0);

  console.log("=== GIFT CARDS VIEJAS · YERBA BUENA ===\n");
  console.log(`  Archivo: ${ruta}`);
  console.log(`  Filas útiles en el JSON: ${filas.length}`);
  console.log(`  A cargar: ${aCargar.length}  (${vivas.length} con saldo, ${aCargar.length - vivas.length} ya canjeadas)`);
  console.log(`  Saldo que van a sumar al pasivo: $${fmt(pasivo)}\n`);

  for (const g of aCargar)
    console.log(
      `      ${g.codigo.padEnd(14)} $${fmt(g.importe).padStart(9)} → saldo $${fmt(g.saldo).padStart(9)}  ${g.beneficiaria ?? "—"}${g.venceEl ? ` · vence ${g.venceEl}` : ""}`,
    );

  if (problemas.length) {
    console.log(`\n  Se saltearon ${problemas.length}:`);
    for (const p of problemas) console.log(`      ${p}`);
  }

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }
  if (aCargar.length === 0) {
    console.log("\nNo hay nada para cargar.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    for (const g of aCargar) {
      const id = crypto.randomUUID();
      await tx.insert(giftCardsTable).values({
        id,
        sucursalId: YB_ID,
        codigo: g.codigo,
        importe: g.importe,
        saldo: g.saldo,
        estado: "activa",
        fechaEmision: g.fechaEmision,
        venceEl: g.venceEl,
        compradora: g.compradora,
        beneficiaria: g.beneficiaria,
        observacion: g.observacion,
        emitidaPreSistema: true,
        usuarioId: usuario.id,
      });
      await tx.insert(giftCardMovimientosTable).values({
        id: crypto.randomUUID(),
        giftCardId: id,
        fecha: g.fechaEmision,
        tipo: "emision",
        monto: g.importe,
        saldoResultante: g.saldo,
        ingresoId: null,
        descripcion:
          "Vendida antes de que existiera la pantalla de gift cards; cargada desde la lista del salón. Su venta ya se contó como facturación en su momento.",
        usuarioId: usuario.id,
      });
    }
  });

  console.log(`\n✔ ${aCargar.length} gift cards viejas cargadas.`);
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
