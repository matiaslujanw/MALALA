/**
 * Aritmética del aumento masivo de precios. Módulo puro: sin acceso a base ni a
 * sesión, para poder testearlo.
 */

/**
 * Redondea al múltiplo de $100 más cercano.
 *
 * Es lo que pidió el salón y es lo que hace legible una lista de precios. El
 * piso de $100 evita que un servicio barato con una baja fuerte termine en $0 y
 * quede regalado sin que nadie lo note.
 */
export function redondear100(valor: number): number {
  if (valor <= 0) return 0;
  return Math.max(100, Math.round(valor / 100) * 100);
}

export interface PreciosServicio {
  precioLista: number;
  precioEfectivo: number;
}

/**
 * Aplica el porcentaje a los DOS precios por separado, con el mismo factor.
 *
 * No se recalcula el efectivo a partir de la lista: cada servicio conserva su
 * propia relación. Importa porque no es uniforme — 268 servicios tienen el
 * efectivo al 80% de la lista, pero 6 lo tienen igual. Fijar un 0,8 les cambiaría
 * el precio a esos seis sin que nadie lo pida.
 */
export function aplicarAumento(
  s: PreciosServicio,
  pct: number,
): { lista: number; efectivo: number } {
  const factor = 1 + pct / 100;
  return {
    lista: redondear100(s.precioLista * factor),
    efectivo: redondear100(s.precioEfectivo * factor),
  };
}

/** Un porcentaje que el sistema acepta: distinto de 0 y dentro de rango. */
export function pctValido(pct: number): boolean {
  return Number.isFinite(pct) && pct !== 0 && pct >= -90 && pct <= 1000;
}
