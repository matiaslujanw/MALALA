"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { requireUser } from "@/lib/auth/session";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import { egresoSchema } from "@/lib/validations/egreso";
import { applyMovement } from "./stock";
import type { Egreso } from "@/lib/types";
import type { EgresoConDetalle } from "./egresos-helpers";

export interface EgresoFiltros {
  sucursalId?: string;
  rubroId?: string;
  proveedorId?: string;
  desde?: string; // ISO
  hasta?: string; // ISO
  soloPendientes?: boolean;
}

function detallar(e: Egreso): EgresoConDetalle {
  return {
    egreso: e,
    rubro: store.rubrosGasto.find((r) => r.id === e.rubro_id) ?? null,
    sucursal: store.sucursales.find((s) => s.id === e.sucursal_id) ?? null,
    insumo: e.insumo_id
      ? store.insumos.find((i) => i.id === e.insumo_id) ?? null
      : null,
    proveedor: e.proveedor_id
      ? store.proveedores.find((p) => p.id === e.proveedor_id) ?? null
      : null,
    mp: store.mediosPago.find((m) => m.id === e.mp_id) ?? null,
  };
}

export async function listEgresos(
  filtros: EgresoFiltros = {},
): Promise<EgresoConDetalle[]> {
  await requireUser();
  let arr = [...store.egresos];

  if (filtros.sucursalId) {
    arr = arr.filter((e) => e.sucursal_id === filtros.sucursalId);
  }
  if (filtros.rubroId) {
    arr = arr.filter((e) => e.rubro_id === filtros.rubroId);
  }
  if (filtros.proveedorId) {
    arr = arr.filter((e) => e.proveedor_id === filtros.proveedorId);
  }
  if (filtros.desde) {
    arr = arr.filter((e) => e.fecha >= filtros.desde!);
  }
  if (filtros.hasta) {
    arr = arr.filter((e) => e.fecha <= filtros.hasta!);
  }
  if (filtros.soloPendientes) {
    arr = arr.filter((e) => !e.pagado);
  }

  arr.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return arr.map(detallar);
}

export async function getEgreso(
  egresoId: string,
): Promise<EgresoConDetalle | null> {
  await requireUser();
  const e = store.egresos.find((x) => x.id === egresoId);
  return e ? detallar(e) : null;
}

export type CreateEgresoResult =
  | { ok: true; egresoId: string }
  | { ok: false; errors: Record<string, string[]> };

/**
 * Crea un egreso. Reglas:
 * - Si rubro = Insumos y hay insumo_id + cantidad → registra entrada de stock (tipo "compra").
 * - Si !pagado y hay proveedor_id → suma a deuda_pendiente del proveedor.
 */
export async function createEgreso(
  _prev: CreateEgresoResult | null,
  formData: FormData,
): Promise<CreateEgresoResult> {
  const user = await requireRole(["admin", "encargada"]);

  const parsed = egresoSchema.safeParse({
    fecha: formData.get("fecha"),
    sucursal_id: formData.get("sucursal_id"),
    rubro_id: formData.get("rubro_id"),
    insumo_id: formData.get("insumo_id"),
    proveedor_id: formData.get("proveedor_id"),
    cantidad: formData.get("cantidad"),
    valor: formData.get("valor"),
    mp_id: formData.get("mp_id"),
    observacion: formData.get("observacion"),
    pagado: formData.get("pagado") ?? false,
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  // Bloqueo: la caja de la fecha objetivo ya está cerrada
  const ymdFecha = data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)
    ? data.fecha
    : new Date().toISOString().slice(0, 10);
  const cierreDelDia = store.cierresCaja.find(
    (c) => c.sucursal_id === data.sucursal_id && c.fecha === ymdFecha,
  );
  if (cierreDelDia) {
    return {
      ok: false,
      errors: {
        fecha: [
          `La caja del ${ymdFecha} ya está cerrada para esta sucursal. Reabrí el cierre o cargá el egreso con otra fecha.`,
        ],
      },
    };
  }

  // Construir fecha ISO: si vino YYYY-MM-DD, completar la hora actual
  let fechaIso: string;
  if (data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) {
    const ahora = new Date();
    const d = new Date(`${data.fecha}T00:00:00`);
    d.setHours(ahora.getHours(), ahora.getMinutes(), ahora.getSeconds(), 0);
    fechaIso = d.toISOString();
  } else {
    fechaIso = new Date().toISOString();
  }

  const egresoId = id();
  const egreso: Egreso = {
    id: egresoId,
    fecha: fechaIso,
    sucursal_id: data.sucursal_id,
    rubro_id: data.rubro_id,
    insumo_id: data.insumo_id,
    proveedor_id: data.proveedor_id,
    cantidad: data.cantidad,
    valor: data.valor,
    mp_id: data.mp_id,
    observacion: data.observacion,
    pagado: data.pagado,
    usuario_id: user.id,
  };
  store.egresos.push(egreso);

  // Stock: si hay insumo + cantidad, sumar en sucursal
  if (data.insumo_id && data.cantidad && data.cantidad > 0) {
    await applyMovement({
      insumo_id: data.insumo_id,
      sucursal_id: data.sucursal_id,
      delta: data.cantidad,
      tipo: "compra",
      ref_tipo: "egreso",
      ref_id: egresoId,
      usuario_id: user.id,
    });
  }

  // Deuda proveedor
  if (!data.pagado && data.proveedor_id) {
    const prov = store.proveedores.find((p) => p.id === data.proveedor_id);
    if (prov) prov.deuda_pendiente += data.valor;
  }

  revalidatePath("/egresos");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
  revalidatePath("/catalogos/proveedores");
  return { ok: true, egresoId };
}

export async function togglePagadoEgreso(
  egresoId: string,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada"]);
  const e = store.egresos.find((x) => x.id === egresoId);
  if (!e) return { ok: false, errors: { _: ["Egreso no encontrado"] } };

  const eraPagado = e.pagado;
  e.pagado = !e.pagado;

  // Ajustar deuda del proveedor si aplica
  if (e.proveedor_id) {
    const prov = store.proveedores.find((p) => p.id === e.proveedor_id);
    if (prov) {
      if (eraPagado) {
        // pasaba a pendiente → suma deuda
        prov.deuda_pendiente += e.valor;
      } else {
        // pasaba a pagado → resta deuda
        prov.deuda_pendiente = Math.max(0, prov.deuda_pendiente - e.valor);
      }
    }
  }

  revalidatePath("/egresos");
  revalidatePath("/catalogos/proveedores");
  return { ok: true };
}
