"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import { motivosDescuento as motivosDescuentoTable } from "@/lib/db/schema";
import type { MotivoDescuento } from "@/lib/types";
import { motivoDescuentoSchema } from "@/lib/validations/motivo-descuento";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";

function mapMotivoDescuento(
  row: typeof motivosDescuentoTable.$inferSelect,
): MotivoDescuento {
  return {
    id: row.id,
    nombre: row.nombre,
    activo: row.activo,
  };
}

export async function listMotivosDescuento(): Promise<MotivoDescuento[]> {
  requireSupabaseRuntime(
    "Los motivos de descuento solo se cargan desde Supabase.",
  );

  const db = getDb();
  const rows = await db
    .select()
    .from(motivosDescuentoTable)
    .orderBy(asc(motivosDescuentoTable.nombre));
  return rows.map(mapMotivoDescuento);
}

export async function createMotivoDescuento(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La creacion de motivos de descuento requiere Supabase configurado.",
  );
  const parsed = motivoDescuentoSchema.safeParse({
    nombre: formData.get("nombre"),
    activo: true,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  await db.insert(motivosDescuentoTable).values({
    id: crypto.randomUUID(),
    nombre: parsed.data.nombre,
    activo: true,
  });

  revalidatePath("/catalogos/motivos-descuento");
  revalidatePath("/ventas/nueva");
  return { ok: true };
}

export async function toggleMotivoDescuentoActivo(
  mdId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La activacion de motivos de descuento requiere Supabase configurado.",
  );

  const db = getDb();
  const [motivo] = await db
    .select()
    .from(motivosDescuentoTable)
    .where(eq(motivosDescuentoTable.id, mdId))
    .limit(1);
  if (!motivo) return { ok: false, errors: { _: ["No encontrado"] } };

  await db
    .update(motivosDescuentoTable)
    .set({ activo: !motivo.activo })
    .where(eq(motivosDescuentoTable.id, mdId));

  revalidatePath("/catalogos/motivos-descuento");
  revalidatePath("/ventas/nueva");
  return { ok: true };
}
