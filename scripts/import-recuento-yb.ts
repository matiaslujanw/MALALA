/**
 * Carga en Malala Yerba Buena (seed-000002) el recuento físico de stock que
 * hizo el salón, a partir de los dos xlsx que mandaron:
 *   - "recuento fisico insumos yerba buena.xlsx"   (depósito de peluquería)
 *   - "recuento fisico reventa yerba buena.xlsx"   (productos que se venden)
 *
 * Dos cosas que hay que entender para leer esto:
 *
 * 1. EL RECUENTO ES POR TONO Y EL CATÁLOGO NO. El salón contó 21 tonos de
 *    tintura Inoa por separado, pero el sistema tiene un único insumo
 *    "Tintura INOA" medido en gramos, que es como lo consumen las recetas. Por
 *    eso se suman todos los tonos de una misma línea en un solo insumo.
 *
 * 2. EL RECUENTO ESTÁ EN ENVASES Y EL STOCK EN ML/GR. El salón contó pomos y
 *    frascos; el sistema descuenta gramos y mililitros. La conversión es
 *    unidades × tamaño del envase. Los insumos a los que todavía no les
 *    sabemos el envase NO se pueden convertir: se listan y quedan sin cargar.
 *
 * El mapeo recuento→catálogo está abajo en MAPEO, explícito y comentado, para
 * que se pueda revisar y corregir a mano sin tocar el resto del script.
 *
 * El movimiento se registra como `ajuste_manual` con motivo "Recuento físico",
 * que es lo que hace la pantalla de Stock → Ajuste manual, así que queda en el
 * historial igual que si lo hubieran cargado a mano.
 *
 * Dry-run salvo --commit.
 * Uso: npx tsx scripts/import-recuento-yb.ts [--commit] [--insumos <ruta>] [--reventa <ruta>]
 */
import "../envConfig";
import { and, eq } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  insumos as insumosTable,
  profiles as profilesTable,
  stockSucursal as stockSucursalTable,
} from "../src/lib/db/schema";
import { applyMovementTx } from "../src/lib/data/stock";
import { leerXlsx } from "./lib/xlsx";

const YB_ID = "seed-000002";
const USUARIO_EMAIL = "admin.yb@malala.com";

const XLSX_INSUMOS =
  "C:/Users/LBonilla-DIA/Downloads/recuento fisico insumos yerba buena.xlsx";
const XLSX_REVENTA =
  "C:/Users/LBonilla-DIA/Downloads/recuento fisico reventa yerba buena.xlsx";

/**
 * Mapeo del recuento al catálogo.
 *   - clave: como figura en el recuento ("Categoría :: Marca" en insumos, el
 *     nombre del producto en reventa).
 *   - valor: código del catálogo, o null si ese producto no está cargado.
 * Revisado por dos pasadas independientes; los null son a propósito.
 */
