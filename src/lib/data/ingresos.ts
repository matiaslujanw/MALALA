"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { requireUser } from "@/lib/auth/session";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import {
  computeBreakdown,
  detallarLineas,
  type IngresoConDetalle,
} from "./ingresos-helpers";
import { ingresoSchema } from "@/lib/validations/ingreso";
import { fieldErrors, requireRole } from "./_helpers";
import { applyMovement } from "./stock";

export interface IngresoFiltros {
  sucursalId?: string;
  empleadoId?: string;
  clienteId?: string;
  desde?: string; // ISO
  hasta?: string; // ISO
  incluirAnulados?: boolean;
}

export async function listIngresos(
  filtros: IngresoFiltros = {},
): Promise<IngresoConDetalle[]> {
  const user = await requireUser();
  const scope = buildAccessScope(user);

  let arr = filtros.incluirAnulados
    ? [...store.ingresos]
    : store.ingresos.filter((i) => !i.anulado);

  arr = arr.filter((i) => scope.sucursalIdsPermitidas.includes(i.sucursal_id));

  if (filtros.sucursalId) {
    if (!isSucursalAllowed(scope, filtros.sucursalId)) return [];
    arr = arr.filter((i) => i.sucursal_id === filtros.sucursalId);
  }
  if (filtros.clienteId) {
    arr = arr.filter((i) => i.cliente_id === filtros.clienteId);
  }
  if (filtros.desde) {
    arr = arr.filter((i) => i.fecha >= filtros.desde!);
  }
  if (filtros.hasta) {
    arr = arr.filter((i) => i.fecha <= filtros.hasta!);
  }
  if (filtros.empleadoId) {
    const ingresosConEmpleado = new Set(
      store.ingresoLineas
        .filter((l) => l.empleado_id === filtros.empleadoId)
        .map((l) => l.ingreso_id),
    );
    arr = arr.filter((i) => ingresosConEmpleado.has(i.id));
  }
  if (scope.rol === "empleado" && scope.empleadoId) {
    const ingresosPropios = new Set(
      store.ingresoLineas
        .filter((l) => l.empleado_id === scope.empleadoId)
        .map((l) => l.ingreso_id),
    );
    arr = arr.filter((i) => ingresosPropios.has(i.id));
  }

  arr.sort((a, b) => b.fecha.localeCompare(a.fecha));

  return arr.map((ingreso) => {
    const lineas = detallarLineas(ingreso.id);
    return {
      ingreso,
      cliente: ingreso.cliente_id
        ? store.clientes.find((c) => c.id === ingreso.cliente_id) ?? null
        : null,
      mp1: store.mediosPago.find((m) => m.id === ingreso.mp1_id) ?? null,
      mp2: ingreso.mp2_id
        ? store.mediosPago.find((m) => m.id === ingreso.mp2_id) ?? null
        : null,
      lineas,
      breakdown: computeBreakdown(ingreso, lineas),
    };
  });
}

export async function getIngreso(
  ingresoId: string,
): Promise<IngresoConDetalle | null> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const ingreso = store.ingresos.find((i) => i.id === ingresoId);
  if (!ingreso) return null;
  if (!scope.sucursalIdsPermitidas.includes(ingreso.sucursal_id)) return null;
  const lineas = detallarLineas(ingreso.id);
  if (scope.rol === "empleado" && scope.empleadoId) {
    const isOwn = lineas.some((linea) => linea.empleado_id === scope.empleadoId);
    if (!isOwn) return null;
  }
  return {
    ingreso,
    cliente: ingreso.cliente_id
      ? store.clientes.find((c) => c.id === ingreso.cliente_id) ?? null
      : null,
    mp1: store.mediosPago.find((m) => m.id === ingreso.mp1_id) ?? null,
    mp2: ingreso.mp2_id
      ? store.mediosPago.find((m) => m.id === ingreso.mp2_id) ?? null
      : null,
    lineas,
    breakdown: computeBreakdown(ingreso, lineas),
  };
}

export type CreateIngresoResult =
  | { ok: true; ingresoId: string; warnings?: string[] }
  | { ok: false; errors: Record<string, string[]> };

