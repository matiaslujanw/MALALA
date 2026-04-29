"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { rubroGastoSchema } from "@/lib/validations/rubro-gasto";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import type { RubroGasto } from "@/lib/types";

export async function listRubrosGasto(): Promise<RubroGasto[]> {
  return [...store.rubrosGasto].sort((a, b) => {
    if (a.rubro !== b.rubro) return a.rubro.localeCompare(b.rubro);
    return (a.subrubro ?? "").localeCompare(b.subrubro ?? "");
  });
}

export async function createRubroGasto(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = rubroGastoSchema.safeParse({
    rubro: formData.get("rubro"),
    subrubro: formData.get("subrubro"),
    activo: true,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  store.rubrosGasto.push({ id: id(), ...parsed.data });
  revalidatePath("/catalogos/rubros-gasto");
  return { ok: true };
}

export async function toggleRubroGastoActivo(
  rgId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const r = store.rubrosGasto.find((x) => x.id === rgId);
  if (!r) return { ok: false, errors: { _: ["No encontrado"] } };
  r.activo = !r.activo;
  revalidatePath("/catalogos/rubros-gasto");
  return { ok: true };
}
