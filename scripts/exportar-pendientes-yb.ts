/**
 * Exporta a un xlsx todo lo que falta completar del catálogo de Malala Yerba
 * Buena, en un formato pensado para que el salón lo llene y nos lo devuelva.
 *
 * Por qué existe: el sistema tiene las pantallas para cargar esto, pero en la
 * práctica no entran a validar. Es más rápido mandarles la planilla con las
 * columnas vacías y volver a importarla que pedirles que revisen 467 líneas de
 * receta a mano.
 *
 * Las columnas a completar van con el encabezado entre corchetes, para que se
 * vea de una qué tienen que llenar y qué es dato nuestro de referencia.
 *
 * Uso: npx tsx scripts/exportar-pendientes-yb.ts [--out <ruta.xlsx>]
 */
import "../envConfig";
import { asc, eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  insumos as insumosTable,
  recetas as recetasTable,
  servicioSucursal as servicioSucursalTable,
  servicios as serviciosTable,
} from "../src/lib/db/schema";
import { escribirXlsx, type Hoja } from "./lib/xlsx-escribir";

const YB_ID = "seed-000002";
const SALIDA_DEFAULT =
  "C:/Users/LBonilla-DIA/Downloads/pendientes_malala_yerba_buena.xlsx";

async function main() {
  const i = process.argv.indexOf("--out");
  const salida = i >= 0 ? process.argv[i + 1] : SALIDA_DEFAULT;

  const db = getDb();

  const insumos = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.sucursalId, YB_ID))
    .orderBy(asc(insumosTable.nombre));
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
  const recetas = await db
    .select()
    .from(recetasTable)
    .where(eq(recetasTable.sucursalId, YB_ID));

  const insPorId = new Map(insumos.map((x) => [x.id, x]));
  const svPorId = new Map(servicios.map((x) => [x.id, x]));
  const hojas: Hoja[] = [];

  // ---- 1. Recetas a confirmar ----
  const propuestas = recetas
    .filter((r) => !r.confirmada)
    .map((r) => ({ r, sv: svPorId.get(r.servicioId), ins: insPorId.get(r.insumoId) }))
    .filter((x) => x.sv && x.ins)
    .sort(
      (a, b) =>
        (a.sv!.codigo ?? "").localeCompare(b.sv!.codigo ?? "") ||
        a.ins!.nombre.localeCompare(b.ins!.nombre),
    );
  hojas.push({
    nombre: "1. Recetas a confirmar",
    anchos: [12, 40, 34, 10, 8, 14, 18, 28],
    filas: [
      ["MALALA YERBA BUENA · Recetas a confirmar"],
      [
        "Estas cantidades las armamos nosotros y nadie las validó todavía. De acá sale el costo de cada servicio.",
      ],
      ["Si la cantidad está bien poné OK; si no, escribí la correcta al lado."],
      [],
      [
        "Cód. servicio",
        "Servicio",
        "Insumo",
        "Cantidad",
        "Unidad",
        "[¿Está bien?]",
        "[Cantidad correcta]",
        "[Observaciones]",
      ],
      ...propuestas.map((x) => [
        x.sv!.codigo ?? "",
        x.sv!.nombre,
        x.ins!.nombre,
        x.r.cantidad,
        x.ins!.unidadMedida,
        "",
        "",
        "",
      ]),
    ],
  });

  // ---- 2. Precios de insumos del salón ----
  const bachaSinPrecio = insumos.filter(
    (x) => x.tipo === "bacha" && x.activo && x.precioUnitario == null,
  );
  hojas.push({
    nombre: "2. Precios insumos",
    anchos: [12, 40, 10, 22, 22, 20, 26],
    filas: [
      ["MALALA YERBA BUENA · Insumos del salón sin precio de compra"],
      [
        "Sin esto el sistema cuenta esas recetas como si el insumo fuera gratis, y el margen sale más alto de lo real.",
      ],
      [],
      [
        "Código",
        "Insumo",
        "Unidad",
        "[Marca / proveedor]",
        "[Cuánto trae el envase]",
        "[Precio del envase]",
        "[Observaciones]",
      ],
      ...bachaSinPrecio.map((x) => [
        x.codigo ?? "",
        x.nombre,
        x.unidadMedida,
        "",
        "",
        "",
        "",
      ]),
    ],
  });

  // ---- 3. Costos de los productos de reventa ----
  const ventaSinCosto = insumos.filter(
    (x) => x.tipo === "venta" && x.precioUnitario == null,
  );
  hojas.push({
    nombre: "3. Costos reventa",
    anchos: [12, 44, 18, 20, 26],
    filas: [
      ["MALALA YERBA BUENA · Productos de reventa sin precio de compra"],
      [
        "Mientras falte, el sistema muestra esas ventas con 100% de ganancia, que no es real.",
      ],
      ["Ojo: es lo que PAGAN ustedes por el frasco, no el precio al público."],
      [],
      ["Código", "Producto", "Precio de venta", "[Precio de costo]", "[Observaciones]"],
      ...ventaSinCosto.map((x) => [
        x.codigo ?? "",
        x.nombre,
        x.precioVenta ?? "",
        "",
        "",
      ]),
    ],
  });

  // ---- 4. Duraciones ----
  const sinDuracion = servicios
    .filter((s) => s.activo && s.duracionMin == null)
    .sort((a, b) => (a.codigo ?? "").localeCompare(b.codigo ?? ""));
  hojas.push({
    nombre: "4. Duraciones",
    anchos: [12, 46, 26, 20, 26],
    filas: [
      ["MALALA YERBA BUENA · Servicios sin duración"],
      [
        "Sin la duración el servicio no se puede reservar por la web, así que hoy están ocultos del menú online. Se cobran normal en el mostrador.",
      ],
      ["Escribilo como te salga: 30 min, 1 hora, 1 hora y 30."],
      [],
      ["Código", "Servicio", "Rubro", "[Cuánto tarda]", "[Observaciones]"],
      ...sinDuracion.map((s) => [s.codigo ?? "", s.nombre, s.rubro, "", ""]),
    ],
  });

  // ---- 5. Contados en el recuento pero sin ficha en el sistema ----
  // Son los que en el mapeo del recuento quedaron sin correlato: se listan a
  // mano porque justamente no existen como fila del catálogo.
  const huerfanos: Array<[string, number]> = [
    ["Tintura Schwarzkopf Igora Absolutes", 4],
    ["Tintura Schwarzkopf Igora Fashion Lights", 9],
    ["Tintura Livesolut Color", 3],
    ["Oxidante Question Crema Oxigenada", 2],
    ["Oxidante Question Revelador Superaclarante", 1],
    ["Oxidante New Blond Crema Oxigenada", 1],
    ["Oxidante bidón Hairkadus Kadus Color", 1],
    ["Ampolla Complex Biocell Therapy (caja x12)", 1],
    ["Shampoo pre-técnico Lumino Clean (Adriano)", 1],
    ["Keratin Alpha Sleek Máscara 250ml", 3],
    ["Keratin Alpha Sleek Smooth Transformer 200ml", 6],
    ["Keratin Alpha Sleek Serum Discipline Miroir 50ml", 5],
    ["Keratin Alpha Sleek Shampoo 300ml", 2],
    ["Absolut Repair Molecular Sérum Rinse-off 250ml", 5],
    ["Absolut Repair Molecular Pre-Tratamiento 190ml", 1],
    ["Lumière Óleo Tratante con Argán (Question)", 2],
    ["Q Style Oil Molecular Flex 75ml", 2],
    ["Q Style Curl Cream 235ml", 2],
    ["Keratin Lift Óleo Tratante (Question)", 2],
  ];
  hojas.push({
    nombre: "5. Faltan en el sistema",
    anchos: [46, 16, 20, 20, 22, 26],
    filas: [
      ["MALALA YERBA BUENA · Contados en el recuento pero sin ficha en el sistema"],
      [
        "Aparecieron en los recuentos pero no figuran en la planilla de insumos, así que no los cargamos para no mezclarlos con otro producto parecido.",
      ],
      [],
      [
        "Producto (como lo escribieron ustedes)",
        "Unidades contadas",
        "[¿Lo damos de alta?]",
        "[Precio de compra]",
        "[Si se vende, a cuánto]",
        "[Observaciones]",
      ],
      ...huerfanos.map(([nombre, uds]) => [nombre, uds, "", "", "", ""]),
    ],
  });

  escribirXlsx(salida, hojas);

  console.log("=== PENDIENTES EXPORTADOS ===\n");
  console.log(`  Archivo: ${salida}\n`);
  for (const h of hojas) {
    // Las hojas no tienen todas la misma cantidad de líneas de encabezado, así
    // que los datos se cuentan a partir de la fila de títulos de columna.
    // La fila de títulos es la única que trae columnas entre corchetes.
    const iTitulos = h.filas.findIndex((f) =>
      f.some((c) => String(c ?? "").startsWith("[")),
    );
    const datos = iTitulos >= 0 ? h.filas.length - iTitulos - 1 : h.filas.length;
    console.log(`  ${h.nombre.padEnd(26)} ${datos} filas a completar`);
  }
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
