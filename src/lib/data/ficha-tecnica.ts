"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import {
  clienteFichaRegistros as registrosTable,
  clientes as clientesTable,
  empleados as empleadosTable,
  servicios as serviciosTable,
} from "@/lib/db/schema";
import type { FichaRegistro } from "@/lib/types";
import {
  fichaPerfilSchema,
  fichaRegistroSchema,
} from "@/lib/validations/ficha-tecnica";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";

export async function listFichaRegistros(
  clienteId: string,
): Promise<FichaRegistro[]> {
  requireSupabaseRuntime("La ficha técnica requiere Supabase configurado.");
  const db = getDb();
  const rows = await db
    .select({
      id: registrosTable.id,
      clienteId: registrosTable.clienteId,
      fecha: registrosTable.fecha,
      servicioId: registrosTable.servicioId,
      servicioNombre: serviciosTable.nombre,
      formula: registrosTable.formula,
      notas: registrosTable.notas,
      empleadoId: registrosTable.empleadoId,
      empleadoNombre: empleadosTable.nombre,
      usuarioId: registrosTable.usuarioId,
      creadoEn: registrosTable.creadoEn,
    })
    .from(registrosTable)
    .leftJoin(serviciosTable, eq(registrosTable.servicioId, serviciosTable.id))
    .leftJoin(empleadosTable, eq(registrosTable.empleadoId, empleadosTable.id))
    .where(eq(registrosTable.clienteId, clienteId))
    .orderBy(desc(registrosTable.fecha), desc(registrosTable.creadoEn));

  return rows.map((r) => ({
    id: r.id,
    cliente_id: r.clienteId,
    fecha: r.fecha.toISOString(),
    servicio_id: r.servicioId ?? undefined,
    servicio_nombre: r.servicioNombre ?? undefined,
    formula: r.formula ?? undefined,
    notas: r.notas ?? undefined,
    empleado_id: r.empleadoId ?? undefined,
    empleado_nombre: r.empleadoNombre ?? undefined,
    usuario_id: r.usuarioId,
    creado_en: r.creadoEn.toISOString(),
  }));
}

export async function updateFichaPerfil(
  clienteId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada", "empleado"]);
  requireSupabaseRuntime("La ficha técnica requiere Supabase configurado.");

  const parsed = fichaPerfilSchema.safeParse({
    tipo_cabello: formData.get("tipo_cabello"),
    salud_cabello: formData.get("salud_cabello"),
    alergias: formData.get("alergias"),
    color_actual: formData.get("color_actual"),
    observaciones_tecnicas: formData.get("observaciones_tecnicas"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  const [existing] = await db
    .select({ id: clientesTable.id })
    .from(clientesTable)
    .where(eq(clientesTable.id, clienteId))
    .limit(1);
  if (!existing) return { ok: false, errors: { _: ["Cliente no encontrado"] } };

  await db
    .update(clientesTable)
    .set({
      tipoCabello: parsed.data.tipo_cabello ?? null,
      saludCabello: parsed.data.salud_cabello ?? null,
      alergias: parsed.data.alergias ?? null,
      colorActual: parsed.data.color_actual ?? null,
      observacionesTecnicas: parsed.data.observaciones_tecnicas ?? null,
    })
    .where(eq(clientesTable.id, clienteId));

  revalidatePath(`/catalogos/clientes/${clienteId}`);
  return { ok: true };
}

export async function addFichaRegistro(
  clienteId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "encargada", "empleado"]);
  requireSupabaseRuntime("La ficha técnica requiere Supabase configurado.");

  const parsed = fichaRegistroSchema.safeParse({
    fecha: formData.get("fecha"),
    servicio_id: formData.get("servicio_id"),
    formula: formData.get("formula"),
    notas: formData.get("notas"),
    empleado_id: formData.get("empleado_id"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  const [existing] = await db
    .select({ id: clientesTable.id })
    .from(clientesTable)
    .where(eq(clientesTable.id, clienteId))
    .limit(1);
  if (!existing) return { ok: false, errors: { _: ["Cliente no encontrado"] } };

  await db.insert(registrosTable).values({
    id: crypto.randomUUID(),
    clienteId,
    // `fecha` viene como YYYY-MM-DD; se interpreta como mediodía local para
    // evitar corrimientos de día por zona horaria.
    fecha: new Date(`${parsed.data.fecha}T12:00:00`),
    servicioId: parsed.data.servicio_id ?? null,
    formula: parsed.data.formula ?? null,
    notas: parsed.data.notas ?? null,
    empleadoId: parsed.data.empleado_id ?? null,
    usuarioId: user.id,
  });

  revalidatePath(`/catalogos/clientes/${clienteId}`);
  return { ok: true };
}

export async function deleteFichaRegistro(
  registroId: string,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("La ficha técnica requiere Supabase configurado.");

  const db = getDb();
  const [row] = await db
    .select({ clienteId: registrosTable.clienteId })
    .from(registrosTable)
    .where(eq(registrosTable.id, registroId))
    .limit(1);
  if (!row) return { ok: false, errors: { _: ["Registro no encontrado"] } };

  await db.delete(registrosTable).where(eq(registrosTable.id, registroId));

  revalidatePath(`/catalogos/clientes/${row.clienteId}`);
  return { ok: true };
}
