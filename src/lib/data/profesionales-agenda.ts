"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client/postgres";
import {
  empleados as empleadosTable,
  profesionalesAgenda as profesionalesAgendaTable,
} from "@/lib/db/schema";
import { getProfesionalAgendaConfig } from "@/lib/data/profesionales-horarios";
import type { Usuario } from "@/lib/types";

function createId() {
  return crypto.randomUUID();
}

export type ActionResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> };

/** Solo admin/superadmin y encargada gestionan profesionales. */
function puedeGestionar(rol: Usuario["rol"]) {
  return rol === "admin" || rol === "superadmin" || rol === "encargada";
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Habilita a un empleado como profesional reservable en una sucursal: crea su
 * fila en `profesionales_agenda`. Sin esto, el empleado no aparece al reservar
 * online. Aísla por rol y por sucursal.
 */
export async function createProfesionalAgenda(
  empleadoId: string,
  formData: FormData,
): Promise<ActionResult> {
  "use server";
  const user = await requireUser();
  if (!puedeGestionar(user.rol)) {
    return { ok: false, errors: { _: ["No autorizado"] } };
  }

  const sucursalId = String(formData.get("sucursal_id") ?? "");
  const especialidad = String(formData.get("especialidad") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || "#8a9a5b";
  const prioridad = Number(formData.get("prioridad") ?? 0);

  const scope = buildAccessScope(user);
  if (!sucursalId || !isSucursalAllowed(scope, sucursalId)) {
    return { ok: false, errors: { sucursal_id: ["Sucursal inválida"] } };
  }
  if (!especialidad) {
    return { ok: false, errors: { especialidad: ["Indicá la especialidad"] } };
  }
  if (!HEX.test(color)) {
    return { ok: false, errors: { color: ["Color inválido"] } };
  }
  if (!Number.isInteger(prioridad) || prioridad < 0) {
    return { ok: false, errors: { prioridad: ["Prioridad inválida"] } };
  }

  const db = getDb();

  const [empleado] = await db
    .select({ id: empleadosTable.id })
    .from(empleadosTable)
    .where(eq(empleadosTable.id, empleadoId))
    .limit(1);
  if (!empleado) {
    return { ok: false, errors: { _: ["Empleado no encontrado"] } };
  }

  // Una sola agenda por empleado+sucursal.
  const [existente] = await db
    .select({ id: profesionalesAgendaTable.id })
    .from(profesionalesAgendaTable)
    .where(
      and(
        eq(profesionalesAgendaTable.empleadoId, empleadoId),
        eq(profesionalesAgendaTable.sucursalId, sucursalId),
      ),
    )
    .limit(1);
  if (existente) {
    return {
      ok: false,
      errors: { _: ["Este empleado ya está habilitado en esa sucursal"] },
    };
  }

  await db.insert(profesionalesAgendaTable).values({
    id: createId(),
    empleadoId,
    sucursalId,
    especialidad,
    avatarUrl: "",
    color,
    bio: null,
    prioridad,
    activoPublico: true,
  });

  revalidatePath(`/catalogos/empleados/${empleadoId}`);
  revalidatePath("/turnos");
  revalidatePath("/");
  return { ok: true };
}

/** Muestra/oculta al profesional en la reserva online (toggle activo_publico). */
export async function toggleProfesionalAgendaActivo(
  agendaId: string,
): Promise<ActionResult> {
  "use server";
  const user = await requireUser();
  if (!puedeGestionar(user.rol)) {
    return { ok: false, errors: { _: ["No autorizado"] } };
  }

  const agenda = await getProfesionalAgendaConfig(agendaId);
  if (!agenda) return { ok: false, errors: { _: ["No encontrado"] } };

  const scope = buildAccessScope(user);
  if (!isSucursalAllowed(scope, agenda.sucursal_id)) {
    return { ok: false, errors: { _: ["No autorizado para esta sucursal"] } };
  }

  const db = getDb();
  await db
    .update(profesionalesAgendaTable)
    .set({ activoPublico: !agenda.activo_publico })
    .where(eq(profesionalesAgendaTable.id, agendaId));

  revalidatePath(`/catalogos/empleados/${agenda.empleado_id}`);
  revalidatePath(`/turnos/profesionales/${agendaId}`);
  revalidatePath("/turnos");
  revalidatePath("/");
  return { ok: true };
}
