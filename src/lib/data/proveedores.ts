"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import { proveedores as proveedoresTable } from "@/lib/db/schema";
import type { Proveedor } from "@/lib/types";
import { proveedorSchema } from "@/lib/validations/proveedor";
import {
  fieldErrors,
  normPhone,
  requireRole,
  type ActionResult,
} from "./_helpers";

function mapProveedor(row: typeof proveedoresTable.$inferSelect): Proveedor {
  return {
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono ?? undefined,
    cuit: row.cuit ?? undefined,
    deuda_pendiente: row.deudaPendiente,
  };
}

export async function listProveedores(): Promise<Proveedor[]> {
  requireSupabaseRuntime(
    "Los proveedores del sistema solo se cargan desde Supabase.",
  );

  const db = getDb();
  const rows = await db
    .select()
    .from(proveedoresTable)
    .orderBy(asc(proveedoresTable.nombre));
  return rows.map(mapProveedor);
}

export async function getProveedor(
  proveedorId: string,
): Promise<Proveedor | null> {
  requireSupabaseRuntime(
    "Los proveedores del sistema solo se cargan desde Supabase.",
  );

  const db = getDb();
  const [row] = await db
    .select()
    .from(proveedoresTable)
    .where(eq(proveedoresTable.id, proveedorId))
    .limit(1);
  return row ? mapProveedor(row) : null;
}

function parse(formData: FormData) {
  return proveedorSchema.safeParse({
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono"),
    cuit: formData.get("cuit"),
  });
}

export async function createProveedor(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime(
    "La creacion de proveedores requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  await db.insert(proveedoresTable).values({
    id: crypto.randomUUID(),
    nombre: parsed.data.nombre,
    telefono: normPhone(parsed.data.telefono) ?? null,
    cuit: parsed.data.cuit ?? null,
    deudaPendiente: 0,
  });

  revalidatePath("/catalogos/proveedores");
  revalidatePath("/egresos");
  return { ok: true };
}

export async function updateProveedor(
  proveedorId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime(
    "La edicion de proveedores requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  const existing = await getProveedor(proveedorId);
  if (!existing) return { ok: false, errors: { _: ["No encontrado"] } };

  await db
    .update(proveedoresTable)
    .set({
      nombre: parsed.data.nombre,
      telefono: normPhone(parsed.data.telefono) ?? null,
      cuit: parsed.data.cuit ?? null,
    })
    .where(eq(proveedoresTable.id, proveedorId));

  revalidatePath("/catalogos/proveedores");
  revalidatePath("/egresos");
  return { ok: true };
}
