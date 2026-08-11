import { AlertTriangle } from "lucide-react";

/**
 * Chips de "receta no cerrada". Dos avisos distintos que no hay que mezclar:
 * las líneas propuestas son trabajo pendiente del salón, mientras que un insumo
 * sin precio ensucia la plata que muestra la pantalla (el costo queda por debajo
 * del real y el margen por encima).
 */

const CHIP = "px-2 py-0.5 rounded text-xs whitespace-nowrap";

const TITULO_PROPUESTA =
  "Línea que armó el sistema desde la planilla: el salón todavía no la confirmó";
const TITULO_SIN_PRECIO =
  "El insumo no tiene precio cargado: no suma al costo, así que el costo real es mayor y el margen menor";

export function BadgeAConfirmar({ cantidad }: { cantidad: number }) {
  if (cantidad <= 0) return null;
  return (
    <span
      className={`bg-warning/15 text-brown-700 ${CHIP}`}
      title={TITULO_PROPUESTA}
    >
      {cantidad} a confirmar
    </span>
  );
}

export function BadgeSinPrecio({ cantidad }: { cantidad: number }) {
  if (cantidad <= 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 bg-destructive/10 text-destructive font-medium ${CHIP}`}
      title={TITULO_SIN_PRECIO}
    >
      <AlertTriangle className="h-3 w-3 stroke-[1.5]" />
      {cantidad} sin precio
    </span>
  );
}

/** Versión por línea, para el detalle de una receta. */
export function BadgeLineaPropuesta() {
  return (
    <span
      className={`bg-warning/15 text-brown-700 ${CHIP}`}
      title={TITULO_PROPUESTA}
    >
      Propuesta
    </span>
  );
}

export function BadgeLineaSinPrecio() {
  return (
    <span
      className={`inline-flex items-center gap-1 bg-destructive/10 text-destructive font-medium ${CHIP}`}
      title={TITULO_SIN_PRECIO}
    >
      <AlertTriangle className="h-3 w-3 stroke-[1.5]" />
      Sin precio
    </span>
  );
}
