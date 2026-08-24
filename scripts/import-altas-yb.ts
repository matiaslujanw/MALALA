/**
 * Da de alta los insumos que el salón pidió agregar en la hoja 5 del excel de
 * pendientes ("contados en el recuento pero sin ficha en el sistema").
 *
 * La hoja trae el precio de compra pero NO la unidad ni el tamaño del envase,
 * así que hubo que deducirlos de las observaciones y de los productos hermanos
 * ya cargados. Esa deducción está acá abajo, explícita y con la fuente de cada
 * dato, porque un envase equivocado no falla: sale un precio unitario 10 o 100
 * veces mayor y ensucia en silencio el costo de todos los servicios que usen
 * ese insumo.
 *
 * De las 19 filas se cargan 10. Las otras 9 quedan afuera a propósito:
 *
 *  - 3 son duplicados de insumos que ya existen, confirmados porque el precio
 *    coincide al centavo: el bidón Hairkadus es INS839 "Oxidante" ($45.000 /
 *    5000 ml), la Ampolla Biocell Therapy es INS601 ($3.400 por ampolla) y uno
 *    de los óleos Question de 75 ml es INS204, que está cargado con el nombre
 *    genérico "Serum" y el mismo precio ($28.334,58). Crearlos de nuevo
 *    partiría el stock y duplicaría el costo del mismo frasco.
 *  - 6 necesitan que el salón conteste algo antes (ver PREGUNTAR).
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/import-altas-yb.ts [--commit]
 */
import "../envConfig";
import { eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  insumoProveedores as insumoProveedoresTable,
  insumos as insumosTable,
  proveedorSucursal as proveedorSucursalTable,
  proveedores as proveedoresTable,
  stockSucursal as stockSucursalTable,
} from "../src/lib/db/schema";

const YB_ID = "seed-000002";

interface Alta {
  codigo: string;
  nombre: string;
  unidadMedida: "ml" | "g" | "ud" | "aplicacion";
  /** En la unidad de arriba. Los de venta van por unidad, así que es 1. */
  tamanoEnvase: number;
  /** Lo que pagan por ese envase. */
  precioEnvase: number;
  tipo: "bacha" | "venta";
  precioVenta?: number;
  proveedor?: string;
  /** Unidades contadas en el recuento físico. */
  stock: number;
  /** De dónde salen la unidad y el envase. */
  fuente: string;
}

