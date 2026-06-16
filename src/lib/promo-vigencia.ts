import type { Promocion, ServicioHorario } from "@/lib/types";

/**
 * Vigencia de una promo para advertir en el POS (no bloquea la venta).
 * Comprueba el vencimiento y, si tiene franja horaria configurada, que el
 * momento actual caiga dentro de alguna franja del día. Módulo puro (sin
 * dependencias de servidor) para poder usarse también desde el cliente.
 */
export function estaVigente(
  promo: Pick<Promocion, "vence_el">,
  horarios: ServicioHorario[],
  ahora: Date = new Date(),
): { vigente: boolean; motivo?: string } {
  if (promo.vence_el) {
    const hoy = ahora.toISOString().slice(0, 10);
    if (hoy > promo.vence_el) {
      return { vigente: false, motivo: `Promo vencida el ${promo.vence_el}` };
    }
  }
  if (horarios.length > 0) {
    const dia = ahora.getDay();
    const hhmm = `${String(ahora.getHours()).padStart(2, "0")}:${String(
      ahora.getMinutes(),
    ).padStart(2, "0")}`;
    const dentro = horarios.some(
      (h) => h.dia_semana === dia && hhmm >= h.apertura && hhmm < h.cierre,
    );
    if (!dentro) {
      return { vigente: false, motivo: "Fuera de la franja horaria de la promo" };
    }
  }
  return { vigente: true };
}
