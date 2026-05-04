"use server";

import { asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import {
  insumos as insumosTable,
  recetas as recetasTable,
  servicios as serviciosTable,
} from "@/lib/db/schema";
import type { Insumo, Receta, Servicio } from "@/lib/types";
import { recetaItemSchema } from "@/lib/validations/receta";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";

export interface RecetaResumen {
  servicio: Servicio;
  cantidadInsumos: number;
  costoTotal: number;
}

export interface RecetaItemDetalle {
  receta: Receta;
  insumo: Insumo;
  costo: number;
}

function mapServicio(row: typeof serviciosTable.$inferSelect): Servicio {
  return {
    id: row.id,
    rubro: row.rubro,
    nombre: row.nombre,
    precio_lista: row.precioLista,
    precio_efectivo: row.precioEfectivo,
    comision_default_pct: row.comisionDefaultPct,
    activo: row.activo,
    duracion_min: row.duracionMin ?? undefined,
    descripcion_corta: row.descripcionCorta ?? undefined,
    destacado_pct: row.destacadoPct ?? undefined,
  };
}

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

function mapReceta(row: typeof recetasTable.$inferSelect): Receta {
  return {
    id: row.id,
    servicio_id: row.servicioId,
    insumo_id: row.insumoId,
    cantidad: row.cantidad,
  };
}

async function loadCatalogs() {
  const db = getDb();
  const [serviciosRows, insumosRows, recetasRows] = await Promise.all([
    db
      .select()
      .from(serviciosTable)
      .orderBy(asc(serviciosTable.rubro), asc(serviciosTable.nombre)),
    db.select().from(insumosTable).orderBy(asc(insumosTable.nombre)),
    db.select().from(recetasTable),
  ]);

  return {
    servicios: serviciosRows.map(mapServicio),
    insumos: insumosRows.map(mapInsumo),
    recetas: recetasRows.map(mapReceta),
  };
}

export async function listRecetasResumen(): Promise<RecetaResumen[]> {
  requireSupabaseRuntime(
    "Las recetas del sistema solo se cargan desde Supabase.",
  );

  const { servicios, insumos, recetas } = await loadCatalogs();
  const insumoMap = new Map(insumos.map((item) => [item.id, item]));

  return servicios
    .filter((servicio) => servicio.activo)
    .map((servicio) => {
      const items = recetas.filter((receta) => receta.servicio_id === servicio.id);
      const costoTotal = items.reduce((acc, receta) => {
        const insumo = insumoMap.get(receta.insumo_id);
        if (!insumo || insumo.precio_unitario == null) return acc;
        return acc + receta.cantidad * insumo.precio_unitario;
      }, 0);
      return { servicio, cantidadInsumos: items.length, costoTotal };
    });
}

export async function getRecetaItems(
  servicioId: string,
): Promise<RecetaItemDetalle[]> {
  requireSupabaseRuntime(
    "Las recetas del sistema solo se cargan desde Supabase.",
  );

  const db = getDb();
  const recetaRows = await db
    .select()
    .from(recetasTable)
    .where(eq(recetasTable.servicioId, servicioId));
  if (recetaRows.length === 0) return [];

  const insumoIds = recetaRows.map((item) => item.insumoId);
  const insumosRows = await db
    .select()
    .from(insumosTable)
    .where(inArray(insumosTable.id, insumoIds))
    .orderBy(asc(insumosTable.nombre));
  const insumoMap = new Map(insumosRows.map((item) => [item.id, mapInsumo(item)]));

  return recetaRows
    .map((row) => {
      const insumo = insumoMap.get(row.insumoId);
      if (!insumo) return null;
      const receta = mapReceta(row);
      const costo =
        insumo.precio_unitario != null ? receta.cantidad * insumo.precio_unitario : 0;
      return { receta, insumo, costo };
    })
    .filter((item): item is RecetaItemDetalle => item != null)
    .sort((a, b) => a.insumo.nombre.localeCompare(b.insumo.nombre));
}

export async function listRecetasByServicio(
  servicioId: string,
): Promise<Receta[]> {
  const items = await getRecetaItems(servicioId);
  return items.map((item) => item.receta);
}

export async function upsertRecetaItem(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La edicion de recetas requiere Supabase configurado.",
  );
  const parsed = recetaItemSchema.safeParse({
    servicio_id: formData.get("servicio_id"),
    insumo_id: formData.get("insumo_id"),
    cantidad: formData.get("cantidad"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  const existingRows = await db
    .select()
    .from(recetasTable)
    .where(eq(recetasTable.servicioId, parsed.data.servicio_id))
    .limit(500);
  const duplicate = existingRows.find(
    (item) => item.insumoId === parsed.data.insumo_id,
  );

  if (duplicate) {
    await db
      .update(recetasTable)
      .set({ cantidad: parsed.data.cantidad })
      .where(eq(recetasTable.id, duplicate.id));
  } else {
    await db.insert(recetasTable).values({
      id: crypto.randomUUID(),
      servicioId: parsed.data.servicio_id,
      insumoId: parsed.data.insumo_id,
      cantidad: parsed.data.cantidad,
    });
  }

  revalidatePath("/catalogos/recetas");
  revalidatePath(`/catalogos/recetas/${parsed.data.servicio_id}`);
  revalidatePath("/ventas");
  revalidatePath("/stock");
  return { ok: true };
}

export async function removeRecetaItem(
  recetaId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La edicion de recetas requiere Supabase configurado.",
  );

  const db = getDb();
  const [row] = await db
    .select()
    .from(recetasTable)
    .where(eq(recetasTable.id, recetaId))
    .limit(1);
  if (!row) return { ok: false, errors: { _: ["No encontrado"] } };

  await db.delete(recetasTable).where(eq(recetasTable.id, recetaId));

  revalidatePath("/catalogos/recetas");
  revalidatePath(`/catalogos/recetas/${row.servicioId}`);
  revalidatePath("/ventas");
  revalidatePath("/stock");
  return { ok: true };
}

export async function replaceRecetasServicio(
  servicioId: string,
  items: Array<{ insumo_id: string; cantidad: number }>,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La edicion de recetas requiere Supabase configurado.",
  );

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(recetasTable).where(eq(recetasTable.servicioId, servicioId));
    if (items.length > 0) {
      await tx.insert(recetasTable).values(
        items.map((item) => ({
          id: crypto.randomUUID(),
          servicioId,
          insumoId: item.insumo_id,
          cantidad: item.cantidad,
        })),
      );
    }
  });

  revalidatePath("/catalogos/recetas");
  revalidatePath(`/catalogos/recetas/${servicioId}`);
  revalidatePath("/ventas");
  revalidatePath("/stock");
  return { ok: true };
}
