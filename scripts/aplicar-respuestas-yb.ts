/**
 * Aplica las respuestas que el salón dio por WhatsApp el 24/08/2026.
 *
 * Cada bloque dice textualmente qué contestaron, para que se pueda auditar
 * después de dónde salió cada cambio.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/aplicar-respuestas-yb.ts [--commit]
 */
import "../envConfig";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  insumoProveedores as insumoProveedoresTable,
  insumos as insumosTable,
  proveedores as proveedoresTable,
  servicioSucursal as servicioSucursalTable,
  servicios as serviciosTable,
  stockSucursal as stockSucursalTable,
} from "../src/lib/db/schema";

const YB_ID = "seed-000002";

/**
 * "ya no van más esos servicios".
 *
 * Son los 30 que su planilla no traía, MENOS las 5 gift cards: sobre esas
 * aclararon aparte que las tienen cargadas como servicios y que hay un
 * tratamiento propio para el tema, así que se dejan como están hasta resolverlo.
 */
const SERVICIOS_BAJA = [
  "CEP107", "CEP108", "CEP109", "CEP110",
  "COM002", "COM003", "COM004", "COM005", "COM006",
  "COR100", "COR101",
  "MAS109", "MAS110", "MAS117", "MAS118", "MAS119", "MAS120", "MAS121",
  "NAI121", "NAI122", "NAI123",
  "PEL618", "PEL619", "PEL621", "PEL622",
];

/** "bijou ya no hay más en Malala yb": son los productos del rubro joyas. */
const BIJOU_BAJA = [
  "VDJ100", "VDJ101", "VDJ102", "VDJ103", "VDJ104",
  "VDJ105", "VDJ106", "VDJ107", "VDJ108",
];

/** Lista de precios de venta que mandaron en la foto. */
const PRECIOS_VENTA: Array<{ codigo: string; precio: number }> = [
  { codigo: "VPC144", precio: 125000 },
  { codigo: "VPC145", precio: 110000 },
  { codigo: "VPC146", precio: 100000 },
];

interface Alta {
  codigo: string;
  nombre: string;
  unidadMedida: "ml" | "g" | "ud";
  tamanoEnvase: number;
  precioEnvase: number;
  tipo: "bacha" | "venta";
  precioVenta?: number;
  proveedor?: string;
  stock: number;
  porque: string;
}

const ALTAS: Alta[] = [
  {
    codigo: "INS213",
    nombre: "Revelador Superaclarante Question",
    unidadMedida: "ml",
    tamanoEnvase: 1000,
    precioEnvase: 17680.18,
    tipo: "bacha",
    proveedor: "Question Professional",
    stock: 1,
    porque: 'contestaron "1000 ml"; el precio ya lo habían puesto en la planilla',
  },
  {
    codigo: "VPC148",
    nombre: "Serum Keratin Alpha Sleek 50 ml",
    unidadMedida: "ud",
    tamanoEnvase: 1,
    precioEnvase: 49095.15,
    tipo: "venta",
    precioVenta: 100000,
    proveedor: "Loreal",
    stock: 5,
    // INS108 es el mismo frasco pero como insumo de bacha: bacha y venta son
    // excluyentes, así que el que se vende necesita su propia ficha.
    porque: 'contestaron "lo vendemos y también es insumo"',
  },
];

