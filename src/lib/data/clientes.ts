"use server";

import { and, asc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import { clientes as clientesTable } from "@/lib/db/schema";
import type { Cliente } from "@/lib/types";
import { clienteSchema } from "@/lib/validations/cliente";
import {
  fieldErrors,
  normPhone,
  requireRole,
  type ActionResult,
} from "./_helpers";

function mapCliente(row: typeof clientesTable.$inferSelect): Cliente {
  return {
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono ?? undefined,
    observacion: row.observacion ?? undefined,
    activo: row.activo,
    saldo_cc: row.saldoCc,
  };
}

export async function listClientes(opts?: {
  incluirInactivos?: boolean;
  q?: string;
}): Promise<Cliente[]> {
  const q = opts?.q?.trim();
  requireSupabaseRuntime(
    "Los clientes del sistema solo se cargan desde Supabase.",
  );

  const db = getDb();
  const filters = [];
  if (!opts?.incluirInactivos) filters.push(eq(clientesTable.activo, true));
  if (q) {
    filters.push(
      or(
        ilike(clientesTable.nombre, `%${q}%`),
        ilike(clientesTable.telefono, `%${q}%`),
      )!,
    );
  }

  const rows =
    filters.length > 0
      ? await db
          .select()
          .from(clientesTable)
          .where(and(...filters))
          .orderBy(asc(clientesTable.nombre))
      : await db
          .select()
          .from(clientesTable)
          .orderBy(asc(clientesTable.nombre));

  return rows.map(mapCliente);
}

export async function getCliente(clienteId: string): Promise<Cliente | null> {
  requireSupabaseRuntime(
    "Los clientes del sistema solo se cargan desde Supabase.",
  );

  const db = getDb();
  const [row] = await db
    .select()
    .from(clientesTable)
    .where(eq(clientesTable.id, clienteId))
    .limit(1);

  return row ? mapCliente(row) : null;
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
  requireSupabaseRuntime(
    "La creacion de clientes requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  await db.insert(clientesTable).values({
    id: crypto.randomUUID(),
    nombre: parsed.data.nombre,
    telefono: normPhone(parsed.data.telefono) ?? null,
    observacion: parsed.data.observacion ?? null,
    activo: parsed.data.activo,
    saldoCc: 0,
  });

  revalidatePath("/catalogos/clientes");
  revalidatePath("/ventas");
  revalidatePath("/ventas/nueva");
  return { ok: true };
}

export async function updateCliente(
  clienteId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime(
    "La edicion de clientes requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  const existing = await getCliente(clienteId);
  if (!existing) return { ok: false, errors: { _: ["No encontrado"] } };

  await db
    .update(clientesTable)
    .set({
      nombre: parsed.data.nombre,
      telefono: normPhone(parsed.data.telefono) ?? null,
      observacion: parsed.data.observacion ?? null,
      activo: parsed.data.activo,
    })
    .where(eq(clientesTable.id, clienteId));

  revalidatePath("/catalogos/clientes");
  revalidatePath("/ventas");
  revalidatePath("/ventas/nueva");
  return { ok: true };
}

export async function toggleClienteActivo(
  clienteId: string,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime(
    "La activacion de clientes requiere Supabase configurado.",
  );

  const cliente = await getCliente(clienteId);
  if (!cliente) return { ok: false, errors: { _: ["No encontrado"] } };

  const db = getDb();
  await db
    .update(clientesTable)
    .set({ activo: !cliente.activo })
    .where(eq(clientesTable.id, clienteId));

  revalidatePath("/catalogos/clientes");
  revalidatePath("/ventas");
  revalidatePath("/ventas/nueva");
  return { ok: true };
}
