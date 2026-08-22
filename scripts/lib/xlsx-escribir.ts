/**
 * Escritor mínimo de xlsx para los scripts de carga. Complementa a ./xlsx (el
 * lector) y, como él, se implementa a mano para no sumar una dependencia al
 * proyecto: un xlsx es un zip con unos pocos XML adentro.
 *
 * Los archivos van SIN comprimir (método "stored"): son planillas de unas pocas
 * hojas, y así el zip no depende de que el deflate y el CRC coincidan.
 *
 * Los textos se escriben inline (t="inlineStr") en vez de en sharedStrings:
 * ocupa un poco más pero evita mantener la tabla de strings, y el lector de
 * ./xlsx los entiende igual.
 */
import { writeFileSync } from "node:fs";

export type Celda = string | number | null | undefined;

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function escapar(s: string): string {
  return (
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      // Los caracteres de control rompen el XML y Excel se niega a abrir el
      // archivo con un error que no explica nada. Se sacan antes.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  );
}

/** 1 → "A", 27 → "AA". */
export function numeroAColumna(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function hojaXml(filas: Celda[][], anchos?: number[]): string {
  const cols = anchos?.length
    ? `<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const cuerpo = filas
    .map((fila, f) => {
      const celdas = fila
        .map((valor, c) => {
          if (valor == null || valor === "") return "";
          const ref = `${numeroAColumna(c + 1)}${f + 1}`;
          if (typeof valor === "number" && Number.isFinite(valor))
            return `<c r="${ref}" t="n"><v>${valor}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapar(String(valor))}</t></is></c>`;
        })
        .join("");
      return celdas ? `<row r="${f + 1}">${celdas}</row>` : "";
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${cuerpo}</sheetData></worksheet>`;
}

export interface Hoja {
  nombre: string;
  filas: Celda[][];
  /** Ancho de cada columna, en caracteres. */
  anchos?: number[];
}

/** Arma el zip: cada archivo va guardado sin comprimir. */
function armarZip(archivos: Array<{ nombre: string; datos: Buffer }>): Buffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let offset = 0;
  // Fecha fija (2026-01-01): un 0 acá lo rechazan algunos lectores.
  const hora = 0;
  const fecha = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre, "utf8");
    const crc = crc32(a.datos);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(fecha, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(a.datos.length, 18);
    local.writeUInt32LE(a.datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombre, a.datos);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(fecha, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(a.datos.length, 20);
    central.writeUInt32LE(a.datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrales.push(central, nombre);

    offset += local.length + nombre.length + a.datos.length;
  }

  const cd = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(cd.length, 12);
  fin.writeUInt32LE(offset, 16);
  fin.writeUInt16LE(0, 20);

  return Buffer.concat([...locales, cd, fin]);
}

export function escribirXlsx(ruta: string, hojas: Hoja[]): void {
  if (!hojas.length) throw new Error("Hace falta al menos una hoja");

  const archivos: Array<{ nombre: string; datos: Buffer }> = [];
  const txt = (s: string) => Buffer.from(s, "utf8");

  archivos.push({
    nombre: "[Content_Types].xml",
    datos: txt(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hojas
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join("")}</Types>`,
    ),
  });

  archivos.push({
    nombre: "_rels/.rels",
    datos: txt(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
  });

  archivos.push({
    nombre: "xl/workbook.xml",
    datos: txt(
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas
        .map(
          (h, i) =>
            // Excel corta los nombres de hoja a 31 caracteres y no acepta : \ / ? * [ ]
            `<sheet name="${escapar(h.nombre.replace(/[:\\/?*[\]]/g, " ").slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
        )
        .join("")}</sheets></workbook>`,
    ),
  });

  archivos.push({
    nombre: "xl/_rels/workbook.xml.rels",
    datos: txt(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join("")}</Relationships>`,
    ),
  });

  hojas.forEach((h, i) => {
    archivos.push({
      nombre: `xl/worksheets/sheet${i + 1}.xml`,
      datos: txt(hojaXml(h.filas, h.anchos)),
    });
  });

  writeFileSync(ruta, armarZip(archivos));
}