const MAPEO: Record<string, string | null> = {
  // ---------- Insumos de bacha: tinturas ----------
  "Tintura :: L'Oréal Inoa": "INS117",
  "Tintura :: L'Oréal Majirel": "INS118",
  "Tintura :: L'Oréal Dia Color": "INS115",
  "Tintura :: L'Oréal Dia Light": "INS116",
  "Tintura :: Schwarzkopf Igora Royal": "INS310",
  "Tintura :: Schwarzkopf Highlifts": "INS309",
  "Tintura :: Question Professional": "INS207",
  "Tintura :: Question Professional Lumiplex Color": "INS206",
  // Absolutes y Fashion Lights NO se vuelcan a Igora Royal aunque sean del
  // mismo sistema: el catálogo ya distingue sublíneas de Igora (Highlifts tiene
  // entrada propia), así que la ausencia de estas dos es una ausencia real.
  // Cargarlas en Igora Royal inflaría el stock de un insumo que cotiza distinto
  // y ensuciaría el costo de todos los servicios de coloración.
  "Tintura :: Schwarzkopf Absolutes": null,
  "Tintura :: Schwarzkopf Fashion Lights": null,
  "Tintura :: Livesolut Color": null,

  // ---------- Oxidantes y decolorantes ----------
  // Ojo: el oxidante de una línea NO es la tintura de esa línea.
  "Oxidante :: L'Oréal Inoa Oil Developer": "INS106",
  "Oxidante :: L'Oréal Dia Activateur": "INS105",
  "Oxidante :: Schwarzkopf Igora Royal Oil Developer": "INS304",
  "Oxidante :: Question Professional Lumiplex Color": "INS203",
  "Oxidante :: Question Professional Crema Oxigenada": null,
  "Oxidante :: Question Professional Revelador Superaclarante": null,
  "Oxidante :: New Blond Crema Oxigenada": null,
  // El bidón de 5 L calza con el envase de INS839, pero ese insumo es el granel
  // sin marca que provee José: coincidir en el envase no prueba que sea el
  // mismo producto físico.
  "Oxidante (bidón genérico) :: Hairkadus Kadus Color": null,
  "Polvo decolorante :: SOW Pro-Plex": "INS708",
  "Polvo decolorante :: FarmaVita Suprema Color Blue": "INS707",

  // ---------- Ampollas y tratamientos ----------
  "Ampollas (Beauty Genesis Elixir Renovador, caja x12) :: Alfaparf Milano Semi di Lino Sublime":
    "INS002",
  "Ampollas (Ampolla Repair, caja x12) :: Exiline Cosméticos Biocell Repair": "INS601",
  "Ampollas (Ampolla Complex, caja x12) :: Biocell Therapy": null,
  // La revisión de la planilla dio de alta el insumo, así que ahora tiene dónde ir.
  "Ampollas/Tratamiento :: SOW Must Hair Elixir 21 (caja x10 ampollas)": "INS710",
  "Tratamiento (Restructuring Multiplier) :: Alfaparf Milano Semi di Lino Sublime": "INS003",
  "Shampoo :: Olaplex No.4P Blonde Enhancer Toning Shampoo": "INS504",
  "Aceite (Bonding Oil) :: Olaplex No.7": "INS503",
  "Shampoo Pre-Técnico (Alisado Luminoliss) :: Adriano Cosméticos Lumino Clean": null,

  // ---------- Productos de reventa ----------
  "Absolut Repair Shampoo 300ml": "VPC136",
  "Absolut Repair Acondicionador 200ml": "VPC137",
  "Absolut Repair Mascarilla": "VPC138",
  "Absolut Repair Oil 90ml": "VPC119",
  "Absolut Repair Molecular Shampoo 300ml": "VPC118",
  "Absolut Repair Molecular Mascarilla 250ml": "VPC117",
  "Absolut Repair Molecular Leave-in Mask 100ml": "VPC120",
  "Absolut Repair Molecular Sérum Rinse-off 250ml": null,
  "Absolut Repair Molecular Pre-Tratamiento Concentrado 190ml": null,
  "Vitamino Color Shampoo 300ml": "VPC128",
  "Vitamino Color Acondicionador 200ml": "VPC130",
  "Vitamino Color Mascarilla 250ml": "VPC131",
  "Vitamino Color Lait 10-en-1 190ml": "VPC129",
  "Vitamino Color Spectrum Serum 50ml": "VPC135",
  "Ultimate Repair Night Serum 30ml": "VPC103",
  "Ultimate Repair Miracle Hair Rescue 30ml": "VPC113",
  "Ultimate Smooth Mask 150ml": "VPC107",
  "Ultimate Smooth Miracle Oil Serum 30ml": "VPC108",
  "Maca Power Collagen Mascarilla 500ml": "VPC111",
  "Maca Power Essence Oil 50ml": "VPC124",
  "Twelve 12 Benef en 1 Tratamiento sin enjuague 210ml": "VPC112",
  "Silver Shampoo 200ml": "VPC114",
  "Keratin Lift Spray": "VPC127",
  "Q Style Termic Protect 240ml": "VPC126",
  "Pearl Suero Argán Perfeccionador de Brillo 30ml": "VPC122",
  "Biocell Repair Active Repair 300ml": "VPC140",
  "Biocell Repair Serum 100ml": "VPC141",
  "Biocell Repair Shampoo 300ml": "VPC139",
  "Bed Head Hair Stick 73g": "VPC100",
  "Bed Head After Party Smoothing Cream 50ml": "VPC115",
  "Bed Head Straighten Out Serum 100ml": "VPC116",
  "Small Talk Thickening Cream": "VPC101",
  "Keratin Alpha Sleek Máscara 250ml": null,
  "Keratin Alpha Sleek Shampoo 300ml": null,
  "Keratin Alpha Sleek Smooth Transformer 200ml": null,
  "Keratin Alpha Sleek Serum Discipline Miroir 50ml": null,
  "Lumière Óleo Tratante Capilar con Aceite de Argán": null,
  "Q Style Curl Cream 235ml": null,
  "Q Style Oil Molecular Flex 75ml": null,
  "Keratin Lift Óleo Tratante con Vitamina E y Aceite de Chía": null,
};