const ALTAS: Alta[] = [
  // --- Tinturas: el envase sale de los hermanos Igora ya cargados ---
  {
    codigo: "INS311",
    nombre: "Tintura Igora Absolutes",
    unidadMedida: "g",
    tamanoEnvase: 60,
    precioEnvase: 18690,
    tipo: "bacha",
    proveedor: "Schwarzkopf",
    stock: 4,
    fuente: "pomo de 60 g, igual que INS310 Igora Royal e INS309 Highlifts",
  },
  {
    codigo: "INS312",
    nombre: "Tintura Igora Fashion Lights",
    unidadMedida: "g",
    tamanoEnvase: 60,
    precioEnvase: 21500,
    tipo: "bacha",
    proveedor: "Schwarzkopf",
    stock: 9,
    fuente: "pomo de 60 g, igual que las otras Igora",
  },
  // --- El envase está escrito en la observación ---
  {
    codigo: "INS209",
    nombre: "Oxidante Question Crema Oxigenada",
    unidadMedida: "ml",
    tamanoEnvase: 900,
    precioEnvase: 14613.02,
    tipo: "bacha",
    proveedor: "Question Professional",
    stock: 2,
    // No es INS203: ese es el oxidante Lumiplex y sale $16.324,95, otro precio.
    fuente: 'observación: "10/20/30 vol x900ml"',
  },
  {
    codigo: "INS858",
    nombre: "Shampoo pre-técnico LuminoClean",
    unidadMedida: "ml",
    tamanoEnvase: 1000,
    precioEnvase: 16490,
    tipo: "bacha",
    proveedor: "Adriano Distribuciones",
    stock: 1,
    fuente: 'observación: "Apertura de Cutícula LuminoClean 1000ml"',
  },
  {
    codigo: "INS121",
    nombre: "Pre-tratamiento Absolut Repair Molecular",
    unidadMedida: "ml",
    tamanoEnvase: 190,
    precioEnvase: 45232.83,
    tipo: "bacha",
    proveedor: "Loreal",
    stock: 1,
    // La observación aclara "solo técnico, sin precio reventa": va a bacha.
    fuente: 'nombre y observación: "Pre tratamiento 190ml"',
  },
  {
    codigo: "INS211",
    nombre: "Q Style Oil Molecular Flex Question",
    unidadMedida: "ml",
    tamanoEnvase: 75,
    precioEnvase: 30452.55,
    tipo: "bacha",
    proveedor: "Question Professional",
    stock: 2,
    // Es un tercer oleo Question distinto: el salon confirmo que INS204 son el
    // Lumiere y el Keratin Lift, y este sale otro precio ($30.452,55).
    fuente: 'nombre: "75ml"',
  },
  {
    codigo: "INS210",
    nombre: "Q Style Curl Cream Question",
    unidadMedida: "ml",
    tamanoEnvase: 235,
    precioEnvase: 13230.85,
    tipo: "bacha",
    proveedor: "Question Professional",
    stock: 2,
    fuente: 'nombre: "235ml"',
  },
  // --- Productos de reventa: se venden por unidad, envase 1 ---
  {
    codigo: "VPC144",
    nombre: "Mascara Keratin Alpha Sleek 250 ml",
    unidadMedida: "ud",
    tamanoEnvase: 1,
    precioEnvase: 64366.25,
    tipo: "venta",
    precioVenta: 94690,
    proveedor: "Loreal",
    stock: 3,
    // No choca con INS102, que es el pote profesional de 500 ml.
    fuente: "se vende por unidad; costo del pote de 250 ml",
  },
  {
    codigo: "VPC145",
    nombre: "Keratin Alpha Sleek Smooth Transformer 200 ml",
    unidadMedida: "ud",
    tamanoEnvase: 1,
    precioEnvase: 53854.08,
    tipo: "venta",
    precioVenta: 79225,
    proveedor: "Loreal",
    stock: 6,
    fuente: "se vende por unidad; no había hermano cargado",
  },
  {
    codigo: "VPC146",
    nombre: "Shampoo Keratin Alpha Sleek 300 ml",
    unidadMedida: "ud",
    tamanoEnvase: 1,
    precioEnvase: 43077.51,
    tipo: "venta",
    precioVenta: 63370,
    proveedor: "Loreal",
    stock: 2,
    // INS111 es el de bacha, de 1500 ml: otro SKU.
    fuente: "se vende por unidad; costo del frasco de 300 ml",
  },
  {
    codigo: "VPC147",
    nombre: "Serum de enjuague Absolut Repair Molecular 250 ml",
    unidadMedida: "ud",
    tamanoEnvase: 1,
    precioEnvase: 53854.08,
    tipo: "venta",
    precioVenta: 79225,
    proveedor: "Loreal",
    stock: 5,
    // No es VPC117: ese sale $64.366,25 y se vende a $125.000, otro producto.
    fuente: "se vende por unidad; costo del envase de 250 ml",
  },
];

/**
 * Insumos que ya existen y hay que corregir, no crear.
 *
 * INS204 estaba cargado como "Serum" a secas y es el oleo tratante de Question:
 * el salon mando las fotos de los dos frascos (Lumiere con argan y Keratin Lift
 * con vitamina E) y aclaro que los usan indistintamente. Como los dos cuestan
 * lo mismo al centavo, un solo insumo generico sirve y es lo que ya piden las
 * 75 recetas; se le arregla el nombre para que se entienda cual es.
 */
const RENOMBRAR: Array<{ codigo: string; nombre: string; stockEnvases?: number }> = [
  {
    codigo: "INS204",
    nombre: "Óleo tratante Question (Lumière / Keratin Lift)",
    // El recuento conto 2 frascos de cada uno.
    stockEnvases: 4,
  },
];

/** Lo que no se carga y por qué, para que quede en el reporte. */
const PREGUNTAR: Array<[string, string]> = [
  [
    "Oxidante New Blond Crema Oxigenada (1)",
    "la fila volvió vacía. La foto muestra que es una crema oxidante de 20 volúmenes (6%), pero falta cuántos ml trae y cuánto pagan",
  ],
  [
    "Oxidante Question Revelador Superaclarante (1)",
    "no dice el tamaño en ningún lado y los oxidantes van de 900 a 5000 ml: asumirlo es arriesgado",
  ],
  [
    "Tintura Livesolut Color (3)",
    "sale exactamente $7.448,67, el mismo precio que INS207 'Tintura con amoniaco Question' de 60 g. Puede ser el mismo producto con otro nombre",
  ],
  [
    "Serum Keratin Alpha Sleek Discipline Miroir 50 ml (5)",
    "le pusieron precio de venta, pero INS108 ya está cargado como el MISMO frasco de 50 ml para uso interno. En la máscara y el shampoo el envase de venta es más chico que el profesional; acá es igual, así que conviene confirmar si de verdad venden ese frasco",
  ],
  [
    "Ampolla Complex Biocell Therapy (1) · bidón Hairkadus (1)",
    "no se cargan porque son INS601 e INS839, confirmado porque el precio coincide al centavo. Sólo hace falta que confirmen que es así",
  ],
];

