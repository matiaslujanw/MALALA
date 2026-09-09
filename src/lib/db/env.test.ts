import { describe, it, expect } from "vitest";

/**
 * isWebPushConfigured lee las env al importar el módulo, así que para probar el
 * criterio se replica la validación pura acá. Lo que se está fijando es la
 * regla, no el acceso a process.env: que un valor con el largo equivocado NO
 * cuente como configurado.
 *
 * El caso real que motivó esto: en .env.local había texto de relleno de 27
 * bytes en la clave pública, y como el chequeo era `Boolean(pub && priv)`, la
 * app ofrecía suscribirse y explotaba al apretar el botón.
 */
function bytesDeBase64Url(valor: string): number {
  const limpio = valor.replace(/=+$/, "");
  return Math.floor((limpio.length * 3) / 4);
}

function esValido(pub: string | undefined, priv: string | undefined): boolean {
  if (!pub || !priv) return false;
  if (bytesDeBase64Url(pub) !== 65) return false;
  if (!pub.startsWith("B")) return false;
  if (bytesDeBase64Url(priv) !== 32) return false;
  return true;
}

// Par real generado con scripts/generar-vapid.ts (descartado, sólo para el test).
const PUB_OK =
  "BK624MxrQieuei_qiyNYphpuRxjplCTVsZEyUatIAkan3-Tr3ddPc-Yka8UuEgpNEdxY1G5KB70R8x50rkkswdo";
const PRIV_OK = "hG7yqvJ9kZ2mQ4xT8sLbN0pR3wVcXeYfA1dK5uJ6iOo";

describe("validación de claves VAPID", () => {
  it("acepta un par bien formado", () => {
    expect(bytesDeBase64Url(PUB_OK)).toBe(65);
    expect(esValido(PUB_OK, PRIV_OK.slice(0, 43))).toBe(true);
  });

  it("rechaza el relleno que había en .env.local (27 bytes)", () => {
    const relleno = "clave-publica-de-ejemplo-cambiar-esto";
    expect(bytesDeBase64Url(relleno)).toBe(27);
    expect(esValido(relleno, PRIV_OK.slice(0, 43))).toBe(false);
  });

  it("rechaza una pública que no arranca con 0x04 (la 'B' de base64url)", () => {
    const noComprimida = "A" + PUB_OK.slice(1);
    expect(esValido(noComprimida, PRIV_OK.slice(0, 43))).toBe(false);
  });

  it("rechaza una privada con el largo equivocado", () => {
    expect(esValido(PUB_OK, "corta")).toBe(false);
    expect(esValido(PUB_OK, PUB_OK)).toBe(false);
  });

  it("sigue rechazando las vacías y las que faltan", () => {
    expect(esValido(undefined, PRIV_OK)).toBe(false);
    expect(esValido(PUB_OK, undefined)).toBe(false);
    expect(esValido("", "")).toBe(false);
  });
});
