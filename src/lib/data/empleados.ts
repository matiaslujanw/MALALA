"use server";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { createSupabaseAdminClient } from "@/lib/db/client/supabase-admin";
import { requireSupabaseRuntime } from "@/lib/db/env";
import {
  empleados as empleadosTable,
  profiles as profilesTable,
} from "@/lib/db/schema";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import type { Empleado, Rol } from "@/lib/types";
import { empleadoSchema } from "@/lib/validations/empleado";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";

/** Roles que un usuario puede asignar al crear un acceso (anti escalamiento). */
function rolesAsignables(rol: Rol): Rol[] {
  if (rol === "superadmin") return ["empleado", "encargada", "admin"];
  if (rol === "admin") return ["empleado", "encargada"];
  return [];
}

const accesoSchema = z.object({
  email: z.string().email("Email inválido").transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  rol: z.enum(["empleado", "encargada", "admin"]),
});

export interface AccesoEmpleado {
  email: string;
  rol: Rol;
  activo: boolean;
}

export async function getAccesoDeEmpleado(
  empleadoId: string,
): Promise<AccesoEmpleado | null> {
  requireSupabaseRuntime("Los accesos solo se leen desde Supabase.");
  const db = getDb();
  const [row] = await db
    .select({
      email: profilesTable.email,
      rol: profilesTable.rol,
      activo: profilesTable.activo,
    })
    .from(profilesTable)
    .where(eq(profilesTable.empleadoId, empleadoId))
    .limit(1);
  return row ?? null;
}

/**
 * Crea el usuario de Supabase Auth + el profile ligado a un empleado.
 * La contraseña es temporal/aleatoria (la definición real queda para un paso
 * posterior). Si falla la inserción del profile, borra el usuario de Auth.
 */
async function crearAccesoInterno(opts: {
  empleadoId: string;
  email: string;
  password: string;
  nombre: string;
  rol: Rol;
  sucursalId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
  });
  if (error || !data?.user) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo crear el usuario de acceso",
    };
  }
  const userId = data.user.id;
  try {
    const db = getDb();
    await db.insert(profilesTable).values({
      userId,
      email: opts.email,
      nombre: opts.nombre,
      rol: opts.rol,
      sucursalDefaultId: opts.sucursalId,
      empleadoId: opts.empleadoId,
      activo: true,
    });
    return { ok: true };
  } catch {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { ok: false, error: "No se pudo crear el perfil de acceso" };
  }
}

function mapEmpleado(row: typeof empleadosTable.$inferSelect): Empleado {
  return {
    id: row.id,
    nombre: row.nombre,
    activo: row.activo,
    sucursal_principal_id: row.sucursalPrincipalId,
    tipo_comision: row.tipoComision,
    porcentaje_default: row.porcentajeDefault,
    sueldo_asegurado: row.sueldoAsegurado,
    valor_hora: row.valorHora,
    viatico_por_dia: row.viaticoPorDia,
    horas_por_dia: row.horasPorDia,
    dias_trabajo: row.diasTrabajo ?? [],
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
    valor_hora: formData.get("valor_hora"),
    viatico_por_dia: formData.get("viatico_por_dia"),
    horas_por_dia: formData.get("horas_por_dia"),
    dias_trabajo: formData.getAll("dias_trabajo"),
    observacion: formData.get("observacion"),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  });
}

export async function createEmpleado(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La creacion de empleados requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const scope = buildAccessScope(user);
  if (!isSucursalAllowed(scope, parsed.data.sucursal_principal_id)) {
    return {
      ok: false,
      errors: { sucursal_principal_id: ["No podés crear empleados en esa sucursal"] },
    };
  }

  // Acceso opcional al sistema (login)
  const crearAcceso =
    formData.get("crear_acceso") === "on" ||
    formData.get("crear_acceso") === "true";
  let acceso: { email: string; password: string; rol: Rol } | null = null;
  if (crearAcceso) {
    const parsedAcceso = accesoSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      rol: formData.get("rol"),
    });
    if (!parsedAcceso.success) {
      return { ok: false, errors: fieldErrors(parsedAcceso.error) };
    }
    if (!rolesAsignables(user.rol).includes(parsedAcceso.data.rol)) {
      return { ok: false, errors: { rol: ["No podés asignar ese rol"] } };
    }
    acceso = parsedAcceso.data;
  }

  const db = getDb();
  const empleadoId = crypto.randomUUID();
  await db.insert(empleadosTable).values({
    id: empleadoId,
    nombre: parsed.data.nombre,
    activo: parsed.data.activo,
    sucursalPrincipalId: parsed.data.sucursal_principal_id,
    tipoComision: parsed.data.tipo_comision,
    porcentajeDefault: parsed.data.porcentaje_default,
    valorHora: parsed.data.valor_hora,
    viaticoPorDia: parsed.data.viatico_por_dia,
    horasPorDia: parsed.data.horas_por_dia,
    diasTrabajo: parsed.data.dias_trabajo,
    observacion: parsed.data.observacion ?? null,
  });

  if (acceso) {
    const res = await crearAccesoInterno({
      empleadoId,
      email: acceso.email,
      password: acceso.password,
      nombre: parsed.data.nombre,
      rol: acceso.rol,
      sucursalId: parsed.data.sucursal_principal_id,
    });
    if (!res.ok) {
      // Compensar: el empleado quedó creado pero el acceso falló → revertir empleado
      await db.delete(empleadosTable).where(eq(empleadosTable.id, empleadoId));
      return { ok: false, errors: { _: [res.error] } };
    }
  }

  revalidatePath("/catalogos/empleados");
  return { ok: true };
}

/**
 * Crea acceso (login) para un empleado que ya existe y todavía no lo tiene.
 */
export async function crearAccesoEmpleado(
  empleadoId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin"]);
  requireSupabaseRuntime("La creación de accesos requiere Supabase configurado.");

  const empleado = await getEmpleado(empleadoId);
  if (!empleado) return { ok: false, errors: { _: ["Empleado no encontrado"] } };

  const scope = buildAccessScope(user);
  if (!isSucursalAllowed(scope, empleado.sucursal_principal_id)) {
    return { ok: false, errors: { _: ["No podés gestionar empleados de esa sucursal"] } };
  }

  const yaTiene = await getAccesoDeEmpleado(empleadoId);
  if (yaTiene) {
    return { ok: false, errors: { _: ["Este empleado ya tiene un acceso"] } };
  }

  const parsedAcceso = accesoSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rol: formData.get("rol"),
  });
  if (!parsedAcceso.success) {
    return { ok: false, errors: fieldErrors(parsedAcceso.error) };
  }
  if (!rolesAsignables(user.rol).includes(parsedAcceso.data.rol)) {
    return { ok: false, errors: { rol: ["No podés asignar ese rol"] } };
  }

  const res = await crearAccesoInterno({
    empleadoId,
    email: parsedAcceso.data.email,
    password: parsedAcceso.data.password,
    nombre: empleado.nombre,
    rol: parsedAcceso.data.rol,
    sucursalId: empleado.sucursal_principal_id,
  });
  if (!res.ok) return { ok: false, errors: { _: [res.error] } };

  revalidatePath(`/catalogos/empleados/${empleadoId}`);
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
      valorHora: parsed.data.valor_hora,
      viaticoPorDia: parsed.data.viatico_por_dia,
      horasPorDia: parsed.data.horas_por_dia,
      diasTrabajo: parsed.data.dias_trabajo,
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
