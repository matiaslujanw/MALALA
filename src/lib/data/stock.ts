"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { requireUser } from "@/lib/auth/session";
import {
  ajusteManualSchema,
  transferenciaSchema,
} from "@/lib/validations/stock";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import type {
  Insumo,
  MovimientoStock,
  StockSucursal,
  TipoMovimientoStock,
} from "@/lib/types";

export type StockRow = {
  insumo: Insumo;
  cantidad: number;
  estado: "ok" | "bajo" | "negativo";
};

export async function listStockBySucursal(
  sucursalId: string,
): Promise<StockRow[]> {
  const insumos = store.insumos.filter((i) => i.activo);
  return insumos
    .map((insumo) => {
      const row = store.stockSucursal.find(
        (s) => s.insumo_id === insumo.id && s.sucursal_id === sucursalId,
      );
      const cantidad = row?.cantidad ?? 0;
      let estado: StockRow["estado"] = "ok";
      if (cantidad < 0) estado = "negativo";
      else if (cantidad < insumo.umbral_stock_bajo) estado = "bajo";
      return { insumo, cantidad, estado };
    })
    .sort((a, b) => {
      // negativos primero, luego bajos, luego ok
      const order = { negativo: 0, bajo: 1, ok: 2 };
      if (a.estado !== b.estado) return order[a.estado] - order[b.estado];
      return a.insumo.nombre.localeCompare(b.insumo.nombre);
    });
}

/**
 * Aplica un delta al stock de un insumo en una sucursal y registra el movimiento.
 * No es estrictamente atómico (memoria), pero el orden garantiza consistencia
 * dentro de un mismo proceso. Cuando vayamos a Postgres, esto es 1 transaction.
 */
export async function applyMovement(args: {
  insumo_id: string;
  sucursal_id: string;
  delta: number;
  tipo: TipoMovimientoStock;
  motivo?: string;
  ref_tipo?: string;
  ref_id?: string;
  usuario_id: string;
}): Promise<{ stock: StockSucursal; movimiento: MovimientoStock }> {
  let row = store.stockSucursal.find(
    (s) =>
      s.insumo_id === args.insumo_id && s.sucursal_id === args.sucursal_id,
  );
  if (!row) {
    row = {
      id: id(),
      insumo_id: args.insumo_id,
      sucursal_id: args.sucursal_id,
      cantidad: 0,
    };
    store.stockSucursal.push(row);
  }
  row.cantidad += args.delta;

  const movimiento: MovimientoStock = {
    id: id(),
    insumo_id: args.insumo_id,
    sucursal_id: args.sucursal_id,
    tipo: args.tipo,
    cantidad: args.delta,
    motivo: args.motivo,
    ref_tipo: args.ref_tipo,
    ref_id: args.ref_id,
    usuario_id: args.usuario_id,
    fecha: new Date().toISOString(),
  };
  store.movimientosStock.push(movimiento);

  return { stock: row, movimiento };
}

export async function createAjusteManual(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin"]);
  const parsed = ajusteManualSchema.safeParse({
    insumo_id: formData.get("insumo_id"),
    sucursal_id: formData.get("sucursal_id"),
    cantidad: formData.get("cantidad"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  await applyMovement({
    insumo_id: parsed.data.insumo_id,
    sucursal_id: parsed.data.sucursal_id,
    delta: parsed.data.cantidad,
    tipo: "ajuste_manual",
    motivo: parsed.data.motivo,
    usuario_id: user.id,
  });

  revalidatePath("/stock");
  revalidatePath("/stock/movimientos");
  return { ok: true };
}

export async function createTransferencia(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin"]);
  const parsed = transferenciaSchema.safeParse({
    insumo_id: formData.get("insumo_id"),
    sucursal_origen_id: formData.get("sucursal_origen_id"),
    sucursal_destino_id: formData.get("sucursal_destino_id"),
    cantidad: formData.get("cantidad"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const refId = id();
  // Salida en origen
  await applyMovement({
    insumo_id: parsed.data.insumo_id,
    sucursal_id: parsed.data.sucursal_origen_id,
    delta: -parsed.data.cantidad,
    tipo: "transferencia_salida",
    motivo: parsed.data.motivo,
    ref_tipo: "transferencia",
    ref_id: refId,
    usuario_id: user.id,
  });
  // Entrada en destino
  await applyMovement({
    insumo_id: parsed.data.insumo_id,
    sucursal_id: parsed.data.sucursal_destino_id,
    delta: parsed.data.cantidad,
    tipo: "transferencia_entrada",
    motivo: parsed.data.motivo,
    ref_tipo: "transferencia",
    ref_id: refId,
    usuario_id: user.id,
  });

  revalidatePath("/stock");
  revalidatePath("/stock/movimientos");
  return { ok: true };
}

export type MovimientoConDetalle = MovimientoStock & {
  insumo_nombre: string;
  sucursal_nombre: string;
  usuario_nombre: string;
};

export async function listMovimientos(opts?: {
  sucursalId?: string;
  insumoId?: string;
  limit?: number;
}): Promise<MovimientoConDetalle[]> {
  await requireUser();

  let arr = [...store.movimientosStock];
  if (opts?.sucursalId) {
    arr = arr.filter((m) => m.sucursal_id === opts.sucursalId);
  }
  if (opts?.insumoId) {
    arr = arr.filter((m) => m.insumo_id === opts.insumoId);
  }
  arr.sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (opts?.limit) arr = arr.slice(0, opts.limit);

  const insMap = new Map(store.insumos.map((i) => [i.id, i.nombre]));
  const sucMap = new Map(store.sucursales.map((s) => [s.id, s.nombre]));
  const userMap = new Map(store.usuarios.map((u) => [u.id, u.nombre]));

  return arr.map((m) => ({
    ...m,
    insumo_nombre: insMap.get(m.insumo_id) ?? "—",
    sucursal_nombre: sucMap.get(m.sucursal_id) ?? "—",
    usuario_nombre: userMap.get(m.usuario_id) ?? "—",
  }));
}
