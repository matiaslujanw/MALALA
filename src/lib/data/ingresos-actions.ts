"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { ingresos as ingresosTable } from "@/lib/db/schema";
import type { CreateIngresoResult } from "./ingresos";
import { createIngreso as createIngresoImpl } from "./ingresos";
import { failure, requireRole, type ActionResult } from "./_helpers";

export async function createIngreso(formData: FormData): Promise<CreateIngresoResult> {
  return createIngresoImpl(formData);
}

/**
 * Marca si el cliente quedó satisfecho con la venta (con motivo opcional). La
 * marca quien registra/gestiona la venta (admin/encargada). Internamente reutiliza
 * la columna `revision`: "ok" = satisfecho, "error" = no satisfecho.
 */
export async function setSatisfaccionVenta(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "encargada"]);

  const id = String(formData.get("ingreso_id") ?? "");
  if (!id) return failure("Venta no encontrada");

  const estado = String(formData.get("estado") ?? ""); // "ok" | "error"
  const revision = estado === "ok" || estado === "error" ? estado : null;
  const nota = String(formData.get("satisfaccion_nota") ?? "").trim();

  const db = getDb();
  const [existing] = await db
    .select({ id: ingresosTable.id })
    .from(ingresosTable)
    .where(eq(ingresosTable.id, id))
    .limit(1);
  if (!existing) return failure("Venta no encontrada");

  await db
    .update(ingresosTable)
    .set({
      revision,
      revisionNota: revision === "error" ? nota || null : null,
      revisadoPor: revision ? user.id : null,
      revisadoEn: revision ? new Date() : null,
    })
    .where(eq(ingresosTable.id, id));

  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  return { ok: true };
}