/** Motivo de los null: qué es el producto y por qué no está en el catálogo. */
const SIN_CATALOGO: Record<string, string> = {
  "Tintura :: Livesolut Color": "marca que no figura en el catálogo",
  "Tintura :: Schwarzkopf Absolutes":
    "sublínea de Igora sin entrada propia; el catálogo sí separa Highlifts, así que falta de verdad",
  "Tintura :: Schwarzkopf Fashion Lights":
    "sublínea aclarante de Igora sin entrada propia (está más cerca de Highlifts que de Royal)",
  "Oxidante (bidón genérico) :: Hairkadus Kadus Color":
    "el bidón de 5 L del catálogo es el granel sin marca de José; coincide el envase pero no la marca",
  "Oxidante :: Question Professional Crema Oxigenada":
    "el catálogo sólo tiene el oxidante Lumiplex de Question",
  "Oxidante :: Question Professional Revelador Superaclarante": "no está en el catálogo",
  "Oxidante :: New Blond Crema Oxigenada": "marca que no figura en el catálogo",
  "Ampollas (Ampolla Complex, caja x12) :: Biocell Therapy":
    "el catálogo tiene una sola ampolla Exiline y ya la usa la Ampolla Repair",
  "Ampollas/Tratamiento :: SOW Must Hair Elixir 21 (caja x10 ampollas)":
    "marca que no figura en el catálogo",
  "Shampoo Pre-Técnico (Alisado Luminoliss) :: Adriano Cosméticos Lumino Clean":
    "el shampoo pre-técnico no es el alisado Luminoliss; son dos productos distintos",
  "Absolut Repair Molecular Sérum Rinse-off 250ml": "no está en el catálogo de reventa",
  "Absolut Repair Molecular Pre-Tratamiento Concentrado 190ml":
    "no está en el catálogo de reventa",
  "Keratin Alpha Sleek Máscara 250ml": "la línea Keratin Alpha Sleek se usa en bacha, no se vende",
  "Keratin Alpha Sleek Shampoo 300ml": "idem",
  "Keratin Alpha Sleek Smooth Transformer 200ml": "idem",
  "Keratin Alpha Sleek Serum Discipline Miroir 50ml": "idem",
  "Lumière Óleo Tratante Capilar con Aceite de Argán": "no está en el catálogo de reventa",
  "Q Style Curl Cream 235ml": "no está en el catálogo de reventa",
  "Q Style Oil Molecular Flex 75ml": "no está en el catálogo de reventa",
  "Keratin Lift Óleo Tratante con Vitamina E y Aceite de Chía":
    "el catálogo sólo tiene el spray Keratin Lift",
};

type Fila = { clave: string; uds: number; detalle: string };