async function main() {
  const commit = process.argv.includes("--commit");
  const db = getDb();

  const insumos = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.sucursalId, YB_ID));
  const insPorCodigo = new Map(insumos.filter((x) => x.codigo).map((x) => [x.codigo!, x]));
  const servicios = (
    await db
      .select()
      .from(serviciosTable)
      .innerJoin(
        servicioSucursalTable,
        eq(servicioSucursalTable.servicioId, serviciosTable.id),
      )
      .where(eq(servicioSucursalTable.sucursalId, YB_ID))
  ).map((r) => r.servicios);
  const svPorCodigo = new Map(servicios.filter((x) => x.codigo).map((x) => [x.codigo!, x]));

  const bajasSv = SERVICIOS_BAJA.map((c) => svPorCodigo.get(c)).filter(
    (s): s is NonNullable<typeof s> => !!s && s.activo,
  );
  const bajasBijou = BIJOU_BAJA.map((c) => insPorCodigo.get(c)).filter(
    (i): i is NonNullable<typeof i> => !!i && i.activo,
  );
  const precios = PRECIOS_VENTA.map((p) => ({ ...p, ins: insPorCodigo.get(p.codigo) })).filter(
    (p) => p.ins && p.ins.precioVenta !== p.precio,
  );
  const altas = ALTAS.filter((a) => !insPorCodigo.has(a.codigo));

  const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");
  console.log("=== RESPUESTAS DEL SALÓN · 24/08/2026 ===\n");

  console.log(`  Servicios a dar de baja ("ya no van más esos servicios"): ${bajasSv.length}`);
  for (const s of bajasSv) console.log(`      ${s.codigo} ${s.nombre}`);
  console.log(
    `      (las 5 gift cards quedan activas: avisaron que tienen un tratamiento aparte)`,
  );

  console.log(`\n  Bijou a dar de baja ("ya no hay más en Malala yb"): ${bajasBijou.length}`);
  for (const i of bajasBijou) console.log(`      ${i.codigo} ${i.nombre}`);

  console.log(`\n  Precios de venta corregidos con la lista que mandaron: ${precios.length}`);
  for (const p of precios) {
    const costo = p.ins!.precioUnitario ?? 0;
    console.log(
      `      ${p.codigo} ${p.ins!.nombre.slice(0, 40).padEnd(40)} $${fmt(p.ins!.precioVenta ?? 0)} → $${fmt(p.precio)} · margen ${(((p.precio - costo) / p.precio) * 100).toFixed(0)}%`,
    );
  }

  console.log(`\n  Altas: ${altas.length}`);
  for (const a of altas) {
    const unit = a.precioEnvase / a.tamanoEnvase;
    console.log(
      `      ${a.codigo} ${a.nombre.padEnd(36)} ${a.tipo.padEnd(5)} ${a.tamanoEnvase} ${a.unidadMedida} · costo $${fmt(a.precioEnvase)} · unit $${unit.toFixed(2)}${a.precioVenta ? ` · venta $${fmt(a.precioVenta)} (margen ${(((a.precioVenta - unit) / a.precioVenta) * 100).toFixed(0)}%)` : ""}`,
    );
    console.log(`             ↳ ${a.porque}`);
  }

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    if (bajasSv.length)
      await tx
        .update(serviciosTable)
        .set({ activo: false, visibleReserva: false })
        .where(
          inArray(
            serviciosTable.id,
            bajasSv.map((s) => s.id),
          ),
        );

    if (bajasBijou.length)
      await tx
        .update(insumosTable)
        .set({ activo: false })
        .where(
          inArray(
            insumosTable.id,
            bajasBijou.map((i) => i.id),
          ),
        );

    for (const p of precios)
      await tx
        .update(insumosTable)
        .set({ precioVenta: p.precio })
        .where(eq(insumosTable.id, p.ins!.id));

    for (const a of altas) {
      const id = `yb-${a.codigo}`;
      const [prov] = a.proveedor
        ? await tx
            .select()
            .from(proveedoresTable)
            .where(eq(proveedoresTable.nombre, a.proveedor))
            .limit(1)
        : [undefined];
      await tx.insert(insumosTable).values({
        id,
        sucursalId: YB_ID,
        nombre: a.nombre,
        codigo: a.codigo,
        unidadMedida: a.unidadMedida,
        tamanoEnvase: a.tamanoEnvase,
        precioEnvase: a.precioEnvase,
        precioUnitario: a.precioEnvase / a.tamanoEnvase,
        rinde: null,
        umbralStockBajo: 0,
        activo: true,
        tipo: a.tipo,
        vendible: a.tipo === "venta",
        precioVenta: a.precioVenta ?? null,
      });
      await tx.insert(stockSucursalTable).values({
        id: `yb-stk-${a.codigo}`,
        insumoId: id,
        sucursalId: YB_ID,
        cantidad: a.tipo === "venta" ? a.stock : a.stock * a.tamanoEnvase,
      });
      if (prov)
        await tx
          .insert(insumoProveedoresTable)
          .values({ id: crypto.randomUUID(), insumoId: id, proveedorId: prov.id })
          .onConflictDoNothing();
    }
  });

  console.log(
    `\n✔ ${bajasSv.length} servicios y ${bajasBijou.length} productos de bijou dados de baja, ${precios.length} precios corregidos y ${altas.length} altas.`,
  );
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
