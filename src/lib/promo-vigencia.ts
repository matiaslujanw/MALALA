import type { Promocion, ServicioHorario } from "@/lib/types";

const TZ = "America/Argentina/Buenos_Aires";

// Convierte un Date al equivalente local en Argentina usando el truco de
// toLocaleString para que getDay/getHours devuelvan valores en hora AR.
function arLocal(d: Date): Date {
  return new Date(d.toLocaleString("en-US", { timeZone: TZ }));
}

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
  // Calcular fecha y hora en zona horaria de Argentina (UTC-3).
  const arAhora = arLocal(ahora);
  const hoy = ahora.toLocaleDateString("en-CA", { timeZone: TZ });

  if (promo.vence_el) {
    if (hoy > promo.vence_el) {
      return { vigente: false, motivo: `Promo vencida el ${promo.vence_el}` };
    }
  }
  if (horarios.length > 0) {
    const dia = arAhora.getDay();
    const hhmm = `${String(arAhora.getHours()).padStart(2, "0")}:${String(
      arAhora.getMinutes(),
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