function num(s: string): number {
  const n = Number((s ?? "").toString().trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Agrupa el recuento de insumos por "Categoría :: Marca", sumando los tonos. */
function leerInsumos(ruta: string): Fila[] {
  const hoja = leerXlsx(ruta).get("Recuento Insumos") ?? [];
  const g = new Map<string, { uds: number; tonos: string[] }>();
  for (const f of hoja.slice(6)) {
    const categoria = (f?.[1] ?? "").trim();
    const marca = (f?.[2] ?? "").trim();
    if (!marca) continue;
    const clave = `${categoria || "?"} :: ${marca}`;
    if (!g.has(clave)) g.set(clave, { uds: 0, tonos: [] });
    const e = g.get(clave)!;
    e.uds += num(f?.[4] ?? "");
    const tono = (f?.[3] ?? "").trim();
    if (tono) e.tonos.push(`${tono}:${num(f?.[4] ?? "")}`);
  }
  return [...g].map(([clave, e]) => ({
    clave,
    uds: e.uds,
    detalle: e.tonos.length ? `${e.tonos.length} tonos` : "",
  }));
}

/** El recuento de reventa es una fila por producto, sin agrupar. */
function leerReventa(ruta: string): Fila[] {
  const hoja = leerXlsx(ruta).get("Recuento Reventa") ?? [];
  const filas: Fila[] = [];
  for (const f of hoja.slice(6)) {
    const nombre = (f?.[1] ?? "").trim();
    if (!nombre) continue;
    filas.push({ clave: nombre, uds: num(f?.[4] ?? ""), detalle: (f?.[2] ?? "").trim() });
  }
  return filas;
}

async function main() {
  const commit = process.argv.includes("--commit");
  const arg = (n: string) => {
    const i = process.argv.indexOf(n);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };

  const recuento = [
    ...leerInsumos(arg("--insumos") ?? XLSX_INSUMOS),
    ...leerReventa(arg("--reventa") ?? XLSX_REVENTA),
  ];

  const db = getDb();
  const [usuario] = await db
    .select({ id: profilesTable.userId })
    .from(profilesTable)
    .where(eq(profilesTable.email, USUARIO_EMAIL))
    .limit(1);
  if (!usuario) throw new Error(`No existe el perfil ${USUARIO_EMAIL}`);

  const catalogo = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.sucursalId, YB_ID));
  const porCodigo = new Map(catalogo.filter((i) => i.codigo).map((i) => [i.codigo!, i]));

  // A los insumos sin envase conocido la carga inicial les puso 1/0 de relleno,
  // así que en la base no se distingue un envase de 1 ml (que no existe) de un
  // dato faltante. Ese par exacto es la marca del relleno: un envase real de una
  // unidad siempre tiene precio (una ampolla, una lima).
  const esRelleno = (i: (typeof catalogo)[number]) =>
    i.tamanoEnvase === 1 && i.precioEnvase === 0;

  const aCargar: Array<{
    claves: string[];
    insumo: (typeof catalogo)[number];
    uds: number;
    objetivo: number;
  }> = [];
  const sinMapear: Fila[] = [];
  const sinEnvase: Array<{ clave: string; uds: number; codigo: string; nombre: string }> = [];
  const codigoDesconocido: Array<{ clave: string; codigo: string }> = [];

  // Varias líneas del recuento pueden caer en el mismo insumo (las sublíneas de
  // Igora, por ejemplo). Hay que SUMARLAS antes de calcular nada: si se
  // aplicaran de a una, cada ajuste pisaría al anterior en vez de acumularse.
  const porInsumo = new Map<string, { uds: number; claves: string[] }>();
  for (const f of recuento) {
    const codigo = f.clave in MAPEO ? MAPEO[f.clave] : null;
    if (!codigo) {
      sinMapear.push(f);
      continue;
    }
    if (!porInsumo.has(codigo)) porInsumo.set(codigo, { uds: 0, claves: [] });
    const e = porInsumo.get(codigo)!;
    e.uds += f.uds;
    e.claves.push(f.clave);
  }

  for (const [codigo, e] of porInsumo) {
    const insumo = porCodigo.get(codigo);
    if (!insumo) {
      codigoDesconocido.push({ clave: e.claves.join(" + "), codigo });
      continue;
    }
    // Los productos de venta se cuentan y se guardan en unidades; los de bacha
    // se cuentan en envases y se guardan en ml/gr.
    const esUnidad = insumo.tipo === "venta" || insumo.unidadMedida === "ud";
    const envase = esUnidad ? 1 : insumo.tamanoEnvase;
    if (!esUnidad && (esRelleno(insumo) || !envase || envase <= 0)) {
      sinEnvase.push({ clave: e.claves.join(" + "), uds: e.uds, codigo, nombre: insumo.nombre });
      continue;
    }
    aCargar.push({ claves: e.claves, insumo, uds: e.uds, objetivo: e.uds * envase });
  }

  // ---- Reporte ----
  console.log("=== RECUENTO FÍSICO · YERBA BUENA ===\n");
  console.log(`  Líneas del recuento: ${recuento.length}`);
  console.log(`  A cargar: ${aCargar.length}\n`);

  const fmt = (n: number) => n.toLocaleString("es-AR");
  let valor = 0;
  for (const c of aCargar.sort((a, b) => a.insumo.nombre.localeCompare(b.insumo.nombre))) {
    const um = c.insumo.unidadMedida;
    const v = (c.insumo.precioUnitario ?? 0) * c.objetivo;
    valor += v;
    const envase = c.objetivo / c.uds;
    console.log(
      `      ${(c.insumo.codigo ?? "").padEnd(7)} ${c.insumo.nombre.slice(0, 34).padEnd(34)} ${String(c.uds).padStart(4)} env × ${String(envase).padStart(5)} = ${fmt(c.objetivo).padStart(9)} ${um.padEnd(3)}${c.insumo.precioUnitario == null ? " (sin precio)" : ` $${fmt(Math.round(v))}`}${c.claves.length > 1 ? `   [${c.claves.length} líneas del recuento]` : ""}`,
    );
  }
  console.log(`\n  Valor del stock a cargar: $${fmt(Math.round(valor))}`);

  if (sinEnvase.length) {
    console.log(
      `\n  ⚠ Sin tamaño de envase, no se puede convertir a ${"ml/gr"} (${sinEnvase.length}):`,
    );
    for (const s of sinEnvase)
      console.log(`      ${s.codigo} ${s.nombre} · contaron ${s.uds} env.`);
  }
  if (codigoDesconocido.length) {
    console.log(`\n  ⚠ Códigos que no existen en el catálogo (${codigoDesconocido.length}):`);
    for (const c of codigoDesconocido) console.log(`      ${c.codigo} ← ${c.clave}`);
  }
  if (sinMapear.length) {
    console.log(`\n  ⚠ Sin correlato en el catálogo (${sinMapear.length}):`);
    for (const s of sinMapear)
      console.log(`      ${String(s.uds).padStart(4)} env · ${s.clave}${SIN_CATALOGO[s.clave] ? ` — ${SIN_CATALOGO[s.clave]}` : ""}`);
  }

  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);
  await db.transaction(async (tx) => {
    for (const c of aCargar) {
      // El recuento es un valor ABSOLUTO ("hay 59 pomos") y applyMovementTx
      // aplica un delta, así que se descuenta lo que ya figuraba: el stock
      // queda exactamente en lo contado aunque el insumo no arrancara en cero.
      const [actual] = await tx
        .select({ cantidad: stockSucursalTable.cantidad })
        .from(stockSucursalTable)
        .where(
          and(
            eq(stockSucursalTable.insumoId, c.insumo.id),
            eq(stockSucursalTable.sucursalId, YB_ID),
          ),
        )
        .limit(1);
      const delta = c.objetivo - (actual?.cantidad ?? 0);
      if (delta === 0) continue;
      await applyMovementTx(tx, {
        insumo_id: c.insumo.id,
        sucursal_id: YB_ID,
        delta,
        tipo: "ajuste_manual",
        motivo: `Recuento físico ${hoy}`,
        usuario_id: usuario.id,
      });
    }
  });

  console.log(`\n✔ Cargadas ${aCargar.length} líneas del recuento.`);
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
