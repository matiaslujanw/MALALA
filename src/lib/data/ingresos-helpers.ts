/**
 * Funciones puras para el cálculo financiero de ingresos.
 * Sin "use server" para poder usarse desde server components y otros sitios.
 */
import type {
  Cliente,
  Empleado,
  Ingreso,
  IngresoLinea,
  Insumo,
  MedioPago,
  Receta,
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

interface IngresoLookups {
  serviciosById: Map<string, Servicio>;
  empleadosById: Map<string, Empleado>;
  costoInsumosByServicio: Map<string, number>;
}

export function buildCostoInsumosByServicio(
  recetas: Receta[],
  insumos: Insumo[],
): Map<string, number> {
  const insumosById = new Map(insumos.map((item) => [item.id, item]));
  const costoByServicio = new Map<string, number>();

  for (const receta of recetas) {
    const insumo = insumosById.get(receta.insumo_id);
    if (!insumo || insumo.precio_unitario == null) continue;
    costoByServicio.set(
      receta.servicio_id,
      (costoByServicio.get(receta.servicio_id) ?? 0) +
        receta.cantidad * insumo.precio_unitario,
    );
  }

  return costoByServicio;
}

export function costoInsumosDeServicio(
  servicioId: string,
  costoInsumosByServicio: Map<string, number>,
): number {
  return costoInsumosByServicio.get(servicioId) ?? 0;
}

export function computeBreakdown(
  ingreso: Ingreso,
  lineas: Array<IngresoLinea | IngresoLineaConDetalle>,
  costoInsumosByServicio?: Map<string, number>,
): IngresoBreakdown {
  const comisiones = lineas.reduce((acc, linea) => acc + linea.comision_monto, 0);
  const costoInsumos = lineas.reduce((acc, linea) => {
    if ("costoInsumos" in linea) {
      return acc + linea.costoInsumos;
    }
    const costoServicio = costoInsumosByServicio?.get(linea.servicio_id) ?? 0;
    return acc + costoServicio * linea.cantidad;
  }, 0);

  return {
    total: ingreso.total,
    comisiones,
    costoInsumos,
    neto: ingreso.total - comisiones - costoInsumos,
  };
}

export function detallarLineas(
  lineas: IngresoLinea[],
  lookups: IngresoLookups,
): IngresoLineaConDetalle[] {
  return lineas.map((linea) => ({
    ...linea,
    servicio: lookups.serviciosById.get(linea.servicio_id) ?? null,
    empleado: linea.empleado_id
      ? (lookups.empleadosById.get(linea.empleado_id) ?? null)
      : null,
    costoInsumos:
      (lookups.costoInsumosByServicio.get(linea.servicio_id) ?? 0) *
      linea.cantidad,
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
  const total = rows.reduce((acc, row) => acc + row.breakdown.total, 0);
  const comisiones = rows.reduce(
    (acc, row) => acc + row.breakdown.comisiones,
    0,
  );
  const costoInsumos = rows.reduce(
    (acc, row) => acc + row.breakdown.costoInsumos,
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

  for (const row of rows) {
    for (const linea of row.lineas) {
      if (!linea.empleado) continue;
      const cur = acc.get(linea.empleado.id) ?? {
        empleado: linea.empleado,
        total: 0,
        lineas: 0,
      };
      cur.total += linea.comision_monto;
      cur.lineas += 1;
      acc.set(linea.empleado.id, cur);
    }
  }

  return Array.from(acc.values()).sort((a, b) => b.total - a.total);
}
