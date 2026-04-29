/**
 * Helpers puros para egresos (sin "use server" para usarse en componentes).
 */
import type {
  Egreso,
  Insumo,
  MedioPago,
  Proveedor,
  RubroGasto,
  Sucursal,
} from "@/lib/types";

export interface EgresoConDetalle {
  egreso: Egreso;
  rubro: RubroGasto | null;
  sucursal: Sucursal | null;
  insumo: Insumo | null;
  proveedor: Proveedor | null;
  mp: MedioPago | null;
}

export interface AggregatedEgresos {
  cantidad: number;
  total: number;
  pendiente: number;
  pagado: number;
}

export function aggregateEgresos(
  rows: EgresoConDetalle[],
): AggregatedEgresos {
  const total = rows.reduce((s, r) => s + r.egreso.valor, 0);
  const pendiente = rows
    .filter((r) => !r.egreso.pagado)
    .reduce((s, r) => s + r.egreso.valor, 0);
  return {
    cantidad: rows.length,
    total,
    pendiente,
    pagado: total - pendiente,
  };
}
