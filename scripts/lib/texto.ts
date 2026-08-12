/** Helpers de comparación de nombres, compartidos por los scripts de carga. */

/** Sin acentos, sin puntuación, en minúsculas: para comparar nombres. */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Coeficiente de Dice sobre bigramas de caracteres. 1 = idéntico. */
export function similitud(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigramas = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ma = bigramas(a);
  const mb = bigramas(b);
  let comunes = 0;
  for (const [g, n] of ma) comunes += Math.min(n, mb.get(g) ?? 0);
  return (2 * comunes) / (a.length - 1 + (b.length - 1));
}

/**
 * Saca el sufijo de largo de pelo: "Keraplex antifrizz 2" y "Celulas Madres
 * ALFAPARF (3)" son el mismo trabajo. Devuelve null si el nombre no lo tiene.
 */
export function sinTier(nombre: string): string | null {
  const m = /^(.*?)[\s(]*(?:precio\s*)?([1-4])\)?$/i.exec(nombre.trim());
  const base = m?.[1]?.trim();
  return base ? base : null;
}
