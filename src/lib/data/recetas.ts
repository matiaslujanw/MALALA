"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { recetaItemSchema } from "@/lib/validations/receta";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import type { Insumo, Receta, Servicio } from "@/lib/types";

export interface RecetaResumen {
  servicio: Servicio;
  cantidadInsumos: number;
  costoTotal: number;
}

export interface RecetaItemDetalle {
  receta: Receta;
  insumo: Insumo;
  costo: number; // cantidad × precio_unitario (0 si null)
}

export async function listRecetasResumen(): Promise<RecetaResumen[]> {
  return store.servicios
    .filter((s) => s.activo)
    .map((servicio) => {
      const items = store.recetas.filter((r) => r.servicio_id === servicio.id);
      const costoTotal = items.reduce((acc, r) => {
        const insumo = store.insumos.find((i) => i.id === r.insumo_id);
        if (!insumo || insumo.precio_unitario == null) return acc;
        return acc + r.cantidad * insumo.precio_unitario;
      }, 0);
      return {
        servicio,
        cantidadInsumos: items.length,
        costoTotal,
      };
    })
    .sort((a, b) => {
      if (a.servicio.rubro !== b.servicio.rubro) {
        return a.servicio.rubro.localeCompare(b.servicio.rubro);
      }
      return a.servicio.nombre.localeCompare(b.servicio.nombre);
    });
}

export async function getRecetaItems(
  servicioId: string,
): Promise<RecetaItemDetalle[]> {
  const items = store.recetas.filter((r) => r.servicio_id === servicioId);
  return items
    .map((receta) => {
      const insumo = store.insumos.find((i) => i.id === receta.insumo_id);
      if (!insumo) return null;
      const costo =
        insumo.precio_unitario != null
          ? receta.cantidad * insumo.precio_unitario
          : 0;
      return { receta, insumo, costo };
    })
    .filter((x): x is RecetaItemDetalle => x != null)
    .sort((a, b) => a.insumo.nombre.localeCompare(b.insumo.nombre));
}

/**
 * Agrega o actualiza un item de receta. Si ya existe (servicio + insumo),
 * suma la cantidad nueva (reemplaza).
 */
export async function upsertRecetaItem(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = recetaItemSchema.safeParse({
    servicio_id: formData.get("servicio_id"),
    insumo_id: formData.get("insumo_id"),
    cantidad: formData.get("cantidad"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const existing = store.recetas.find(
    (r) =>
      r.servicio_id === parsed.data.servicio_id &&
      r.insumo_id === parsed.data.insumo_id,
  );

  if (existing) {
    existing.cantidad = parsed.data.cantidad;
  } else {
    store.recetas.push({
      id: id(),
      servicio_id: parsed.data.servicio_id,
      insumo_id: parsed.data.insumo_id,
      cantidad: parsed.data.cantidad,
    });
  }

  revalidatePath("/catalogos/recetas");
  revalidatePath(`/catalogos/recetas/${parsed.data.servicio_id}`);
  return { ok: true };
}

export async function removeRecetaItem(
  recetaId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const idx = store.recetas.findIndex((r) => r.id === recetaId);
  if (idx === -1) return { ok: false, errors: { _: ["No encontrado"] } };
  const servicioId = store.recetas[idx].servicio_id;
  store.recetas.splice(idx, 1);
  revalidatePath("/catalogos/recetas");
  revalidatePath(`/catalogos/recetas/${servicioId}`);
  return { ok: true };
}