/**
 * Crea una venta:
 * 1. Insertar ingreso (cabecera) + N líneas con comision_monto calculado
 * 2. Por cada línea, leer la receta del servicio y descontar stock.
 *    El stock puede quedar negativo (con warning) — no bloquea.
 *
 * En memoria no es estrictamente atómico, pero el orden garantiza
 * consistencia. Cuando vayamos a Postgres, esto va dentro de una transacción.
 */
export async function createIngreso(
  formData: FormData,
): Promise<CreateIngresoResult> {
  const user = await requireRole(["admin", "encargada", "empleado"]);

  const lineasRaw = formData.get("lineas");
  let lineasParsed: unknown = [];
  if (typeof lineasRaw === "string") {
    try {
      lineasParsed = JSON.parse(lineasRaw);
    } catch {
      return { ok: false, errors: { lineas: ["JSON inválido"] } };
    }
  }

  const parsed = ingresoSchema.safeParse({
    sucursal_id: formData.get("sucursal_id"),
    cliente_id: formData.get("cliente_id"),
    lineas: lineasParsed,
    descuento_tipo: formData.get("descuento_tipo") ?? "pct",
    descuento_valor: formData.get("descuento_valor") ?? 0,
    mp1_id: formData.get("mp1_id"),
    valor1: formData.get("valor1"),
    mp2_id: formData.get("mp2_id"),
    valor2: formData.get("valor2"),
    observacion: formData.get("observacion"),
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const subtotal = data.lineas.reduce((acc, l) => acc + l.precio_efectivo, 0);
  const descuentoMonto =
    data.descuento_tipo === "pct"
      ? subtotal * (data.descuento_valor / 100)
      : data.descuento_valor;
  const descuentoPct =
    data.descuento_tipo === "pct"
      ? data.descuento_valor
      : subtotal > 0
        ? (data.descuento_valor / subtotal) * 100
        : 0;
  const total = subtotal - descuentoMonto;

  const ingresoId = id();
  const fecha = new Date().toISOString();

  // 1. Cabecera
  store.ingresos.push({
    id: ingresoId,
    fecha,
    sucursal_id: data.sucursal_id,
    cliente_id: data.cliente_id,
    subtotal,
    descuento_pct: descuentoPct,
    descuento_monto: descuentoMonto,
    total,
    mp1_id: data.mp1_id,
    valor1: data.valor1,
    mp2_id: data.mp2_id,
    valor2: data.valor2,
    observacion: data.observacion,
    usuario_id: user.id,
    anulado: false,
  });

  // 2. Líneas
  for (const l of data.lineas) {
    store.ingresoLineas.push({
      id: id(),
      ingreso_id: ingresoId,
      servicio_id: l.servicio_id,
      empleado_id: l.empleado_id,
      precio_efectivo: l.precio_efectivo,
      cantidad: 1,
      subtotal: l.precio_efectivo,
      comision_pct: l.comision_pct,
      comision_monto: l.precio_efectivo * (l.comision_pct / 100),
    });
  }

  // 3. Descuento de stock por receta
  const warnings: string[] = [];
  for (const linea of data.lineas) {
    const items = store.recetas.filter(
      (r) => r.servicio_id === linea.servicio_id,
    );
    for (const item of items) {
      await applyMovement({
        insumo_id: item.insumo_id,
        sucursal_id: data.sucursal_id,
        delta: -item.cantidad,
        tipo: "venta",
        ref_tipo: "ingreso",
        ref_id: ingresoId,
        usuario_id: user.id,
      });

      // Verificar si quedó negativo
      const stockRow = store.stockSucursal.find(
        (s) =>
          s.insumo_id === item.insumo_id &&
          s.sucursal_id === data.sucursal_id,
      );
      const insumo = store.insumos.find((i) => i.id === item.insumo_id);
      if (stockRow && stockRow.cantidad < 0 && insumo) {
        warnings.push(
          `Stock negativo en ${insumo.nombre}: ${stockRow.cantidad}`,
        );
      }
    }
  }

  revalidatePath("/ventas");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
  return { ok: true, ingresoId, warnings: warnings.length ? warnings : undefined };
}

