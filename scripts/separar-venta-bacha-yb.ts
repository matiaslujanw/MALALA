/**
 * Separa en dos fichas los productos de Yerba Buena que el salón usa Y vende, y
 * corrige uno que había quedado del lado equivocado.
 *
 * En el sistema `tipo` es excluyente: un insumo es de bacha (se consume en
 * recetas) o de venta (se vende al público), nunca las dos cosas. Cuando el
 * mismo producto cumple los dos roles hacen falta dos fichas, que es como ya
 * estaba resuelto para la Máscara Vitamino Spectrum. La lista de precios que
 * mandaron el 24/08 dejó ver tres productos que estaban cargados sólo como
 * insumo de bacha pero tienen precio al público.
 *
 * DÓNDE VA EL STOCK: del lado de VENTA. Esos frascos los contaron en la planilla
 * de reventa, no en la del depósito, así que según el propio recuento estaban en
 * el mostrador. La ficha de bacha conserva su precio —que es lo que las recetas
 * necesitan para costear— pero arranca en cero, hasta que compren o abran uno
 * para uso del salón. Si se dejara el stock en las dos, el mismo frasco quedaría
 * contado dos veces.
 *
 * Además, el "Serum de enjuague Absolut Repair Molecular 250 ml" se había
 * cargado como producto de venta y el salón aclaró que "los que no tienen precio
 * es porque no estuvieron nunca para reventa". Se pasa a bacha, con su envase
 * real de 250 ml, y se le cambia el código de VPC a INS para que el catálogo
 * quede coherente.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/separar-venta-bacha-yb.ts [--commit]
 */
import "../envConfig";
import { and, eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  insumoProveedores as insumoProveedoresTable,
  insumos as insumosTable,
  stockSucursal as stockSucursalTable,
} from "../src/lib/db/schema";

const YB_ID = "seed-000002";

/**
 * Productos que se venden y además se usan. `desdeBacha` es la ficha de uso
 * interno de la que sale el costo y a la que se le pone el stock en cero.
 */
const GEMELOS: Array<{
  codigo: string;
  nombre: string;
  desdeBacha: string;
  precioVenta: number;
  /** Frascos contados en la planilla de reventa. */
  stock: number;
}> = [
  {
    codigo: "VPC149",
    nombre: "Óleo Lumière con Argán Question 75 ml",
    desdeBacha: "INS204",
    precioVenta: 55000,
    stock: 2,
  },
  {
    codigo: "VPC150",
    nombre: "Óleo Keratin Lift Question 75 ml",
    desdeBacha: "INS204",
    precioVenta: 55000,
    stock: 2,
  },
  {
    codigo: "VPC151",
    nombre: "Q Style Oil Molecular Flex Question 75 ml",
    desdeBacha: "INS211",
    precioVenta: 55000,
    stock: 2,
  },
  {
    codigo: "VPC152",
    nombre: "Q Style Curl Cream Question 235 ml",
    desdeBacha: "INS210",
    precioVenta: 50000,
    stock: 2,
  },
];

/** El que estaba del lado equivocado. */
const CONVERTIR = {
  codigoViejo: "VPC147",
  codigoNuevo: "INS122",
  nombre: "Serum de enjuague Absolut Repair Molecular",
  tamanoEnvase: 250,
  unidadMedida: "ml" as const,
};

