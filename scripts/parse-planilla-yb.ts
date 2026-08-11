/**
 * Parsea la planilla que mandó Malala Yerba Buena
 * ("PLANILLA SERVICIOS MALALA YB + PRECIOS + RECETAS + INSUMOS.xlsx") y la
 * deja normalizada en scripts/data/yb-planilla-ago26.json, que es lo que
 * después consumen los scripts de carga.
 *
 * NO toca la base de datos: sólo lee el xlsx y escribe el JSON.
 *
 * Qué hace con cada hoja:
 *  - "Servicios ID Final" → servicios (226), productos de venta (53, rubros
 *    "Venta de productos capilares" y "Venta de joyas") y descarta "Otros
 *    Ingresos" (2, que son una comisión y un cheque, no servicios).
 *  - "insumos"            → catálogo de 116 insumos + proveedores.
 *  - "recetas"            → líneas (insumo, cantidad) por servicio.
 *  - "precios"            → lista vieja de costos, se usa sólo para completar
 *    envase/precio de los insumos que quedaron sin esos datos.
 *  - "insumos peluqueria" → se ignora: es un subconjunto de "insumos".
 *
 * Todo lo dudoso (precios invertidos, unidades que no coinciden, insumos sin
 * precio) se reporta por consola y queda anotado en `avisos` dentro del JSON.
 *
 * Uso: npx tsx scripts/parse-planilla-yb.ts [--xlsx <ruta>] [--out <ruta>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const XLSX_DEFAULT =
  "C:/Users/LBonilla-DIA/Downloads/PLANILLA SERVICIOS MALALA YB + PRECIOS + RECETAS + INSUMOS.xlsx";

// ---------------------------------------------------------------------------
// Lector mínimo de xlsx (un xlsx es un zip con XML adentro). Se implementa a
// mano para no sumar una dependencia al proyecto por un script de carga.
// ---------------------------------------------------------------------------

/** Descomprime el zip en memoria: devuelve nombre de archivo → contenido. */
function leerZip(buf: Buffer): Map<string, Buffer> {
  const archivos = new Map<string, Buffer>();
  // El End Of Central Directory está al final; se busca su firma hacia atrás.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("No es un zip válido (falta el EOCD)");

  const entradas = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < entradas; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Central directory corrupto");
    const metodo = buf.readUInt16LE(p + 10);
    const tamComprimido = buf.readUInt32LE(p + 20);
    const largoNombre = buf.readUInt16LE(p + 28);
    const largoExtra = buf.readUInt16LE(p + 30);
    const largoComentario = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    const nombre = buf.toString("utf8", p + 46, p + 46 + largoNombre);

    // El header local repite nombre y extra, con largos propios.
    const nombreLocal = buf.readUInt16LE(offsetLocal + 26);
    const extraLocal = buf.readUInt16LE(offsetLocal + 28);
    const inicio = offsetLocal + 30 + nombreLocal + extraLocal;
    const crudo = buf.subarray(inicio, inicio + tamComprimido);

    archivos.set(nombre, metodo === 0 ? crudo : inflateRawSync(crudo));
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
}

