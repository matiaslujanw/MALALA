/**
 * Genera un par de claves VAPID (P-256) para el web push.
 *
 * POR QUÉ EXISTE: las claves que había en .env.local eran texto de relleno —la
 * pública tenía 27 bytes en vez de 65 y no empezaba con 0x04—, y como
 * isWebPushConfigured() sólo miraba que la variable no estuviera vacía, la app
 * mostraba el botón de suscribirse como si todo estuviera configurado y recién
 * fallaba cuando alguien lo apretaba. Este script deja el par correcto y
 * repetible, sin depender de instalar la CLI de web-push.
 *
 * OJO AL CAMBIARLAS: las suscripciones existentes quedan invalidadas, porque el
 * navegador las ata a la clave pública con la que se crearon. Hay que borrar
 * push_subscriptions y que cada persona vuelva a suscribirse.
 *
 * La privada NO se imprime completa a propósito: se escribe al archivo y en
 * pantalla sólo se muestra su huella, para poder comparar contra Vercel sin
 * exponerla en un log o en una captura.
 *
 * Uso:
 *   npx tsx scripts/generar-vapid.ts            (muestra qué haría)
 *   npx tsx scripts/generar-vapid.ts --escribir (las escribe en .env.local)
 */
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ARCHIVO = ".env.local";

function bufferToBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generarPar() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });

  // La pública va como punto sin comprimir: 65 bytes que arrancan con 0x04.
  // jwk.x e jwk.y son las dos mitades de 32 bytes.
  const jwk = publicKey.export({ format: "jwk" }) as {
    x: string;
    y: string;
    d?: string;
  };
  const jwkPriv = privateKey.export({ format: "jwk" }) as { d: string };

  const x = Buffer.from(jwk.x, "base64url");
  const y = Buffer.from(jwk.y, "base64url");
  const d = Buffer.from(jwkPriv.d, "base64url");

  const pub = Buffer.concat([Buffer.from([0x04]), x, y]);

  return {
    publica: bufferToBase64Url(pub),
    privada: bufferToBase64Url(d),
    bytesPublica: pub.length,
    bytesPrivada: d.length,
  };
}

function huella(valor: string): string {
  return createHash("sha256").update(valor).digest("hex").slice(0, 12);
}

/** Reemplaza la línea de una variable, o la agrega si no estaba. */
function setEnv(contenido: string, clave: string, valor: string): string {
  const linea = `${clave}=${valor}`;
  const re = new RegExp(`^${clave}=.*$`, "m");
  return re.test(contenido)
    ? contenido.replace(re, linea)
    : contenido.trimEnd() + `\n${linea}\n`;
}

function main() {
  const escribir = process.argv.includes("--escribir");
  const par = generarPar();

  console.log("=== PAR VAPID NUEVO ===\n");
  console.log(`  pública   ${par.bytesPublica} bytes  (correcto: 65)`);
  console.log(`  privada   ${par.bytesPrivada} bytes  (correcto: 32)`);
  console.log(`\n  NEXT_PUBLIC_VAPID_PUBLIC_KEY=${par.publica}`);
  console.log(`  VAPID_PRIVATE_KEY=<oculta · huella ${huella(par.privada)}>`);
  console.log(
    "\n  La pública es pública (viaja al navegador). La privada no se imprime:",
  );
  console.log("  se escribe al archivo y se compara por huella.");

  if (!escribir) {
    console.log("\nDRY-RUN: no se tocó nada. Corré con --escribir.");
    return;
  }

  if (!existsSync(ARCHIVO)) {
    console.error(`\nNo existe ${ARCHIVO}.`);
    process.exit(1);
  }

  let contenido = readFileSync(ARCHIVO, "utf8");
  contenido = setEnv(contenido, "NEXT_PUBLIC_VAPID_PUBLIC_KEY", par.publica);
  contenido = setEnv(contenido, "VAPID_PRIVATE_KEY", par.privada);
  if (!/^VAPID_SUBJECT=/m.test(contenido)) {
    contenido = setEnv(contenido, "VAPID_SUBJECT", "mailto:admin@malala.com");
  }
  writeFileSync(ARCHIVO, contenido);

  console.log(`\n✔ Escritas en ${ARCHIVO}.`);
  console.log("\n  FALTA HACER A MANO, sin esto no anda en producción:");
  console.log("   1. Cargar las TRES variables en Vercel (Production y Preview).");
  console.log("   2. Redeploy: las env se leen en build time.");
  console.log("   3. Si ya había suscripciones, borrarlas — quedaron invalidadas.");
}

main();
