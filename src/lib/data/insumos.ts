"use server";

import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import {
  insumoProveedores as insumoProveedoresTable,
  insumos as insumosTable,
  rubrosGasto as rubrosGastoTable,
} from "@/lib/db/schema";
import type { Insumo } from "@/lib/types";
import { insumoSchema } from "@/lib/validations/insumo";
import { getActiveSucursalForUser } from "@/lib/auth/session";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import { createEgreso, type CreateEgresoResult } from "./egresos";

function mapInsumo(
  row: typeof insumosTable.$inferSelect,
  proveedorIds: string[] = [],
): Insumo {
  return {
    id: row.id,
    sucursal_id: row.sucursalId,
    nombre: row.nombre,
    proveedor_ids: proveedorIds,
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

/** Devuelve un Map insumoId -> [proveedorId] para los insumos indicados. */
async function getProveedorIdsByInsumo(
  insumoIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (insumoIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select()
    .from(insumoProveedoresTable)
    .where(inArray(insumoProveedoresTable.insumoId, insumoIds));
  for (const row of rows) {
    const cur = map.get(row.insumoId) ?? [];
    cur.push(row.proveedorId);
    map.set(row.insumoId, cur);
  }
  return map;
}

/** Reemplaza el set de proveedores de un insumo (delete + insert). */
async function syncProveedoresInsumo(
  insumoId: string,
  proveedorIds: string[],
): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(insumoProveedoresTable)
      .where(eq(insumoProveedoresTable.insumoId, insumoId));
    const unicos = Array.from(new Set(proveedorIds.filter(Boolean)));
    if (unicos.length > 0) {
      await tx.insert(insumoProveedoresTable).values(
        unicos.map((proveedorId) => ({
          id: crypto.randomUUID(),
          insumoId,
          proveedorId,
        })),
      );
    }
  });
}

export async function listInsumos(opts?: {
  incluirInactivos?: boolean;
  /**
   * Si se pasa, devuelve solo los insumos de esa sucursal. Cada insumo
   * pertenece a una sola sucursal (columna insumos.sucursal_id).
   */
  sucursalId?: string;
}): Promise<Insumo[]> {
  requireSupabaseRuntime(
    "Los insumos del sistema solo se cargan desde Supabase.",
  );

  const db = getDb();
  const filtros = [];
  if (!opts?.incluirInactivos) filtros.push(eq(insumosTable.activo, true));
  if (opts?.sucursalId) filtros.push(eq(insumosTable.sucursalId, opts.sucursalId));

  const rows = await db
    .select()
    .from(insumosTable)
    .where(filtros.length > 0 ? and(...filtros) : undefined)
    .orderBy(asc(insumosTable.nombre));

  const provMap = await getProveedorIdsByInsumo(rows.map((r) => r.id));
  return rows.map((r) => mapInsumo(r, provMap.get(r.id) ?? []));
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
  if (!row) return null;
  const provMap = await getProveedorIdsByInsumo([row.id]);
  return mapInsumo(row, provMap.get(row.id) ?? []);
}

