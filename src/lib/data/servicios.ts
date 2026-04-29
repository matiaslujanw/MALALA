"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { id, store } from "@/lib/mock/store";
import { servicioSchema } from "@/lib/validations/servicio";
import type { Servicio } from "@/lib/types";

export async function listServicios(opts?: { incluirInactivos?: boolean }): Promise<Servicio[]> {
  const arr = opts?.incluirInactivos
    ? [...store.servicios]
    : store.servicios.filter((s) => s.activo);
  return arr.sort((a, b) => {
    if (a.rubro !== b.rubro) return a.rubro.localeCompare(b.rubro);
    return a.nombre.localeCompare(b.nombre);
  });
}

export async function getServicio(servicioId: string): Promise<Servicio | null> {
  return store.servicios.find((s) => s.id === servicioId) ?? null;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> };

function fieldErrors(err: unknown): Record<string, string[]> {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] }).issues;
    const out: Record<string, string[]> = {};
    for (const i of issues) {
      const key = i.path.join(".") || "_";
      (out[key] ??= []).push(i.message);
    }
    return out;
  }
  return { _: ["Error desconocido"] };
}

export async function createServicio(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.rol !== "admin") {
    return { ok: false, errors: { _: ["Solo admin puede crear servicios"] } };
  }

  const parsed = servicioSchema.safeParse({
    rubro: formData.get("rubro"),
    nombre: formData.get("nombre"),
    precio_lista: formData.get("precio_lista"),
    precio_efectivo: formData.get("precio_efectivo"),
    comision_default_pct: formData.get("comision_default_pct"),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  store.servicios.push({ id: id(), ...parsed.data });
  revalidatePath("/catalogos/servicios");
  return { ok: true };
}

export async function updateServicio(
  servicioId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (user.rol !== "admin") {
    return { ok: false, errors: { _: ["Solo admin puede editar servicios"] } };
  }

  const idx = store.servicios.findIndex((s) => s.id === servicioId);
  if (idx === -1) return { ok: false, errors: { _: ["Servicio no encontrado"] } };

  const parsed = servicioSchema.safeParse({
    rubro: formData.get("rubro"),
    nombre: formData.get("nombre"),
    precio_lista: formData.get("precio_lista"),
    precio_efectivo: formData.get("precio_efectivo"),
    comision_default_pct: formData.get("comision_default_pct"),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  store.servicios[idx] = { ...store.servicios[idx], ...parsed.data };
  revalidatePath("/catalogos/servicios");
  return { ok: true };
}

export async function toggleServicioActivo(servicioId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (user.rol !== "admin") {
    return { ok: false, errors: { _: ["Solo admin"] } };
  }
  const s = store.servicios.find((x) => x.id === servicioId);
  if (!s) return { ok: false, errors: { _: ["No encontrado"] } };
  s.activo = !s.activo;
  revalidatePath("/catalogos/servicios");
  return { ok: true };
}
