"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { mediosPago as mediosPagoTable } from "@/lib/db/schema";
import { medioPagoSchema } from "@/lib/validations/medio-pago";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import type { MedioPago } from "@/lib/types";

function createId() {
  return crypto.randomUUID();
}

function mapMedioPago(row: typeof mediosPagoTable.$inferSelect): MedioPago {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    activo: row.activo,
  };
}

export async function listMediosPago(): Promise<MedioPago[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mediosPagoTable)
    .orderBy(asc(mediosPagoTable.codigo), asc(mediosPagoTable.nombre));
  return rows.map(mapMedioPago);
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

  const db = getDb();
  const [existing] = await db
    .select({ id: mediosPagoTable.id })
    .from(mediosPagoTable)
    .where(eq(mediosPagoTable.codigo, parsed.data.codigo))
    .limit(1);
  if (existing) {
    return { ok: false, errors: { codigo: ["Ya existe ese codigo"] } };
  }

  await db.insert(mediosPagoTable).values({
    id: createId(),
    codigo: parsed.data.codigo,
    nombre: parsed.data.nombre,
    activo: true,
  });
  revalidatePath("/catalogos/medios-pago");
  return { ok: true };
}

export async function toggleMedioPagoActivo(
  mpId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const db = getDb();
  const [medioPago] = await db
    .select()
    .from(mediosPagoTable)
    .where(eq(mediosPagoTable.id, mpId))
    .limit(1);
  if (!medioPago) return { ok: false, errors: { _: ["No encontrado"] } };

  await db
    .update(mediosPagoTable)
    .set({ activo: !medioPago.activo })
    .where(eq(mediosPagoTable.id, mpId));
  revalidatePath("/catalogos/medios-pago");
  return { ok: true };
}
