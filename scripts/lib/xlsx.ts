/**
 * Lector mínimo de xlsx para los scripts de carga: un xlsx es un zip con XML
 * adentro, así que se descomprime y se parsea a mano. Se implementa acá en vez
 * de sumar una dependencia al proyecto por un par de scripts que corren una vez.
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

/** Descomprime el zip en memoria: devuelve nombre de archivo → contenido. */
export function leerZip(buf: Buffer): Map<string, Buffer> {
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

export function desescapar(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

/** "AB" → 28. Las columnas de Excel son base-26 con letras. */
export function columnaANumero(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Lee un xlsx y devuelve, por hoja, una matriz de strings (fila → columna). */
export function leerXlsx(ruta: string): Map<string, string[][]> {
  const zip = leerZip(readFileSync(ruta));
  const texto = (n: string) => zip.get(n)?.toString("utf8") ?? "";

  const compartidas: string[] = [];
  for (const m of texto("xl/sharedStrings.xml").matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)) {
    const partes = [...m[1].matchAll(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((t) => desescapar(t[1]));
    compartidas.push(partes.join(""));
  }

  // Los atributos vienen en cualquier orden según qué programa haya escrito el
  // archivo (Id/Target o Type/Target/Id), así que se lee cada tag entero y
  // después se sacan los atributos por separado.
  const atributo = (tag: string, nombre: string) =>
    new RegExp(`${nombre}="([^"]*)"`).exec(tag)?.[1];

  const rels = new Map<string, string>();
  for (const m of texto("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)) {
    const id = atributo(m[0], "Id");
    const target = atributo(m[0], "Target");
    if (id && target) rels.set(id, target);
  }

  const hojas = new Map<string, string[][]>();
  for (const tag of texto("xl/workbook.xml").matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
    const nombreHoja = atributo(tag[0], "name");
    const rid = atributo(tag[0], "r:id");
    if (!nombreHoja || !rid) continue;
    const destino = (rels.get(rid) ?? "").replace(/^\//, "").replace(/^xl\//, "");
    if (!destino) continue;
    const xml = texto(`xl/${destino}`);
    const filas: string[][] = [];
    for (const fm of xml.matchAll(/<(?:\w+:)?row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
      const celdas: string[] = [];
      // Ojo: hay celdas vacías auto-cerradas (<c r="Q4" s="7"/>) que deben
      // consumirse, si no se traga el contenido de las celdas siguientes.
      for (const cm of fm[2].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
        const attrs = cm[1];
        const cuerpo = cm[2] ?? "";
        const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
        const tipo = /t="([^"]+)"/.exec(attrs)?.[1];
        const v = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(cuerpo);
        let valor = v ? desescapar(v[1]) : "";
        if (tipo === "s" && v) valor = compartidas[Number(v[1])] ?? "";
        if (tipo === "inlineStr")
          valor = [...cuerpo.matchAll(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)]
            .map((t) => desescapar(t[1]))
            .join("");
        if (ref) celdas[columnaANumero(ref) - 1] = valor;
      }
      filas[Number(fm[1]) - 1] = celdas;
    }
    hojas.set(desescapar(nombreHoja), filas);
  }
  return hojas;
}

