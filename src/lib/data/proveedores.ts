"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { proveedorSchema } from "@/lib/validations/proveedor";
import {
  fieldErrors,
  normPhone,
  requireRole,
  type ActionResult,
} from "./_helpers";
import type { Proveedor } from "@/lib/types";

export async function listProveedores(): Promise<Proveedor[]> {
  return [...store.proveedores].sort((a, b) =>
    a.nombre.localeCompare(b.nombre),
  );
}

export async function getProveedor(
  proveedorId: string,
): Promise<Proveedor | null> {
  return store.proveedores.find((p) => p.id === proveedorId) ?? null;
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
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  store.proveedores.push({
    id: id(),
    nombre: parsed.data.nombre,
    telefono: normPhone(parsed.data.telefono),
    cuit: parsed.data.cuit,
    deuda_pendiente: 0,
  });
  revalidatePath("/catalogos/proveedores");
  return { ok: true };
}

export async function updateProveedor(
  proveedorId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada"]);
  const idx = store.proveedores.findIndex((p) => p.id === proveedorId);
  if (idx === -1) return { ok: false, errors: { _: ["No encontrado"] } };
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  store.proveedores[idx] = {
    ...store.proveedores[idx],
    nombre: parsed.data.nombre,
    telefono: normPhone(parsed.data.telefono),
    cuit: parsed.data.cuit,
  };
  revalidatePath("/catalogos/proveedores");
  return { ok: true };
}
