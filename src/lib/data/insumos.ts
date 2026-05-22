"use server";

import { asc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import {
  insumos as insumosTable,
  rubrosGasto as rubrosGastoTable,
} from "@/lib/db/schema";
import type { Insumo } from "@/lib/types";
import { insumoSchema } from "@/lib/validations/insumo";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import { createEgreso, type CreateEgresoResult } from "./egresos";

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
    vendible: row.vendible,
    precio_venta: row.precioVenta ?? undefined,
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
    vendible:
      formData.get("vendible") === "on" || formData.get("vendible") === "true",
    precio_venta: formData.get("precio_venta"),
  });
}

async function findOrCreateRubroInsumos(): Promise<string> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(rubrosGastoTable)
    .where(
      or(
        ilike(rubrosGastoTable.rubro, "insumos"),
        ilike(rubrosGastoTable.rubro, "insumo"),
      ),
    )
    .limit(1);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.insert(rubrosGastoTable).values({
    id,
    rubro: "Insumos",
    subrubro: null,
    activo: true,
  });
  return id;
}

export async function registrarCompraInsumo(
  _prev: CreateEgresoResult | null,
  formData: FormData,
): Promise<CreateEgresoResult> {
  await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime(
    "La carga de compras requiere Supabase configurado.",
  );

  const insumoId = String(formData.get("insumo_id") ?? "");
  if (!insumoId) {
    return { ok: false, errors: { insumo_id: ["Insumo requerido"] } };
  }

  const insumo = await getInsumo(insumoId);
  if (!insumo) {
    return { ok: false, errors: { _: ["Insumo no encontrado"] } };
  }

  const rubroId = await findOrCreateRubroInsumos();

  // Si el form no manda proveedor, uso el del catálogo
  const proveedorId =
    String(formData.get("proveedor_id") ?? "") || insumo.proveedor_id || "";

  // Armar formData esperado por createEgreso
  const fd = new FormData();
  fd.set("fecha", String(formData.get("fecha") ?? ""));
  fd.set("sucursal_id", String(formData.get("sucursal_id") ?? ""));
  fd.set("rubro_id", rubroId);
  fd.set("insumo_id", insumoId);
  if (proveedorId) fd.set("proveedor_id", proveedorId);
  fd.set("cantidad", String(formData.get("cantidad") ?? ""));
  fd.set("valor", String(formData.get("valor") ?? ""));
  fd.set("mp_id", String(formData.get("mp_id") ?? ""));
  fd.set("observacion", String(formData.get("observacion") ?? ""));
  if (formData.get("pagado")) fd.set("pagado", "true");

  const result = await createEgreso(null, fd);

  // Si la compra trajo precio del envase, actualizo el catálogo para reflejar lo más reciente
  if (result.ok) {
    const cantidad = Number(formData.get("cantidad") ?? 0);
    const valor = Number(formData.get("valor") ?? 0);
    if (cantidad > 0 && valor > 0) {
      const precioEnvase = valor / cantidad;
      const precioUnitario =
        insumo.tamano_envase > 0 ? precioEnvase / insumo.tamano_envase : null;
      const db = getDb();
      await db
        .update(insumosTable)
        .set({
          precioEnvase,
          precioUnitario: precioUnitario,
        })
        .where(eq(insumosTable.id, insumoId));
    }
  }

  revalidatePath("/catalogos/insumos");
  return result;
}

export async function listInsumosByProveedor(
  proveedorId: string,
): Promise<Insumo[]> {
  requireSupabaseRuntime(
    "Los insumos del sistema solo se cargan desde Supabase.",
  );
  const db = getDb();
  const rows = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.proveedorId, proveedorId))
    .orderBy(asc(insumosTable.nombre));
  return rows.map(mapInsumo);
}

export async function listInsumosVendibles(): Promise<Insumo[]> {
  requireSupabaseRuntime(
    "Los insumos del sistema solo se cargan desde Supabase.",
  );
  const db = getDb();
  const rows = await db
    .select()
    .from(insumosTable)
    .where(eq(insumosTable.vendible, true))
    .orderBy(asc(insumosTable.nombre));
  return rows.map(mapInsumo).filter((i) => i.activo);
}

export async function createInsumo(formData: FormData): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La creacion de insumos requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  const insumoId = crypto.randomUUID();
  await db.insert(insumosTable).values({
    id: insumoId,
    nombre: parsed.data.nombre,
    proveedorId: parsed.data.proveedor_id ?? null,
    unidadMedida: parsed.data.unidad_medida,
    tamanoEnvase: parsed.data.tamano_envase,
    precioEnvase: parsed.data.precio_envase,
    precioUnitario: parsed.data.precio_unitario,
    rinde: parsed.data.rinde ?? null,
    umbralStockBajo: parsed.data.umbral_stock_bajo,
    activo: parsed.data.activo,
    vendible: parsed.data.vendible,
    precioVenta: parsed.data.precio_venta ?? null,
  });

  // Compra inicial opcional
  const cantidadInicial = Number(formData.get("compra_cantidad") ?? 0);
  const valorInicial = Number(formData.get("compra_valor") ?? 0);
  const sucursalInicial = String(formData.get("compra_sucursal_id") ?? "");
  const mpInicial = String(formData.get("compra_mp_id") ?? "");
  if (
    cantidadInicial > 0 &&
    valorInicial > 0 &&
    sucursalInicial &&
    mpInicial
  ) {
    const fd = new FormData();
    fd.set("insumo_id", insumoId);
    fd.set("sucursal_id", sucursalInicial);
    fd.set("cantidad", String(cantidadInicial));
    fd.set("valor", String(valorInicial));
    fd.set("mp_id", mpInicial);
    fd.set("fecha", String(formData.get("compra_fecha") ?? ""));
    if (formData.get("compra_pagado")) fd.set("pagado", "true");
    if (parsed.data.proveedor_id) {
      fd.set("proveedor_id", parsed.data.proveedor_id);
    }
    const compraResult = await registrarCompraInsumo(null, fd);
    if (!compraResult.ok) {
      return {
        ok: false,
        errors: {
          _: [
            "Insumo creado pero la compra inicial falló: " +
              Object.values(compraResult.errors).flat().join(", "),
          ],
        },
      };
    }
  }

  revalidatePath("/catalogos/insumos");
  revalidatePath("/catalogos/recetas");
  revalidatePath("/egresos");
  revalidatePath("/stock");
  revalidatePath("/ventas/nueva");
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
      vendible: parsed.data.vendible,
      precioVenta: parsed.data.precio_venta ?? null,
    })
    .where(eq(insumosTable.id, insumoId));

  revalidatePath("/catalogos/insumos");
  revalidatePath("/catalogos/recetas");
  revalidatePath("/egresos");
  revalidatePath("/stock");
  revalidatePath("/ventas/nueva");
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
