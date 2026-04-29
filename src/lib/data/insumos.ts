"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { insumoSchema } from "@/lib/validations/insumo";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import type { Insumo } from "@/lib/types";

export async function listInsumos(opts?: {
  incluirInactivos?: boolean;
}): Promise<Insumo[]> {
  const arr = opts?.incluirInactivos
    ? [...store.insumos]
    : store.insumos.filter((i) => i.activo);
  return arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function getInsumo(insumoId: string): Promise<Insumo | null> {
  return store.insumos.find((i) => i.id === insumoId) ?? null;
}

function parse(formData: FormData) {
  return insumoSchema.safeParse({
    nombre: formData.get("nombre"),
    proveedor_id: formData.get("proveedor_id"),
    unidad_medida: formData.get("unidad_medida"),
    tamano_envase: formData.get("tamano_envase"),
    precio_envase: formData.get("precio_envase"),
    rinde: formData.get("rinde"),
    umbral_stock_bajo: formData.get("umbral_stock_bajo"),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  });
}

export async function createInsumo(formData: FormData): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  store.insumos.push({ id: id(), ...parsed.data });
  revalidatePath("/catalogos/insumos");
  return { ok: true };
}

export async function updateInsumo(
  insumoId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const idx = store.insumos.findIndex((i) => i.id === insumoId);
  if (idx === -1) return { ok: false, errors: { _: ["No encontrado"] } };
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  store.insumos[idx] = { ...store.insumos[idx], ...parsed.data };
  revalidatePath("/catalogos/insumos");
  return { ok: true };
}

export async function toggleInsumoActivo(
  insumoId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const i = store.insumos.find((x) => x.id === insumoId);
  if (!i) return { ok: false, errors: { _: ["No encontrado"] } };
  i.activo = !i.activo;
  revalidatePath("/catalogos/insumos");
  return { ok: true };
}
