"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { medioPagoSchema } from "@/lib/validations/medio-pago";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import type { MedioPago } from "@/lib/types";

export async function listMediosPago(): Promise<MedioPago[]> {
  return [...store.mediosPago].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export async function createMedioPago(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = medioPagoSchema.safeParse({
    codigo: formData.get("codigo"),
    nombre: formData.get("nombre"),
    activo: true,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  if (store.mediosPago.some((m) => m.codigo === parsed.data.codigo)) {
    return { ok: false, errors: { codigo: ["Ya existe ese código"] } };
  }
  store.mediosPago.push({ id: id(), ...parsed.data });
  revalidatePath("/catalogos/medios-pago");
  return { ok: true };
}

export async function toggleMedioPagoActivo(
  mpId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const m = store.mediosPago.find((x) => x.id === mpId);
  if (!m) return { ok: false, errors: { _: ["No encontrado"] } };
  m.activo = !m.activo;
  revalidatePath("/catalogos/medios-pago");
  return { ok: true };
}
