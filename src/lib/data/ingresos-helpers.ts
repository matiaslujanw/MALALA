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
  MotivoDescuento,
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
  insumo: Insumo | null;
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
  insumosById: Map<string, Insumo>;
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
  lineas: Array<IngresoLineaConDetalle>,
): IngresoBreakdown {
  const comisiones = lineas.reduce((acc, linea) => acc + linea.comision_monto, 0);
  const costoInsumos = lineas.reduce((acc, linea) => acc + linea.costoInsumos, 0);

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
  return lineas.map((linea) => {
    const servicio = linea.servicio_id
      ? (lookups.serviciosById.get(linea.servicio_id) ?? null)
      : null;
    const insumo = linea.insumo_id
      ? (lookups.insumosById.get(linea.insumo_id) ?? null)
      : null;
    const empleado = linea.empleado_id
      ? (lookups.empleadosById.get(linea.empleado_id) ?? null)
      : null;

    let costoInsumos = 0;
    if (linea.servicio_id) {
      costoInsumos =
        (lookups.costoInsumosByServicio.get(linea.servicio_id) ?? 0) *
        linea.cantidad;
    } else if (insumo && insumo.precio_unitario != null) {
      // Para productos vendidos, el "costo" del local es el precio unitario × cantidad
      costoInsumos = insumo.precio_unitario * linea.cantidad;
    }

    return {
      ...linea,
      servicio,
      insumo,
      empleado,
      costoInsumos,
    };
  });
}

export interface AggregatedTotals {
  cantidad: number;
  ventaTeorica: number;
  descuentos: number;
  total: number;
  comisiones: number;
  costoInsumos: number;
  neto: number;
}

export function aggregate(rows: IngresoConDetalle[]): AggregatedTotals {
  const ventaTeorica = rows.reduce(
    (acc, row) => acc + row.ingreso.subtotal,
    0,
  );
  const descuentos = rows.reduce(
    (acc, row) => acc + row.ingreso.descuento_monto,
    0,
  );
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
  return {
    cantidad: rows.length,
    ventaTeorica,
    descuentos,
    total,
    comisiones,
    costoInsumos,
    neto,
  };
}

/**
 * Descuentos acumulados por motivo para una lista de ingresos.
 * Los descuentos sin motivo asignado (datos viejos) caen en "Sin motivo".
 */
export function descuentosPorMotivo(
  rows: IngresoConDetalle[],
  motivosById: Map<string, MotivoDescuento>,
): Array<{ motivo: string; total: number; cantidad: number }> {
  const acc = new Map<string, { motivo: string; total: number; cantidad: number }>();

  for (const row of rows) {
    if (row.ingreso.descuento_monto <= 0) continue;
    const motivoId = row.ingreso.descuento_motivo_id;
    const key = motivoId ?? "__sin__";
    const nombre = motivoId
      ? (motivosById.get(motivoId)?.nombre ?? "Motivo eliminado")
      : "Sin motivo";
    const cur = acc.get(key) ?? { motivo: nombre, total: 0, cantidad: 0 };
    cur.total += row.ingreso.descuento_monto;
    cur.cantidad += 1;
    acc.set(key, cur);
  }

  return Array.from(acc.values()).sort((a, b) => b.total - a.total);
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