function desescapar(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

/** "AB" → 28. Las columnas de Excel son base-26 con letras. */
function columnaANumero(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Lee un xlsx y devuelve, por hoja, una matriz de strings (fila → columna). */
function leerXlsx(ruta: string): Map<string, string[][]> {
  const zip = leerZip(readFileSync(ruta));
  const texto = (n: string) => zip.get(n)?.toString("utf8") ?? "";

  const compartidas: string[] = [];
  for (const m of texto("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const partes = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => desescapar(t[1]));
    compartidas.push(partes.join(""));
  }

  const rels = new Map<string, string>();
  for (const m of texto("xl/_rels/workbook.xml.rels").matchAll(
    /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g,
  ))
    rels.set(m[1], m[2]);

  const hojas = new Map<string, string[][]>();
  for (const m of texto("xl/workbook.xml").matchAll(
    /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g,
  )) {
    const destino = (rels.get(m[2]) ?? "").replace(/^\//, "").replace(/^xl\//, "");
    const xml = texto(`xl/${destino}`);
    const filas: string[][] = [];
    for (const fm of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const celdas: string[] = [];
      // Ojo: hay celdas vacías auto-cerradas (<c r="Q4" s="7"/>) que deben
      // consumirse, si no se traga el contenido de las celdas siguientes.
      for (const cm of fm[2].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1];
        const cuerpo = cm[2] ?? "";
        const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
        const tipo = /t="([^"]+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo);
        let valor = v ? desescapar(v[1]) : "";
        if (tipo === "s" && v) valor = compartidas[Number(v[1])] ?? "";
        if (tipo === "inlineStr")
          valor = [...cuerpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
            .map((t) => desescapar(t[1]))
            .join("");
        if (ref) celdas[columnaANumero(ref) - 1] = valor;
      }
      filas[Number(fm[1]) - 1] = celdas;
    }
    hojas.set(desescapar(m[1]), filas);
  }
  return hojas;
}

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

const YB_ID = "seed-000002";

/** Rubros de la planilla que son servicios (se cobran, no descuentan stock). */
const RUBROS_SERVICIO = new Set([
  "Peluqueria",
  "Nails",
  "Cejas y pestañas",
  "Facial",
  "Masajes",
  "Corporal",
  "Gift Cards",
  "Promos",
]);

/** Rubros que en realidad son mercadería: van como insumos vendibles. */
const RUBROS_VENTA = new Set(["Venta de productos capilares", "Venta de joyas"]);

/** Unidades de la planilla → enum unidad_medida de la base. */
const UM: Record<string, "ml" | "g" | "ud" | "aplicacion"> = {
  ml: "ml",
  grs: "g",
  gr: "g",
  g: "g",
  ud: "ud",
  apl: "aplicacion",
};

/** Marcador que usaron en la planilla para "este servicio no se hace". */
const SIN_INSUMO = "no disponible";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Número tolerante a coma decimal y a celdas con texto ("Pendiente"). */
function num(s: string): number | null {
  const t = (s ?? "").toString().trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "50 ml" → 50; "1 ampolla (caja 12x13ml)" → 1; "" → null. */
function contenido(s: string): number | null {
  const m = /^\s*([\d.,]+)/.exec(s ?? "");
  return m ? num(m[1]) : null;
}

/**
 * "Alfaparf (Prodicos SAU, c/IVA)" → nombre "Alfaparf", nota "Prodicos SAU,
 * c/IVA". Los nombres que vienen todo en minúscula se capitalizan.
 */
function partirProveedor(bruto: string): { nombre: string; nota: string | null } {
  const m = /^([^(]+?)\s*(?:\((.+)\))?\s*$/.exec(bruto.trim());
  let nombre = (m?.[1] ?? bruto).trim();
  const nota = m?.[2]?.trim() ?? null;
  if (nombre === nombre.toLowerCase())
    nombre = nombre
      .split(" ")
      .map((p) => (["de", "del", "la"].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(" ");
  return { nombre, nota };
}

function slug(s: string): string {
  return norm(s).replace(/ /g, "-");
}

// ---------------------------------------------------------------------------
// Tipos del JSON de salida
// ---------------------------------------------------------------------------

export interface ServicioPlanilla {
  id: string;
  codigo: string;
  nombre: string;
  /** Rubro grueso de la planilla, sólo informativo. */
  rubroPlanilla: string;
  /** Lo que va a la columna `rubro` de la tabla servicios (el subrubro). */
  rubro: string;
  precioLista: number;
  precioEfectivo: number;
  activo: boolean;
  notaPrecio: string | null;
  preciosInvertidos: boolean;
}

export interface ProductoPlanilla {
  id: string;
  codigo: string;
  nombre: string;
  rubroPlanilla: string;
  precioVenta: number;
  precioVentaEfectivo: number | null;
  activo: boolean;
  notaPrecio: string | null;
}

export interface InsumoPlanilla {
  id: string;
  codigo: string;
  nombre: string;
  unidadMedida: "ml" | "g" | "ud" | "aplicacion";
  umPlanilla: string;
  proveedor: string | null;
  proveedorId: string | null;
  contenidoTexto: string | null;
  tamanoEnvase: number | null;
  precioEnvase: number | null;
  precioUnitario: number | null;
  /** De dónde salió el envase: la hoja "insumos" o la hoja vieja "precios". */
  fuentePrecio: "insumos" | "precios" | null;
  completo: boolean;
}

export interface ProveedorPlanilla {
  id: string;
  nombre: string;
  nota: string | null;
  etiquetas: string[];
  ivaIncluido: boolean | null;
}

export interface LineaRecetaPlanilla {
  insumoCodigo: string;
  insumoNombre: string;
  cantidad: number;
  umPlanilla: string;
  /** true si la unidad de la receta no coincide con la del insumo. */
  umDiscordante: boolean;
}

export interface RecetaPlanilla {
  servicioCodigo: string;
  servicioNombre: string;
  estado: string;
  confirmada: boolean;
  lineas: LineaRecetaPlanilla[];
}

export interface PlanillaYB {
  fuente: string;
  sucursalId: string;
  servicios: ServicioPlanilla[];
  productos: ProductoPlanilla[];
  insumos: InsumoPlanilla[];
  proveedores: ProveedorPlanilla[];
  recetas: RecetaPlanilla[];
  avisos: string[];
}

// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const arg = (n: string) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const rutaXlsx = arg("--xlsx") ?? XLSX_DEFAULT;
  const rutaOut =
    arg("--out") ??
    join(dirname(fileURLToPath(import.meta.url)), "data", "yb-planilla-ago26.json");

  const hojas = leerXlsx(rutaXlsx);
  const avisos: string[] = [];
  const celda = (f: string[] | undefined, i: number) => (f?.[i] ?? "").toString().trim();

  // ---- Hoja "precios" (lista vieja, sólo para completar envases) ----
  const preciosViejos = new Map<string, { proveedor: string; envase: number; medida: number; um: string }>();
  for (const f of hojas.get("precios")?.slice(2) ?? []) {
    const nombre = celda(f, 0);
    const precio = num(celda(f, 2));
    const medida = num(celda(f, 4));
    if (!nombre || precio === null || medida === null || medida === 0) continue;
    preciosViejos.set(norm(nombre), {
      proveedor: celda(f, 1),
      envase: precio,
      medida,
      um: celda(f, 3),
    });
  }

  // ---- Hoja "insumos" ----
  const proveedores = new Map<string, ProveedorPlanilla>();
  const insumos: InsumoPlanilla[] = [];

  for (const f of hojas.get("insumos")?.slice(2) ?? []) {
    const codigo = celda(f, 0);
    if (!codigo.startsWith("INS")) continue;
    const nombre = celda(f, 1);
    const umPlanilla = celda(f, 2);
    const unidadMedida = UM[umPlanilla.toLowerCase()];
    if (!unidadMedida) {
      avisos.push(`${codigo} ${nombre}: unidad "${umPlanilla}" desconocida, se cargó como "ud".`);
    }

    const brutoProveedor = celda(f, 3);
    let proveedorId: string | null = null;
    let proveedorNombre: string | null = null;
    if (brutoProveedor) {
      const { nombre: pn, nota } = partirProveedor(brutoProveedor);
      proveedorId = `prov-${slug(pn)}`;
      proveedorNombre = pn;
      const previo = proveedores.get(proveedorId);
      if (previo) {
        if (!previo.etiquetas.includes(brutoProveedor)) previo.etiquetas.push(brutoProveedor);
      } else {
        proveedores.set(proveedorId, {
          id: proveedorId,
          nombre: pn,
          nota,
          etiquetas: [brutoProveedor],
          // La planilla aclara "c/IVA" o "s/IVA" en el propio nombre.
          ivaIncluido: /s\/iva/i.test(brutoProveedor)
            ? false
            : /c\/iva/i.test(brutoProveedor)
              ? true
              : null,
        });
      }
    }

    const contenidoTexto = celda(f, 4) || null;
    let tamanoEnvase = contenido(celda(f, 4));
    let precioEnvase = num(celda(f, 5));
    let precioUnitario = num(celda(f, 6));
    let fuentePrecio: "insumos" | "precios" | null =
      tamanoEnvase !== null && precioEnvase !== null ? "insumos" : null;

    // Backfill desde la hoja vieja "precios" para los insumos a los que les
    // falta el envase (o directamente el precio).
    const viejo = preciosViejos.get(norm(nombre));
    if (viejo && (tamanoEnvase === null || precioEnvase === null)) {
      tamanoEnvase = viejo.medida;
      precioEnvase = viejo.envase;
      fuentePrecio = "precios";
      if (precioUnitario === null) precioUnitario = viejo.envase / viejo.medida;
      avisos.push(
        `${codigo} ${nombre}: envase completado desde la hoja "precios" ($${viejo.envase} / ${viejo.medida} ${viejo.um}).`,
      );
    }

    // Coherencia: el $ unitario de la planilla debería ser envase / contenido.
    if (tamanoEnvase && precioEnvase !== null && precioUnitario !== null) {
      const esperado = precioEnvase / tamanoEnvase;
      if (Math.abs(esperado - precioUnitario) / Math.max(precioUnitario, 1) > 0.02)
        avisos.push(
          `${codigo} ${nombre}: $ unitario ${precioUnitario} no coincide con ${precioEnvase}/${tamanoEnvase} = ${esperado.toFixed(2)}.`,
        );
    }

    insumos.push({
      id: `yb-${codigo}`,
      codigo,
      nombre,
      unidadMedida: unidadMedida ?? "ud",
      umPlanilla,
      proveedor: proveedorNombre,
      proveedorId,
      contenidoTexto,
      tamanoEnvase,
      precioEnvase,
      precioUnitario,
      fuentePrecio,
      completo: precioUnitario !== null,
    });
  }

  const insumoPorNombre = new Map(insumos.map((i) => [norm(i.nombre), i]));

  // ---- Hoja "Servicios ID Final" ----
  const servicios: ServicioPlanilla[] = [];
  const productos: ProductoPlanilla[] = [];
  const descartados: string[] = [];

  for (const f of hojas.get("Servicios ID Final")?.slice(2) ?? []) {
    const codigo = celda(f, 0);
    if (!codigo) continue;
    const nombre = celda(f, 1);
    const rubroPlanilla = celda(f, 2);
    const subrubro = celda(f, 3);
    const brutoLista = celda(f, 4);
    const brutoEfectivo = celda(f, 5);
    let lista = num(brutoLista);
    let efectivo = num(brutoEfectivo);
    const notaPrecio = lista === null ? brutoLista || null : null;

    if (RUBROS_VENTA.has(rubroPlanilla)) {
      productos.push({
        id: `yb-${codigo}`,
        codigo,
        nombre,
        rubroPlanilla,
        precioVenta: lista ?? 0,
        precioVentaEfectivo: efectivo,
        activo: lista !== null,
        notaPrecio,
      });
      continue;
    }
    if (!RUBROS_SERVICIO.has(rubroPlanilla)) {
      descartados.push(`${codigo} ${nombre} (${rubroPlanilla})`);
      continue;
    }

    let invertidos = false;
    if (lista !== null && efectivo !== null && efectivo > lista) {
      // Columnas invertidas en la planilla: el ratio exacto es 1.25 = 1/0.8.
      invertidos = true;
      [lista, efectivo] = [efectivo, lista];
    }

    servicios.push({
      id: `yb-${codigo}`,
      codigo,
      nombre,
      rubroPlanilla,
      rubro: subrubro || rubroPlanilla,
      precioLista: lista ?? 0,
      precioEfectivo: efectivo ?? 0,
      activo: lista !== null,
      notaPrecio,
      preciosInvertidos: invertidos,
    });
  }

  for (const d of descartados) avisos.push(`Fila descartada (no es servicio ni producto): ${d}`);

  const servicioPorCodigo = new Map(servicios.map((s) => [s.codigo, s]));
  const productoPorCodigo = new Map(productos.map((p) => [p.codigo, p]));

  // ---- Hoja "recetas" ----
  const recetas: RecetaPlanilla[] = [];
  for (const f of hojas.get("recetas")?.slice(3) ?? []) {
    const servicioCodigo = celda(f, 0);
    if (!servicioCodigo) continue;
    const servicioNombre = celda(f, 1);
    const estado = celda(f, 34) || "(sin estado)";

    if (!servicioPorCodigo.has(servicioCodigo)) {
      // Las recetas de productos/gift cards vienen como "No aplica" y no tienen
      // líneas: no hace falta avisar de esas.
      const lineasHuerfanas = [...Array(10).keys()].some((i) => celda(f, 4 + i * 3));
      if (lineasHuerfanas && !productoPorCodigo.has(servicioCodigo))
        avisos.push(`Receta ${servicioCodigo}: no hay servicio con ese código, se descarta.`);
      continue;
    }

    const lineas: LineaRecetaPlanilla[] = [];
    for (let i = 0; i < 10; i++) {
      const nombreInsumo = celda(f, 4 + i * 3);
      const umPlanilla = celda(f, 5 + i * 3);
      const cantidad = num(celda(f, 6 + i * 3));
      if (!nombreInsumo) continue;
      if (norm(nombreInsumo).startsWith(SIN_INSUMO)) {
        avisos.push(`Receta ${servicioCodigo}: marcada "${nombreInsumo}", se ignora la línea.`);
        continue;
      }
      const insumo = insumoPorNombre.get(norm(nombreInsumo));
      if (!insumo) {
        avisos.push(
          `Receta ${servicioCodigo}: el insumo "${nombreInsumo}" no está en el catálogo, se descarta la línea.`,
        );
        continue;
      }
      if (cantidad === null || cantidad <= 0) {
        avisos.push(
          `Receta ${servicioCodigo} / ${nombreInsumo}: cantidad inválida ("${celda(f, 6 + i * 3)}"), se descarta la línea.`,
        );
        continue;
      }
      const umDiscordante = (UM[umPlanilla.toLowerCase()] ?? null) !== insumo.unidadMedida;
      if (umDiscordante)
        avisos.push(
          `Receta ${servicioCodigo} / ${insumo.codigo} ${insumo.nombre}: la receta dice "${umPlanilla}" pero el insumo se mide en "${insumo.umPlanilla}". Se carga la cantidad tal cual, a confirmar.`,
        );
      lineas.push({
        insumoCodigo: insumo.codigo,
        insumoNombre: insumo.nombre,
        cantidad,
        umPlanilla,
        umDiscordante,
      });
    }

    recetas.push({
      servicioCodigo,
      servicioNombre,
      estado,
      confirmada: /^completa/i.test(estado),
      lineas,
    });
  }

  const salida: PlanillaYB = {
    fuente: rutaXlsx.split(/[\\/]/).pop() ?? rutaXlsx,
    sucursalId: YB_ID,
    servicios,
    productos,
    insumos,
    proveedores: [...proveedores.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    recetas,
    avisos,
  };

  writeFileSync(rutaOut, `${JSON.stringify(salida, null, 2)}\n`, "utf8");

  // ---- Reporte ----
  const lineas = recetas.reduce((a, r) => a + r.lineas.length, 0);
  const confirmadas = recetas.filter((r) => r.confirmada);
  console.log("=== PLANILLA YERBA BUENA · agosto 2026 ===");
  console.log(`  Fuente: ${salida.fuente}`);
  console.log(`  Salida: ${rutaOut}\n`);
  console.log(`  Servicios: ${servicios.length} (${servicios.filter((s) => !s.activo).length} sin precio → inactivos)`);
  const porRubro = new Map<string, number>();
  for (const s of servicios) porRubro.set(s.rubro, (porRubro.get(s.rubro) ?? 0) + 1);
  for (const [r, n] of [...porRubro].sort((a, b) => b[1] - a[1]))
    console.log(`      ${String(n).padStart(3)}  ${r}`);
  const invertidos = servicios.filter((s) => s.preciosInvertidos);
  console.log(`\n  Precios invertidos corregidos: ${invertidos.length}`);
  for (const s of invertidos)
    console.log(`      ${s.codigo} ${s.nombre} → lista ${s.precioLista} / efectivo ${s.precioEfectivo}`);

  console.log(`\n  Productos de venta: ${productos.length} (${productos.filter((p) => !p.activo).length} sin precio)`);
  console.log(`  Insumos: ${insumos.length} (${insumos.filter((i) => !i.completo).length} sin precio unitario)`);
  console.log(`      con envase conocido: ${insumos.filter((i) => i.tamanoEnvase !== null).length}`);
  console.log(`      completados desde la hoja "precios": ${insumos.filter((i) => i.fuentePrecio === "precios").length}`);
  console.log(`  Proveedores: ${salida.proveedores.length}`);
  for (const p of salida.proveedores)
    console.log(`      ${p.id.padEnd(28)} ${p.nombre}${p.ivaIncluido === false ? "  (precios SIN IVA)" : ""}`);

  console.log(`\n  Recetas: ${recetas.length} servicios, ${lineas} líneas`);
  console.log(`      confirmadas: ${confirmadas.length} servicios / ${confirmadas.reduce((a, r) => a + r.lineas.length, 0)} líneas`);
  console.log(`      propuestas:  ${recetas.length - confirmadas.length} servicios / ${lineas - confirmadas.reduce((a, r) => a + r.lineas.length, 0)} líneas`);
  const estados = new Map<string, number>();
  for (const r of recetas) estados.set(r.estado, (estados.get(r.estado) ?? 0) + 1);
  for (const [e, n] of [...estados].sort((a, b) => b[1] - a[1]))
    console.log(`      ${String(n).padStart(3)}  ${e}`);
  const sinCosto = recetas
    .flatMap((r) => r.lineas)
    .filter((l) => !insumoPorNombre.get(norm(l.insumoNombre))?.completo).length;
  console.log(`\n  Líneas que apuntan a un insumo sin precio: ${sinCosto} de ${lineas}`);

  console.log(`\n  Avisos: ${avisos.length}`);
  for (const a of avisos) console.log(`      · ${a}`);
}

main();
