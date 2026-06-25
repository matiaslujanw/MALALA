"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { horariosSucursal as horariosSucursalTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { buildAccessScope, esAdmin, isSucursalAllowed } from "@/lib/auth/access";
import type { HorarioSucursal, Usuario } from "@/lib/types";

function createId() {
  return crypto.randomUUID();
}

function mapHorario(
  row: typeof horariosSucursalTable.$inferSelect,
): HorarioSucursal {
  return {
    id: row.id,
    sucursal_id: row.sucursalId,
    dia_semana: row.diaSemana,
    apertura: row.apertura,
    cierre: row.cierre,
  };
}

export type ActionResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> };

/** Solo admin/superadmin y encargada pueden tocar los horarios de sucursal. */
function puedeEditarRol(rol: Usuario["rol"]) {
  return esAdmin(rol) || rol === "encargada";
}

/**
 * Autoriza por rol y por sucursal: un usuario de una sucursal no puede tocar
 * los horarios de otra. Devuelve el error correspondiente o `null` si pasa.
 */
function authorizeHorario(
  user: Usuario,
  sucursalId: string,
): Record<string, string[]> | null {
  if (!puedeEditarRol(user.rol)) return { _: ["No autorizado"] };
  const scope = buildAccessScope(user);
  if (!isSucursalAllowed(scope, sucursalId)) {
    return { _: ["No autorizado para esta sucursal"] };
  }
  return null;
}

/** Lista las franjas de atención de una sucursal, ordenadas por día y hora. */
export async function listSucursalHorarios(
  sucursalId: string,
): Promise<HorarioSucursal[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(horariosSucursalTable)
    .where(eq(horariosSucursalTable.sucursalId, sucursalId))
    .orderBy(
      asc(horariosSucursalTable.diaSemana),
      asc(horariosSucursalTable.apertura),
    );
  return rows.map(mapHorario);
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function addSucursalHorario(
  sucursalId: string,
  formData: FormData,
): Promise<ActionResult> {
  "use server";
  const user = await requireUser();
  const denied = authorizeHorario(user, sucursalId);
  if (denied) return { ok: false, errors: denied };

  const diaSemana = Number(formData.get("dia_semana"));
  const apertura = String(formData.get("apertura") ?? "");
  const cierre = String(formData.get("cierre") ?? "");

  if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) {
    return { ok: false, errors: { dia_semana: ["Día inválido"] } };
  }
  if (!HHMM.test(apertura) || !HHMM.test(cierre)) {
    return { ok: false, errors: { _: ["Horario inválido (usá HH:MM)"] } };
  }
  if (cierre <= apertura) {
    return {
      ok: false,
      errors: { _: ["El cierre debe ser posterior a la apertura"] },
    };
  }

  const db = getDb();
  await db.insert(horariosSucursalTable).values({
    id: createId(),
    sucursalId,
    diaSemana,
    apertura,
    cierre,
  });

  revalidatePath(`/catalogos/sucursales/${sucursalId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteSucursalHorario(
  horarioId: string,
): Promise<ActionResult> {
  "use server";
  const user = await requireUser();
  if (!puedeEditarRol(user.rol)) {
    return { ok: false, errors: { _: ["No autorizado"] } };
  }

  const db = getDb();
  const [row] = await db
    .select({ sucursalId: horariosSucursalTable.sucursalId })
    .from(horariosSucursalTable)
    .where(eq(horariosSucursalTable.id, horarioId))
    .limit(1);
  if (!row) return { ok: false, errors: { _: ["No encontrado"] } };

  // Aislamiento: no se puede borrar una franja de una sucursal ajena.
  const denied = authorizeHorario(user, row.sucursalId);
  if (denied) return { ok: false, errors: denied };

  await db
    .delete(horariosSucursalTable)
    .where(eq(horariosSucursalTable.id, horarioId));

  revalidatePath(`/catalogos/sucursales/${row.sucursalId}`);
  revalidatePath("/");
  return { ok: true };
}