async function main() {
  const commit = process.argv.includes("--commit");
  const db = getDb();

  const existentes = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.sucursalId, YB_ID));
  const porCodigo = new Map(existentes.filter((x) => x.codigo).map((x) => [x.codigo!, x]));
  const proveedoresDb = await db.select().from(proveedoresTable);
  const provPorNombre = new Map(proveedoresDb.map((p) => [p.nombre.toLowerCase(), p]));

  const nuevos = ALTAS.filter((a) => !porCodigo.has(a.codigo));
  const yaEstaban = ALTAS.filter((a) => porCodigo.has(a.codigo));
  const provFaltantes = [
    ...new Set(
      nuevos
        .map((a) => a.proveedor)
        .filter((p): p is string => !!p && !provPorNombre.has(p.toLowerCase())),
    ),
  ];

  const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");
  console.log("=== ALTAS DE LA HOJA 5 · YERBA BUENA ===\n");
  console.log(`  A dar de alta: ${nuevos.length}\n`);
  for (const a of nuevos) {
    const unit = a.precioEnvase / a.tamanoEnvase;
    console.log(
      `      ${a.codigo} ${a.nombre.slice(0, 44).padEnd(44)} ${a.tipo.padEnd(5)} ${String(a.tamanoEnvase).padStart(5)} ${a.unidadMedida.padEnd(3)} · frasco $${fmt(a.precioEnvase).padStart(9)} · unit $${unit.toFixed(2).padStart(9)}${a.precioVenta ? ` · venta $${fmt(a.precioVenta)}` : ""} · stock ${a.stock}`,
    );
    console.log(`             ↳ ${a.fuente}`);
  }
  if (yaEstaban.length)
    console.log(`\n  Ya existían, no se tocan: ${yaEstaban.map((a) => a.codigo).join(", ")}`);
  const renombres = RENOMBRAR.map((r) => ({ r, actual: porCodigo.get(r.codigo) })).filter(
    (x) => x.actual && x.actual.nombre !== x.r.nombre,
  );
  if (renombres.length) {
    console.log(`
  A renombrar (ya existen, no se duplican): ${renombres.length}`);
    for (const x of renombres)
      console.log(
        `      ${x.r.codigo} "${x.actual!.nombre}" → "${x.r.nombre}"${x.r.stockEnvases ? `  · stock ${x.r.stockEnvases} env × ${x.actual!.tamanoEnvase} = ${x.r.stockEnvases * x.actual!.tamanoEnvase} ${x.actual!.unidadMedida}` : ""}`,
      );
  }
  if (provFaltantes.length)
    console.log(`\n  Proveedores a crear: ${provFaltantes.join(", ")}`);

  console.log(`\n  NO se cargan, falta que el salón conteste (${PREGUNTAR.length}):`);
  for (const [que, porque] of PREGUNTAR) console.log(`      · ${que}\n            ${porque}`);

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    for (const nombre of provFaltantes) {
      const id = `prov-${nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")}`;
      await tx.insert(proveedoresTable).values({ id, nombre }).onConflictDoNothing();
      await tx
        .insert(proveedorSucursalTable)
        .values({ id: crypto.randomUUID(), proveedorId: id, sucursalId: YB_ID })
        .onConflictDoNothing();
      provPorNombre.set(nombre.toLowerCase(), { id, nombre, telefono: null, cuit: null, deudaPendiente: 0 });
    }

    for (const x of renombres) {
      await tx
        .update(insumosTable)
        .set({ nombre: x.r.nombre })
        .where(eq(insumosTable.id, x.actual!.id));
      if (x.r.stockEnvases) {
        const cantidad = x.r.stockEnvases * x.actual!.tamanoEnvase;
        // El recuento es un valor absoluto: se fija, no se suma.
        await tx
          .update(stockSucursalTable)
          .set({ cantidad })
          .where(eq(stockSucursalTable.insumoId, x.actual!.id));
      }
    }

    for (const a of nuevos) {
      const id = `yb-${a.codigo}`;
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
      // El stock sale del recuento físico: se carga lo contado.
      await tx.insert(stockSucursalTable).values({
        id: `yb-stk-${a.codigo}`,
        insumoId: id,
        sucursalId: YB_ID,
        cantidad: a.tipo === "venta" ? a.stock : a.stock * a.tamanoEnvase,
      });
      const prov = a.proveedor ? provPorNombre.get(a.proveedor.toLowerCase()) : undefined;
      if (prov)
        await tx
          .insert(insumoProveedoresTable)
          .values({ id: crypto.randomUUID(), insumoId: id, proveedorId: prov.id })
          .onConflictDoNothing();
    }
  });

  console.log(`\n✔ ${nuevos.length} insumos dados de alta, con su stock del recuento.`);
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