function parse(formData: FormData) {
  return insumoSchema.safeParse({
    nombre: formData.get("nombre"),
    proveedor_ids: formData.getAll("proveedor_ids"),
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

const UNIDADES_INSUMO = ["ud", "ml", "g", "aplicacion"] as const;

export async function registrarCompraInsumo(
  _prev: CreateEgresoResult | null,
  formData: FormData,
): Promise<CreateEgresoResult> {
  const user = await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime(
    "La carga de compras requiere Supabase configurado.",
  );

  let insumoId = String(formData.get("insumo_id") ?? "");

  // Alta inline: si la compra es de un insumo nuevo, lo creamos en el momento
  // (en la sucursal activa) y seguimos la compra con ese insumo. Así no hace
  // falta darlo de alta antes en el catálogo. El precio del envase sale de la
  // propia compra (monto ÷ cantidad de envases).
  const esNuevoInsumo =
    formData.get("nuevo_insumo") === "1" ||
    formData.get("nuevo_insumo") === "true";
  if (esNuevoInsumo) {
    const nombre = String(formData.get("nuevo_nombre") ?? "").trim();
    const unidad = String(formData.get("nuevo_unidad_medida") ?? "");
    const tamano = Number(formData.get("nuevo_tamano_envase") ?? 0);
    const umbralRaw = Number(formData.get("nuevo_umbral_stock_bajo") ?? 0);
    const cantidadEnvases = Number(formData.get("cantidad") ?? 0);
    const valorTotal = Number(formData.get("valor") ?? 0);

    const errs: Record<string, string[]> = {};
    if (!nombre) errs.nuevo_nombre = ["Nombre requerido"];
    if (!UNIDADES_INSUMO.includes(unidad as (typeof UNIDADES_INSUMO)[number])) {
      errs.nuevo_unidad_medida = ["Elegí una unidad"];
    }
    if (!(tamano > 0)) {
      errs.nuevo_tamano_envase = ["El tamaño del envase debe ser mayor a 0"];
    }
    if (Object.keys(errs).length > 0) return { ok: false, errors: errs };

    const sucursalActiva = await getActiveSucursalForUser(user);
    if (!sucursalActiva) {
      return {
        ok: false,
        errors: { _: ["No hay una sucursal activa seleccionada"] },
      };
    }

    const precioEnvase =
      cantidadEnvases > 0 && valorTotal > 0 ? valorTotal / cantidadEnvases : 0;
    const precioUnitario = precioEnvase > 0 ? precioEnvase / tamano : null;
    const umbral = Number.isFinite(umbralRaw) && umbralRaw >= 0 ? umbralRaw : 0;

    const db = getDb();
    insumoId = crypto.randomUUID();
    await db.insert(insumosTable).values({
      id: insumoId,
      sucursalId: sucursalActiva.id,
      nombre,
      unidadMedida: unidad as (typeof UNIDADES_INSUMO)[number],
      tamanoEnvase: tamano,
      precioEnvase,
      precioUnitario,
      rinde: null,
      umbralStockBajo: umbral,
      activo: true,
      vendible: false,
      precioVenta: null,
    });

    const provNuevo = String(formData.get("proveedor_id") ?? "");
    if (provNuevo) await syncProveedoresInsumo(insumoId, [provNuevo]);
  }

  if (!insumoId) {
    return { ok: false, errors: { insumo_id: ["Insumo requerido"] } };
  }

  const insumo = await getInsumo(insumoId);
  if (!insumo) {
    return { ok: false, errors: { _: ["Insumo no encontrado"] } };
  }

  const rubroId = await findOrCreateRubroInsumos();

  // Proveedor de la compra: el que mande el form; si no, y el insumo tiene un
  // único proveedor asociado, uso ese; si tiene varios, queda sin proveedor.
  const formProveedorId = String(formData.get("proveedor_id") ?? "");
  const proveedorId =
    formProveedorId ||
    (insumo.proveedor_ids?.length === 1 ? insumo.proveedor_ids[0] : "");

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
  fd.set("mp1_cuenta_id", String(formData.get("mp1_cuenta_id") ?? ""));
  fd.set("mp2_id", String(formData.get("mp2_id") ?? ""));
  fd.set("valor2", String(formData.get("valor2") ?? ""));
  fd.set("mp2_cuenta_id", String(formData.get("mp2_cuenta_id") ?? ""));
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

export type AumentoPreciosResult =
  | { ok: true; actualizados: number }
  | { ok: false; errors: Record<string, string[]> };

/**
 * Aplica un aumento (o baja) porcentual a TODOS los insumos de un proveedor de
 * una sola vez. Según `target`:
 *   - "costo" (default): actualiza `precio_envase` y recalcula `precio_unitario`.
 *     NO toca el precio de venta.
 *   - "venta": actualiza el `precio_venta` de los insumos vendibles que tengan
 *     precio de venta cargado. NO toca el costo.
 */
export async function aumentarPreciosProveedor(
  _prev: AumentoPreciosResult | null,
  formData: FormData,
): Promise<AumentoPreciosResult> {
  const user = await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("El aumento de precios requiere Supabase configurado.");

  const proveedorId = String(formData.get("proveedor_id") ?? "");
  const target = formData.get("target") === "venta" ? "venta" : "costo";
  const pct = Number(formData.get("pct"));

  if (!proveedorId) {
    return { ok: false, errors: { _: ["Proveedor requerido"] } };
  }
  if (!Number.isFinite(pct) || pct === 0) {
    return { ok: false, errors: { pct: ["Ingresá un porcentaje distinto de 0"] } };
  }
  if (pct < -90 || pct > 1000) {
    return { ok: false, errors: { pct: ["El porcentaje está fuera de rango"] } };
  }

  // Solo se tocan los insumos de la sucursal activa: cada sede tiene su propio costo.
  const sucursalActiva = await getActiveSucursalForUser(user);
  if (!sucursalActiva) {
    return { ok: false, errors: { _: ["No hay una sucursal activa seleccionada"] } };
  }

  const db = getDb();
  const joined = await db
    .select({ insumo: insumosTable })
    .from(insumosTable)
    .innerJoin(
      insumoProveedoresTable,
      eq(insumoProveedoresTable.insumoId, insumosTable.id),
    )
    .where(
      and(
        eq(insumoProveedoresTable.proveedorId, proveedorId),
        eq(insumosTable.sucursalId, sucursalActiva.id),
      ),
    );
  const rows = joined.map((j) => j.insumo);

  if (rows.length === 0) {
    return { ok: false, errors: { _: ["El proveedor no tiene insumos cargados"] } };
  }

  const factor = 1 + pct / 100;

  if (target === "venta") {
    const vendibles = rows.filter(
      (r) => r.vendible && r.precioVenta != null,
    );
    if (vendibles.length === 0) {
      return {
        ok: false,
        errors: {
          _: ["El proveedor no tiene productos vendibles con precio de venta"],
        },
      };
    }
    await db.transaction(async (tx) => {
      for (const row of vendibles) {
        const nuevoPrecioVenta =
          Math.round((row.precioVenta as number) * factor * 100) / 100;
        await tx
          .update(insumosTable)
          .set({ precioVenta: nuevoPrecioVenta })
          .where(eq(insumosTable.id, row.id));
      }
    });
    revalidatePath("/catalogos/insumos");
    revalidatePath(`/catalogos/proveedores/${proveedorId}`);
    return { ok: true, actualizados: vendibles.length };
  }

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const nuevoPrecioEnvase = Math.round(row.precioEnvase * factor * 100) / 100;
      const nuevoPrecioUnitario =
        row.tamanoEnvase > 0
          ? nuevoPrecioEnvase / row.tamanoEnvase
          : row.precioUnitario;
      await tx
        .update(insumosTable)
        .set({
          precioEnvase: nuevoPrecioEnvase,
          precioUnitario: nuevoPrecioUnitario,
        })
        .where(eq(insumosTable.id, row.id));
    }
  });

  revalidatePath("/catalogos/insumos");
  revalidatePath(`/catalogos/proveedores/${proveedorId}`);
  return { ok: true, actualizados: rows.length };
}

export async function listInsumosByProveedor(
  proveedorId: string,
): Promise<Insumo[]> {
  requireSupabaseRuntime(
    "Los insumos del sistema solo se cargan desde Supabase.",
  );
  const db = getDb();
  const joined = await db
    .select({ insumo: insumosTable })
    .from(insumosTable)
    .innerJoin(
      insumoProveedoresTable,
      eq(insumoProveedoresTable.insumoId, insumosTable.id),
    )
    .where(eq(insumoProveedoresTable.proveedorId, proveedorId))
    .orderBy(asc(insumosTable.nombre));
  const rows = joined.map((j) => j.insumo);
  const provMap = await getProveedorIdsByInsumo(rows.map((r) => r.id));
  return rows.map((r) => mapInsumo(r, provMap.get(r.id) ?? []));
}

export async function listInsumosVendibles(
  sucursalId?: string,
): Promise<Insumo[]> {
  requireSupabaseRuntime(
    "Los insumos del sistema solo se cargan desde Supabase.",
  );
  const db = getDb();
  const filtros = [eq(insumosTable.vendible, true)];
  if (sucursalId) filtros.push(eq(insumosTable.sucursalId, sucursalId));
  const rows = await db
    .select()
    .from(insumosTable)
    .where(and(...filtros))
    .orderBy(asc(insumosTable.nombre));
  const provMap = await getProveedorIdsByInsumo(rows.map((r) => r.id));
  return rows
    .map((r) => mapInsumo(r, provMap.get(r.id) ?? []))
    .filter((i) => i.activo);
}

export async function createInsumo(formData: FormData): Promise<ActionResult> {
  const user = await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La creacion de insumos requiere Supabase configurado.",
  );
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  // El insumo pertenece a la sucursal activa del admin: cada sede arma su propio
  // catálogo (con su propio costo). Ver [[listInsumos]].
  const sucursalActiva = await getActiveSucursalForUser(user);
  if (!sucursalActiva) {
    return { ok: false, errors: { _: ["No hay una sucursal activa seleccionada"] } };
  }

  const db = getDb();
  const insumoId = crypto.randomUUID();
  await db.insert(insumosTable).values({
    id: insumoId,
    sucursalId: sucursalActiva.id,
    nombre: parsed.data.nombre,
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
  await syncProveedoresInsumo(insumoId, parsed.data.proveedor_ids);

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
    if (parsed.data.proveedor_ids.length === 1) {
      fd.set("proveedor_id", parsed.data.proveedor_ids[0]);
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
  await syncProveedoresInsumo(insumoId, parsed.data.proveedor_ids);

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
