/**
 * Modelo de estados de turno (4 estados).
 *
 *   pendiente  → turno agendado, hasta que llega su hora
 *   realizado  → automático: cuando llega/pasa la hora del turno (calculado, no
 *                se guarda en la DB salvo migración de datos viejos)
 *   ausente    → el cliente no vino (solo se marca desde el backoffice)
 *   cancelado  → cancelado desde el backoffice o por el cliente (link de WhatsApp)
 *
 * `realizado` se calcula al mostrar: un turno `pendiente` cuya hora ya pasó se
 * muestra como `realizado`, salvo que se lo haya marcado `ausente`/`cancelado`.
 */

export type TurnoEstado = "pendiente" | "realizado" | "ausente" | "cancelado";

/** Estados que un operador puede setear a mano desde el backoffice. */
export const ESTADOS_SETEABLES: TurnoEstado[] = [
  "pendiente",
  "cancelado",
  "ausente",
];

/** Normaliza el valor crudo de la DB (incluye enums viejos) a uno de los 4. */
export function normalizeEstado(raw: string | null | undefined): TurnoEstado {
  switch (raw) {
    case "cancelado":
      return "cancelado";
    case "ausente":
      return "ausente";
    case "completado":
    case "realizado":
      return "realizado";
    // "confirmado" y "en_curso" (modelo viejo) colapsan en pendiente.
    default:
      return "pendiente";
  }
}

/** Instante (ms) de inicio del turno en horario de Argentina (UTC-3 fijo). */
function inicioTurnoMs(fechaTurno: string, hora: string): number {
  return new Date(`${fechaTurno}T${hora}:00-03:00`).getTime();
}

/**
 * Estado efectivo para mostrar: aplica la regla de `realizado` por hora.
 * Un turno pendiente cuya hora ya llegó se muestra como realizado.
 */
export function estadoEfectivo(t: {
  estado: string;
  fecha_turno: string;
  hora: string;
}): TurnoEstado {
  const base = normalizeEstado(t.estado);
  if (base !== "pendiente") return base;
  return Date.now() >= inicioTurnoMs(t.fecha_turno, t.hora)
    ? "realizado"
    : "pendiente";
}

export const ESTADO_LABEL: Record<TurnoEstado, string> = {
  pendiente: "Pendiente",
  realizado: "Realizado",
  ausente: "Ausente",
  cancelado: "Cancelado",
};

/** Badge (fondo + texto) para chips de estado. */
export const ESTADO_BADGE: Record<TurnoEstado, string> = {
  pendiente: "bg-[#fff5dd] text-[#8c6b11]",
  realizado: "bg-emerald-100 text-emerald-800",
  ausente: "bg-stone-200 text-stone-700",
  cancelado: "bg-[#fff1ef] text-[#8a3b31]",
};

/** Badge con borde, para las tarjetas de la timeline diaria. */
export const ESTADO_BADGE_BORDE: Record<TurnoEstado, string> = {
  pendiente: "bg-[#fff5dd] text-[#8c6b11] border-[#f1ddab]",
  realizado: "bg-emerald-50 text-emerald-800 border-emerald-200",
  ausente: "bg-stone-200 text-stone-700 border-stone-300",
  cancelado: "bg-[#fff1ef] text-[#8a3b31] border-[#f1c5bf]",
};

/** Punto de color para el calendario (vista semanal/mensual). */
export const ESTADO_DOT: Record<TurnoEstado, string> = {
  pendiente: "bg-[#c9a961]",
  realizado: "bg-emerald-500",
  ausente: "bg-stone-400",
  cancelado: "bg-[#a84a3d]",
};
