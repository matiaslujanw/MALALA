"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import { insumos as insumosTable } from "@/lib/db/schema";
import type { Insumo } from "@/lib/types";
import { insumoSchema } from "@/lib/validations/insumo";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";

function mapInsumo(row: typeof insumosTable.$inferSelect): Insumo {
  return {
    id: row.id,
    nombre: row.nombre,
    proveedor_id: row.proveedorId ?? undefined,
    unidad_medida: row.unidadMedida,
    tamano_envase: row.tamanoEnvase,
    precio_envase: row.precioEnvase,
    precio_unitario: row.precioUnitario,
    rinde: row.rinde ?? undefined,
    umbral_stock_bajo: row.umbralStockBajo,
    activo: row.activo,
  };
}

export async function listInsumos(opts?: {
  incluirInactivos?: boolean;
}): Promise<Insumo[]> {
  requireSupabaseRuntime(
    "Los insumos del sistema solo se cargan desde Supabase.",
  );

  const db = getDb();
  const rows = opts?.incluirInactivos
    ? await db.select().from(insumosTable).orderBy(asc(insumosTable.nombre))
    : await db
        .select()
        .from(insumosTable)
        .where(eq(insumosTable.activo, true))
        .orderBy(asc(insumosTable.nombre));
  return rows.map(mapInsumo);
}

export async function getInsumo(insumoId: string): Promise<Insumo | null> {
  requireSupabaseRuntime(
    "Los insumos del sistema solo se cargan desde Supabase.",
  );

  const db = getDb();
  const [row] = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.id, insumoId))
    .limit(1);
  return row ? mapInsumo(row) : null;
}

function parse(formData: FormData) {
  return insumoSchema.safeParse({
    nombre: formData.get("nombre"),
    proveedor_id: formData.get("proveedor_id"),
    unidad_medida: formData.get("unidad_medida"),
    tamano_envase: formData.get("tamano_envase"),
    precio_envase: formData.get("precio_envase"),
    rinde: formData.get("rinde"),
    umbral_stock_bajo: formData.get("umbral_stock_bajo"),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  });
}

export async function createInsumo(formData: FormData): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La creacion de insumos requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  await db.insert(insumosTable).values({
    id: crypto.randomUUID(),
    nombre: parsed.data.nombre,
    proveedorId: parsed.data.proveedor_id ?? null,
    unidadMedida: parsed.data.unidad_medida,
    tamanoEnvase: parsed.data.tamano_envase,
    precioEnvase: parsed.data.precio_envase,
    precioUnitario: parsed.data.precio_unitario,
    rinde: parsed.data.rinde ?? null,
    umbralStockBajo: parsed.data.umbral_stock_bajo,
    activo: parsed.data.activo,
  });

  revalidatePath("/catalogos/insumos");
  revalidatePath("/catalogos/recetas");
  revalidatePath("/egresos");
  revalidatePath("/stock");
  return { ok: true };
}

export async function updateInsumo(
  insumoId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La edicion de insumos requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  const existing = await getInsumo(insumoId);
  if (!existing) return { ok: false, errors: { _: ["No encontrado"] } };

  await db
    .update(insumosTable)
    .set({
      nombre: parsed.data.nombre,
      proveedorId: parsed.data.proveedor_id ?? null,
      unidadMedida: parsed.data.unidad_medida,
      tamanoEnvase: parsed.data.tamano_envase,
      precioEnvase: parsed.data.precio_envase,
      precioUnitario: parsed.data.precio_unitario,
      rinde: parsed.data.rinde ?? null,
      umbralStockBajo: parsed.data.umbral_stock_bajo,
      activo: parsed.data.activo,
    })
    .where(eq(insumosTable.id, insumoId));

  revalidatePath("/catalogos/insumos");
  revalidatePath("/catalogos/recetas");
  revalidatePath("/egresos");
  revalidatePath("/stock");
  return { ok: true };
}

export async function toggleInsumoActivo(
  insumoId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La activacion de insumos requiere Supabase configurado.",
  );

  const insumo = await getInsumo(insumoId);
  if (!insumo) return { ok: false, errors: { _: ["No encontrado"] } };

  const db = getDb();
  await db
    .update(insumosTable)
    .set({ activo: !insumo.activo })
    .where(eq(insumosTable.id, insumoId));

  revalidatePath("/catalogos/insumos");
  revalidatePath("/catalogos/recetas");
  revalidatePath("/egresos");
  revalidatePath("/stock");
  return { ok: true };
}
