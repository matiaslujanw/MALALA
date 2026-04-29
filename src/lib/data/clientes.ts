"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { clienteSchema } from "@/lib/validations/cliente";
import {
  fieldErrors,
  normPhone,
  requireRole,
  type ActionResult,
} from "./_helpers";
import type { Cliente } from "@/lib/types";

export async function listClientes(opts?: {
  incluirInactivos?: boolean;
  q?: string;
}): Promise<Cliente[]> {
  const q = opts?.q?.trim().toLowerCase();
  let arr = opts?.incluirInactivos
    ? [...store.clientes]
    : store.clientes.filter((c) => c.activo);
  if (q) {
    arr = arr.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.telefono ?? "").toLowerCase().includes(q),
    );
  }
  return arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function getCliente(clienteId: string): Promise<Cliente | null> {
  return store.clientes.find((c) => c.id === clienteId) ?? null;
}

function parse(formData: FormData) {
  return clienteSchema.safeParse({
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono"),
    observacion: formData.get("observacion"),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  });
}

export async function createCliente(formData: FormData): Promise<ActionResult> {
  await requireRole(["admin", "encargada", "empleado"]);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  store.clientes.push({
    id: id(),
    nombre: parsed.data.nombre,
    telefono: normPhone(parsed.data.telefono),
    observacion: parsed.data.observacion,
    activo: parsed.data.activo,
    saldo_cc: 0,
  });
  revalidatePath("/catalogos/clientes");
  return { ok: true };
}

export async function updateCliente(
  clienteId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada"]);
  const idx = store.clientes.findIndex((c) => c.id === clienteId);
  if (idx === -1) return { ok: false, errors: { _: ["No encontrado"] } };
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  store.clientes[idx] = {
    ...store.clientes[idx],
    nombre: parsed.data.nombre,
    telefono: normPhone(parsed.data.telefono),
    observacion: parsed.data.observacion,
    activo: parsed.data.activo,
  };
  revalidatePath("/catalogos/clientes");
  return { ok: true };
}

export async function toggleClienteActivo(
  clienteId: string,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada"]);
  const c = store.clientes.find((x) => x.id === clienteId);
  if (!c) return { ok: false, errors: { _: ["No encontrado"] } };
  c.activo = !c.activo;
  revalidatePath("/catalogos/clientes");
  return { ok: true };
}
