/**
 * Funciones puras para el cálculo financiero de ingresos.
 * Sin "use server" para poder usarse desde server components y otros sitios.
 */
import { store } from "@/lib/mock/store";
import type {
  Cliente,
  Empleado,
  Ingreso,
  IngresoLinea,
  MedioPago,
  Servicio,
} from "@/lib/types";

/**
 * Desglose financiero de un ingreso.
 *
 * - total        : lo que paga el cliente (después de descuento)
 * - comisiones   : suma de comision_monto de cada línea (lo que va al equipo)
 * - costoInsumos : costo de los insumos consumidos según receta de cada servicio
 * - neto         : total − comisiones − costoInsumos = lo que queda para el negocio
 */
export interface IngresoBreakdown {
  total: number;
  comisiones: number;
  costoInsumos: number;
  neto: number;
}

export function costoInsumosDeServicio(servicioId: string): number {
  const items = store.recetas.filter((r) => r.servicio_id === servicioId);
  return items.reduce((acc, r) => {
    const insumo = store.insumos.find((i) => i.id === r.insumo_id);
    if (!insumo || insumo.precio_unitario == null) return acc;
    return acc + r.cantidad * insumo.precio_unitario;
  }, 0);
}

export function computeBreakdown(
  ingreso: Ingreso,
  lineas: IngresoLinea[],
): IngresoBreakdown {
  const comisiones = lineas.reduce((acc, l) => acc + l.comision_monto, 0);
  const costoInsumos = lineas.reduce(
    (acc, l) => acc + costoInsumosDeServicio(l.servicio_id) * l.cantidad,
    0,
  );
  return {
    total: ingreso.total,
    comisiones,
    costoInsumos,
    neto: ingreso.total - comisiones - costoInsumos,
  };
}

export interface IngresoLineaConDetalle extends IngresoLinea {
  servicio: Servicio | null;
  empleado: Empleado | null;
  costoInsumos: number;
}

export interface IngresoConDetalle {
  ingreso: Ingreso;
  cliente: Cliente | null;
  mp1: MedioPago | null;
  mp2: MedioPago | null;
  lineas: IngresoLineaConDetalle[];
  breakdown: IngresoBreakdown;
}

export function detallarLineas(ingresoId: string): IngresoLineaConDetalle[] {
  const lineas = store.ingresoLineas.filter((l) => l.ingreso_id === ingresoId);
  return lineas.map((l) => ({
    ...l,
    servicio: store.servicios.find((s) => s.id === l.servicio_id) ?? null,
    empleado: l.empleado_id
      ? store.empleados.find((e) => e.id === l.empleado_id) ?? null
      : null,
    costoInsumos: costoInsumosDeServicio(l.servicio_id) * l.cantidad,
  }));
}

export interface AggregatedTotals {
  cantidad: number;
  total: number;
  comisiones: number;
  costoInsumos: number;
  neto: number;
}

export function aggregate(rows: IngresoConDetalle[]): AggregatedTotals {
  const total = rows.reduce((acc, r) => acc + r.breakdown.total, 0);
  const comisiones = rows.reduce((acc, r) => acc + r.breakdown.comisiones, 0);
  const costoInsumos = rows.reduce(
    (acc, r) => acc + r.breakdown.costoInsumos,
    0,
  );
  const neto = total - comisiones - costoInsumos;
  return { cantidad: rows.length, total, comisiones, costoInsumos, neto };
}

/**
 * Comisiones agrupadas por empleado para una lista de ingresos.
 */
export function comisionesPorEmpleado(
  rows: IngresoConDetalle[],
): Array<{ empleado: Empleado; total: number; lineas: number }> {
  const acc = new Map<
    string,
    { empleado: Empleado; total: number; lineas: number }
  >();
  for (const r of rows) {
    for (const l of r.lineas) {
      if (!l.empleado) continue;
      const cur = acc.get(l.empleado.id) ?? {
        empleado: l.empleado,
        total: 0,
        lineas: 0,
      };
      cur.total += l.comision_monto;
      cur.lineas += 1;
      acc.set(l.empleado.id, cur);
    }
  }
  return Array.from(acc.values()).sort((a, b) => b.total - a.total);
}