async function main() {
  const commit = process.argv.includes("--commit");
  const db = getDb();

  const insumos = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.sucursalId, YB_ID));
  const porCodigo = new Map(insumos.filter((x) => x.codigo).map((x) => [x.codigo!, x]));
  const stock = new Map(
    (
      await db
        .select()
        .from(stockSucursalTable)
        .where(eq(stockSucursalTable.sucursalId, YB_ID))
    ).map((s) => [s.insumoId, s]),
  );

  const nuevos = GEMELOS.filter((g) => !porCodigo.has(g.codigo)).map((g) => ({
    ...g,
    bacha: porCodigo.get(g.desdeBacha),
  }));
  const faltaBacha = nuevos.filter((g) => !g.bacha);
  if (faltaBacha.length) {
    console.error(
      `No existen los insumos de bacha: ${faltaBacha.map((g) => g.desdeBacha).join(", ")}`,
    );
    await getSqlClient().end({ timeout: 5 });
    process.exit(1);
  }

  // Las fichas de bacha que quedan en cero: sólo las que tienen gemelo nuevo.
  const aCero = [...new Set(nuevos.map((g) => g.desdeBacha))]
    .map((c) => porCodigo.get(c)!)
    .filter((i) => (stock.get(i.id)?.cantidad ?? 0) !== 0);

  const convertir = porCodigo.get(CONVERTIR.codigoViejo);
  const yaConvertido = porCodigo.has(CONVERTIR.codigoNuevo);

  const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");
  console.log("=== SEPARAR USO INTERNO DE REVENTA · YERBA BUENA ===\n");

  console.log(`  Fichas de venta a crear: ${nuevos.length}`);
  for (const g of nuevos) {
    const costo = g.bacha!.precioEnvase;
    console.log(
      `      ${g.codigo} ${g.nombre.padEnd(42)} costo $${fmt(costo).padStart(8)} · venta $${fmt(g.precioVenta)} · margen ${(((g.precioVenta - costo) / g.precioVenta) * 100).toFixed(0)}% · stock ${g.stock}`,
    );
    console.log(`             ↳ del mismo frasco que ${g.desdeBacha} ${g.bacha!.nombre}`);
  }

  console.log(`\n  Fichas de bacha que pasan a stock 0: ${aCero.length}`);
  for (const i of aCero)
    console.log(
      `      ${i.codigo} ${i.nombre.slice(0, 44).padEnd(44)} ${stock.get(i.id)?.cantidad ?? 0} ${i.unidadMedida} → 0   (el stock se va a la ficha de venta)`,
    );

  console.log(`\n  A pasar de venta a uso interno:`);
  if (yaConvertido) {
    console.log(`      ya está hecho (${CONVERTIR.codigoNuevo})`);
  } else if (!convertir) {
    console.log(`      ⚠ no encontré ${CONVERTIR.codigoViejo}`);
  } else {
    const stockViejo = stock.get(convertir.id)?.cantidad ?? 0;
    console.log(
      `      ${convertir.codigo} → ${CONVERTIR.codigoNuevo} "${CONVERTIR.nombre}"`,
    );
    console.log(
      `             venta → bacha · envase 1 ud → ${CONVERTIR.tamanoEnvase} ml · unitario $${fmt(convertir.precioEnvase)} → $${(convertir.precioEnvase / CONVERTIR.tamanoEnvase).toFixed(2)} por ml`,
    );
    console.log(
      `             stock ${stockViejo} ud → ${stockViejo * CONVERTIR.tamanoEnvase} ml · se le saca el precio de venta`,
    );
  }

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    for (const g of nuevos) {
      const id = `yb-${g.codigo}`;
      const bacha = g.bacha!;
      await tx.insert(insumosTable).values({
        id,
        sucursalId: YB_ID,
        nombre: g.nombre,
        codigo: g.codigo,
        // Se vende por unidad: el envase es 1 y su precio es el del frasco entero.
        unidadMedida: "ud",
        tamanoEnvase: 1,
        precioEnvase: bacha.precioEnvase,
        precioUnitario: bacha.precioEnvase,
        rinde: null,
        umbralStockBajo: 0,
        activo: true,
        tipo: "venta",
        vendible: true,
        precioVenta: g.precioVenta,
      });
      await tx.insert(stockSucursalTable).values({
        id: `yb-stk-${g.codigo}`,
        insumoId: id,
        sucursalId: YB_ID,
        cantidad: g.stock,
      });
      // Hereda los proveedores de la ficha de bacha: es el mismo producto.
      const provs = await tx
        .select()
        .from(insumoProveedoresTable)
        .where(eq(insumoProveedoresTable.insumoId, bacha.id));
      for (const p of provs)
        await tx
          .insert(insumoProveedoresTable)
          .values({ id: crypto.randomUUID(), insumoId: id, proveedorId: p.proveedorId })
          .onConflictDoNothing();
    }

    for (const i of aCero)
      await tx
        .update(stockSucursalTable)
        .set({ cantidad: 0 })
        .where(
          and(
            eq(stockSucursalTable.insumoId, i.id),
            eq(stockSucursalTable.sucursalId, YB_ID),
          ),
        );

    if (convertir && !yaConvertido) {
      const stockViejo = stock.get(convertir.id)?.cantidad ?? 0;
      await tx
        .update(insumosTable)
        .set({
          codigo: CONVERTIR.codigoNuevo,
          nombre: CONVERTIR.nombre,
          unidadMedida: CONVERTIR.unidadMedida,
          tamanoEnvase: CONVERTIR.tamanoEnvase,
          precioUnitario: convertir.precioEnvase / CONVERTIR.tamanoEnvase,
          tipo: "bacha",
          vendible: false,
          precioVenta: null,
        })
        .where(eq(insumosTable.id, convertir.id));
      await tx
        .update(stockSucursalTable)
        .set({ cantidad: stockViejo * CONVERTIR.tamanoEnvase })
        .where(
          and(
            eq(stockSucursalTable.insumoId, convertir.id),
            eq(stockSucursalTable.sucursalId, YB_ID),
          ),
        );
    }
  });

  console.log(`\n✔ ${nuevos.length} fichas de venta creadas y el catálogo quedó coherente.`);
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
