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
 * Marca una venta como correcta ("ok") o con error ("error"), o la deja sin
 * revisar (cualquier otro valor). Solo admin/encargada (es una auditoría sobre
 * el trabajo del empleado).
 */
export async function setRevisionVenta(formData: FormData): Promise<ActionResult> {
  const user = await requireRole(["admin", "encargada"]);

  const id = String(formData.get("ingreso_id") ?? "");
  if (!id) return failure("Venta no encontrada");

  const estadoRaw = String(formData.get("estado") ?? "");
  const revision =
    estadoRaw === "ok" || estadoRaw === "error" ? estadoRaw : null;
  const nota = String(formData.get("revision_nota") ?? "").trim();

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
      revisionNota: revision ? nota || null : null,
      revisadoPor: revision ? user.id : null,
      revisadoEn: revision ? new Date() : null,
    })
    .where(eq(ingresosTable.id, id));

  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  return { ok: true };
}
