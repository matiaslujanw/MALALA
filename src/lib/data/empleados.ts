"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { empleadoSchema } from "@/lib/validations/empleado";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import type { Empleado } from "@/lib/types";

export async function listEmpleados(opts?: {
  incluirInactivos?: boolean;
  sucursalId?: string;
}): Promise<Empleado[]> {
  let arr = opts?.incluirInactivos
    ? [...store.empleados]
    : store.empleados.filter((e) => e.activo);
  if (opts?.sucursalId) {
    arr = arr.filter((e) => e.sucursal_principal_id === opts.sucursalId);
  }
  return arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function getEmpleado(empleadoId: string): Promise<Empleado | null> {
  return store.empleados.find((e) => e.id === empleadoId) ?? null;
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
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  store.empleados.push({ id: id(), ...parsed.data });
  revalidatePath("/catalogos/empleados");
  return { ok: true };
}

export async function updateEmpleado(
  empleadoId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const idx = store.empleados.findIndex((e) => e.id === empleadoId);
  if (idx === -1) return { ok: false, errors: { _: ["No encontrado"] } };
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  store.empleados[idx] = { ...store.empleados[idx], ...parsed.data };
  revalidatePath("/catalogos/empleados");
  return { ok: true };
}

export async function toggleEmpleadoActivo(
  empleadoId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const e = store.empleados.find((x) => x.id === empleadoId);
  if (!e) return { ok: false, errors: { _: ["No encontrado"] } };
  e.activo = !e.activo;
  revalidatePath("/catalogos/empleados");
  return { ok: true };
}
