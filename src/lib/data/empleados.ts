"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import { empleados as empleadosTable } from "@/lib/db/schema";
import type { Empleado } from "@/lib/types";
import { empleadoSchema } from "@/lib/validations/empleado";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";

function mapEmpleado(row: typeof empleadosTable.$inferSelect): Empleado {
  return {
    id: row.id,
    nombre: row.nombre,
    activo: row.activo,
    sucursal_principal_id: row.sucursalPrincipalId,
    tipo_comision: row.tipoComision,
    porcentaje_default: row.porcentajeDefault,
    sueldo_asegurado: row.sueldoAsegurado,
    observacion: row.observacion ?? undefined,
  };
}

export async function listEmpleados(opts?: {
  incluirInactivos?: boolean;
  sucursalId?: string;
}): Promise<Empleado[]> {
  requireSupabaseRuntime(
    "Los empleados del back office solo se leen desde Supabase.",
  );

  const db = getDb();
  const filters = [];
  if (!opts?.incluirInactivos) filters.push(eq(empleadosTable.activo, true));
  if (opts?.sucursalId) {
    filters.push(eq(empleadosTable.sucursalPrincipalId, opts.sucursalId));
  }

  const rows =
    filters.length > 0
      ? await db
          .select()
          .from(empleadosTable)
          .where(and(...filters))
          .orderBy(asc(empleadosTable.nombre))
      : await db.select().from(empleadosTable).orderBy(asc(empleadosTable.nombre));

  return rows.map(mapEmpleado);
}

export async function getEmpleado(empleadoId: string): Promise<Empleado | null> {
  requireSupabaseRuntime(
    "Los empleados del back office solo se leen desde Supabase.",
  );

  const db = getDb();
  const [row] = await db
    .select()
    .from(empleadosTable)
    .where(eq(empleadosTable.id, empleadoId))
    .limit(1);

  return row ? mapEmpleado(row) : null;
}

function parse(formData: FormData) {
  return empleadoSchema.safeParse({
    nombre: formData.get("nombre"),
    sucursal_principal_id: formData.get("sucursal_principal_id"),
    tipo_comision: formData.get("tipo_comision"),
    porcentaje_default: formData.get("porcentaje_default"),
    sueldo_asegurado: formData.get("sueldo_asegurado"),
    observacion: formData.get("observacion"),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  });
}

export async function createEmpleado(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La creacion de empleados requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  await db.insert(empleadosTable).values({
    id: crypto.randomUUID(),
    nombre: parsed.data.nombre,
    activo: parsed.data.activo,
    sucursalPrincipalId: parsed.data.sucursal_principal_id,
    tipoComision: parsed.data.tipo_comision,
    porcentajeDefault: parsed.data.porcentaje_default,
    sueldoAsegurado: parsed.data.sueldo_asegurado,
    observacion: parsed.data.observacion ?? null,
  });

  revalidatePath("/catalogos/empleados");
  return { ok: true };
}

export async function updateEmpleado(
  empleadoId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La edicion de empleados requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  const existing = await getEmpleado(empleadoId);
  if (!existing) return { ok: false, errors: { _: ["No encontrado"] } };

  await db
    .update(empleadosTable)
    .set({
      nombre: parsed.data.nombre,
      activo: parsed.data.activo,
      sucursalPrincipalId: parsed.data.sucursal_principal_id,
      tipoComision: parsed.data.tipo_comision,
      porcentajeDefault: parsed.data.porcentaje_default,
      sueldoAsegurado: parsed.data.sueldo_asegurado,
      observacion: parsed.data.observacion ?? null,
    })
    .where(eq(empleadosTable.id, empleadoId));

  revalidatePath("/catalogos/empleados");
  return { ok: true };
}

export async function toggleEmpleadoActivo(
  empleadoId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La activacion de empleados requiere Supabase configurado.",
  );

  const empleado = await getEmpleado(empleadoId);
  if (!empleado) return { ok: false, errors: { _: ["No encontrado"] } };

  const db = getDb();
  await db
    .update(empleadosTable)
    .set({ activo: !empleado.activo })
    .where(eq(empleadosTable.id, empleadoId));

  revalidatePath("/catalogos/empleados");
  return { ok: true };
}
