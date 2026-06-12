"use server";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import {
  cierresCaja as cierresCajaTable,
  empleados as empleadosTable,
  egresos as egresosTable,
  ingresoLineas as ingresoLineasTable,
  ingresos as ingresosTable,
  liquidacionLineas as liquidacionLineasTable,
  liquidaciones as liquidacionesTable,
  mediosPago as mediosPagoTable,
  profiles as profilesTable,
  rubrosGasto as rubrosGastoTable,
  servicios as serviciosTable,
  sucursales as sucursalesTable,
} from "@/lib/db/schema";
import type {
  Empleado,
  Liquidacion,
  LiquidacionEstado,
  LiquidacionLinea,
  MedioPago,
  Sucursal,
} from "@/lib/types";
import {
  liquidacionCreateSchema,
  liquidacionPagoSchema,
} from "@/lib/validations/liquidacion";
import { fieldErrors, requireRole } from "./_helpers";
import {
  deleteMovimientosByRefTx,
  emitMovimientoBancarioTx,
  getCuentaIdForMpTx,
} from "./movimientos-bancarios-helpers";

function createId() {
  return crypto.randomUUID();
}

function ymd(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoStart(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toISOString();
}

function isoEnd(fecha: string): string {
  return new Date(`${fecha}T23:59:59.999`).toISOString();
}

function mapLiquidacion(
  row: typeof liquidacionesTable.$inferSelect,
): Liquidacion {
  return {
    id: row.id,
    sucursal_id: row.sucursalId,
    empleado_id: row.empleadoId,
    periodo_desde: ymd(row.periodoDesde),
    periodo_hasta: ymd(row.periodoHasta),
    total_servicios: row.totalServicios,
    dias_trabajados: row.diasTrabajados,
    total_comision: row.totalComision,
    estado: row.estado as LiquidacionEstado,
    mp_id: row.mpId ?? undefined,
    fecha_pago: row.fechaPago?.toISOString() ?? undefined,
    observacion: row.observacion ?? undefined,
    egreso_id: row.egresoId ?? undefined,
    usuario_id: row.usuarioId,
    creado_en: row.creadoEn.toISOString(),
  };
}

function mapLinea(
  row: typeof liquidacionLineasTable.$inferSelect,
): LiquidacionLinea {
  return {
    id: row.id,
    liquidacion_id: row.liquidacionId,
    ingreso_linea_id: row.ingresoLineaId ?? undefined,
    ingreso_id: row.ingresoId ?? undefined,
    fecha: ymd(row.fecha),
    servicio_nombre: row.servicioNombre,
    precio: row.precio,
    comision_pct: row.comisionPct,
    comision_monto: row.comisionMonto,
  };
}

export interface LiquidacionPreviewLinea {
  ingreso_linea_id: string;
  ingreso_id: string;
  fecha: string;
  servicio_nombre: string;
  precio: number;
  comision_pct: number;
  comision_monto: number;
}

export interface LiquidacionPreview {
  empleado_id: string;
  sucursal_id: string;
  periodo_desde: string;
  periodo_hasta: string;
  lineas: LiquidacionPreviewLinea[];
  total_comision: number;
  total_servicios: number;
  dias_trabajados: number;
}

async function fetchLineasPendientes(args: {
  sucursalId: string;
  empleadoId: string;
  desde: string;
  hasta: string;
}): Promise<LiquidacionPreviewLinea[]> {
  const db = getDb();

  const rows = await db
    .select({
      lineaId: ingresoLineasTable.id,
      ingresoId: ingresoLineasTable.ingresoId,
      fecha: ingresosTable.fecha,
      servicioNombre: serviciosTable.nombre,
      precio: ingresoLineasTable.precioEfectivo,
      pct: ingresoLineasTable.comisionPct,
      monto: ingresoLineasTable.comisionMonto,
      yaLiquidada: liquidacionLineasTable.id,
    })
    .from(ingresoLineasTable)
    .innerJoin(ingresosTable, eq(ingresoLineasTable.ingresoId, ingresosTable.id))
    .innerJoin(serviciosTable, eq(ingresoLineasTable.servicioId, serviciosTable.id))
    .leftJoin(
      liquidacionLineasTable,
      eq(liquidacionLineasTable.ingresoLineaId, ingresoLineasTable.id),
    )
    .where(
      and(
        eq(ingresoLineasTable.empleadoId, args.empleadoId),
        eq(ingresosTable.sucursalId, args.sucursalId),
        eq(ingresosTable.anulado, false),
        gte(ingresosTable.fecha, new Date(isoStart(args.desde))),
        lte(ingresosTable.fecha, new Date(isoEnd(args.hasta))),
      ),
    );

  return rows
    .filter((r) => r.yaLiquidada === null)
    .map((r) => ({
      ingreso_linea_id: r.lineaId,
      ingreso_id: r.ingresoId,
      fecha: ymd(r.fecha),
      servicio_nombre: r.servicioNombre,
      precio: r.precio,
      comision_pct: r.pct,
      comision_monto: r.monto,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function previewLiquidacion(input: {
  sucursalId: string;
  empleadoId: string;
  periodoDesde: string;
  periodoHasta: string;
}): Promise<
  | { ok: true; preview: LiquidacionPreview }
  | { ok: false; errors: Record<string, string[]> }
> {
  await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("Las liquidaciones requieren Supabase configurado.");

  const parsed = liquidacionCreateSchema.safeParse({
    sucursal_id: input.sucursalId,
    empleado_id: input.empleadoId,
    periodo_desde: input.periodoDesde,
    periodo_hasta: input.periodoHasta,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (!isSucursalAllowed(scope, parsed.data.sucursal_id)) {
    return { ok: false, errors: { sucursal_id: ["Sin acceso a esa sucursal"] } };
  }

  const lineas = await fetchLineasPendientes({
    sucursalId: parsed.data.sucursal_id,
    empleadoId: parsed.data.empleado_id,
    desde: parsed.data.periodo_desde,
    hasta: parsed.data.periodo_hasta,
  });

  const dias = new Set(lineas.map((l) => l.fecha));
  const totalComision = lineas.reduce((s, l) => s + l.comision_monto, 0);

  return {
    ok: true,
    preview: {
      empleado_id: parsed.data.empleado_id,
      sucursal_id: parsed.data.sucursal_id,
      periodo_desde: parsed.data.periodo_desde,
      periodo_hasta: parsed.data.periodo_hasta,
      lineas,
      total_comision: totalComision,
      total_servicios: lineas.length,
      dias_trabajados: dias.size,
    },
  };
}

export type CreateLiquidacionResult =
  | { ok: true; liquidacionId: string }
  | { ok: false; errors: Record<string, string[]> };

export async function createLiquidacion(
  formData: FormData,
): Promise<CreateLiquidacionResult> {
  const user = await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("Las liquidaciones requieren Supabase configurado.");

  const parsed = liquidacionCreateSchema.safeParse({
    sucursal_id: formData.get("sucursal_id"),
    empleado_id: formData.get("empleado_id"),
    periodo_desde: formData.get("periodo_desde"),
    periodo_hasta: formData.get("periodo_hasta"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const scope = buildAccessScope(user);
  if (!isSucursalAllowed(scope, parsed.data.sucursal_id)) {
    return { ok: false, errors: { sucursal_id: ["Sin acceso a esa sucursal"] } };
  }

  const lineas = await fetchLineasPendientes({
    sucursalId: parsed.data.sucursal_id,
    empleadoId: parsed.data.empleado_id,
    desde: parsed.data.periodo_desde,
    hasta: parsed.data.periodo_hasta,
  });

  if (lineas.length === 0) {
    return {
      ok: false,
      errors: { _: ["No hay líneas pendientes para liquidar en ese período"] },
    };
  }

  const dias = new Set(lineas.map((l) => l.fecha));
  const totalComision = lineas.reduce((s, l) => s + l.comision_monto, 0);
  const liquidacionId = createId();

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(liquidacionesTable).values({
      id: liquidacionId,
      sucursalId: parsed.data.sucursal_id,
      empleadoId: parsed.data.empleado_id,
      periodoDesde: parsed.data.periodo_desde,
      periodoHasta: parsed.data.periodo_hasta,
      totalServicios: lineas.length,
      diasTrabajados: dias.size,
      totalComision,
      estado: "pendiente",
      usuarioId: user.id,
    });

    const rows = lineas.map((l) => ({
      id: createId(),
      liquidacionId,
      ingresoLineaId: l.ingreso_linea_id,
      ingresoId: l.ingreso_id,
      fecha: l.fecha,
      servicioNombre: l.servicio_nombre,
      precio: l.precio,
      comisionPct: l.comision_pct,
      comisionMonto: l.comision_monto,
    }));

    // Insertar en chunks por si hay muchas
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await tx.insert(liquidacionLineasTable).values(rows.slice(i, i + CHUNK));
    }
  });

  revalidatePath("/liquidaciones");
  return { ok: true, liquidacionId };
}

export interface LiquidacionConDetalle {
  liquidacion: Liquidacion;
  empleado: Empleado;
  sucursal: Sucursal;
  medioPago: MedioPago | null;
  cerrado_por_nombre: string;
  lineas: LiquidacionLinea[];
}

export interface LiquidacionListItem {
  liquidacion: Liquidacion;
  empleado_nombre: string;
  sucursal_nombre: string;
}

export async function listLiquidaciones(opts?: {
  sucursalId?: string;
  empleadoId?: string;
  estado?: LiquidacionEstado;
  limit?: number;
}): Promise<LiquidacionListItem[]> {
  await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("Las liquidaciones requieren Supabase configurado.");

  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (opts?.sucursalId && !isSucursalAllowed(scope, opts.sucursalId)) return [];

  const db = getDb();
  const filters = [inArray(liquidacionesTable.sucursalId, scope.sucursalIdsPermitidas)];
  if (opts?.sucursalId) {
    filters.push(eq(liquidacionesTable.sucursalId, opts.sucursalId));
  }
  if (opts?.empleadoId) {
    filters.push(eq(liquidacionesTable.empleadoId, opts.empleadoId));
  }
  if (opts?.estado) {
    filters.push(eq(liquidacionesTable.estado, opts.estado));
  }

  const rows = await db
    .select({
      liq: liquidacionesTable,
      empleadoNombre: empleadosTable.nombre,
      sucursalNombre: sucursalesTable.nombre,
    })
    .from(liquidacionesTable)
    .innerJoin(empleadosTable, eq(liquidacionesTable.empleadoId, empleadosTable.id))
    .innerJoin(sucursalesTable, eq(liquidacionesTable.sucursalId, sucursalesTable.id))
    .where(and(...filters))
    .orderBy(desc(liquidacionesTable.creadoEn))
    .limit(opts?.limit ?? 100);

  return rows.map((row) => ({
    liquidacion: mapLiquidacion(row.liq),
    empleado_nombre: row.empleadoNombre,
    sucursal_nombre: row.sucursalNombre,
  }));
}

function mapEmpleadoRow(row: typeof empleadosTable.$inferSelect): Empleado {
  return {
    id: row.id,
    nombre: row.nombre,
    activo: row.activo,
    sucursal_principal_id: row.sucursalPrincipalId,
    tipo_comision: row.tipoComision,
    porcentaje_default: row.porcentajeDefault,
    sueldo_asegurado: row.sueldoAsegurado,
    observacion: row.observacion ?? undefined,
  };
}

function mapSucursalRow(row: typeof sucursalesTable.$inferSelect): Sucursal {
  return {
    id: row.id,
    nombre: row.nombre,
    activo: row.activo,
    slug: row.slug ?? undefined,
    direccion: row.direccion ?? undefined,
    telefono: row.telefono ?? undefined,
    horario_resumen: row.horarioResumen ?? undefined,
    rating: row.rating ?? undefined,
    reviews: row.reviews ?? undefined,
    mapa_url: row.mapaUrl ?? undefined,
    descripcion_corta: row.descripcionCorta ?? undefined,
  };
}

function mapMpRow(row: typeof mediosPagoTable.$inferSelect): MedioPago {
  return {
    id: row.id,
    sucursal_id: row.sucursalId,
    codigo: row.codigo,
    nombre: row.nombre,
    activo: row.activo,
    cuenta_id: row.cuentaId ?? undefined,
    recargo_pct: row.recargoPct,
  };
}

export async function getLiquidacion(
  id: string,
): Promise<LiquidacionConDetalle | null> {
  await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("Las liquidaciones requieren Supabase configurado.");

  const user = await requireUser();
  const scope = buildAccessScope(user);
  const db = getDb();

  const [row] = await db
    .select({
      liq: liquidacionesTable,
      empleado: empleadosTable,
      sucursal: sucursalesTable,
      usuarioNombre: profilesTable.nombre,
    })
    .from(liquidacionesTable)
    .innerJoin(empleadosTable, eq(liquidacionesTable.empleadoId, empleadosTable.id))
    .innerJoin(sucursalesTable, eq(liquidacionesTable.sucursalId, sucursalesTable.id))
    .leftJoin(profilesTable, eq(liquidacionesTable.usuarioId, profilesTable.userId))
    .where(eq(liquidacionesTable.id, id))
    .limit(1);

  if (!row) return null;
  if (!scope.sucursalIdsPermitidas.includes(row.liq.sucursalId)) return null;

  const lineas = await db
    .select()
    .from(liquidacionLineasTable)
    .where(eq(liquidacionLineasTable.liquidacionId, id))
    .orderBy(asc(liquidacionLineasTable.fecha));

  let medioPago: MedioPago | null = null;
  if (row.liq.mpId) {
    const [mp] = await db
      .select()
      .from(mediosPagoTable)
      .where(eq(mediosPagoTable.id, row.liq.mpId))
      .limit(1);
    medioPago = mp ? mapMpRow(mp) : null;
  }

  return {
    liquidacion: mapLiquidacion(row.liq),
    empleado: mapEmpleadoRow(row.empleado),
    sucursal: mapSucursalRow(row.sucursal),
    medioPago,
    cerrado_por_nombre: row.usuarioNombre ?? "Sistema",
    lineas: lineas.map(mapLinea),
  };
}

export type MarcarPagadaResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> };

export async function marcarLiquidacionPagada(
  id: string,
  formData: FormData,
): Promise<MarcarPagadaResult> {
  const user = await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("Las liquidaciones requieren Supabase configurado.");

  const parsed = liquidacionPagoSchema.safeParse({
    mp_id: formData.get("mp_id"),
    observacion: formData.get("observacion"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const scope = buildAccessScope(user);
  const db = getDb();

  const [existing] = await db
    .select()
    .from(liquidacionesTable)
    .where(eq(liquidacionesTable.id, id))
    .limit(1);

  if (!existing) return { ok: false, errors: { _: ["Liquidación no encontrada"] } };
  if (!scope.sucursalIdsPermitidas.includes(existing.sucursalId)) {
    return { ok: false, errors: { _: ["Sin acceso a esta liquidación"] } };
  }
  if (existing.estado !== "pendiente") {
    return { ok: false, errors: { _: ["La liquidación no está pendiente"] } };
  }

  const [empleado] = await db
    .select({ nombre: empleadosTable.nombre })
    .from(empleadosTable)
    .where(eq(empleadosTable.id, existing.empleadoId))
    .limit(1);

  const [rubro] = await db
    .select({ id: rubrosGastoTable.id })
    .from(rubrosGastoTable)
    .where(eq(rubrosGastoTable.rubro, "Sueldos"))
    .limit(1);

  if (!rubro) {
    return {
      ok: false,
      errors: {
        _: [
          'No existe el rubro de gasto "Sueldos". Creálo en Catálogos → Rubros antes de pagar liquidaciones.',
        ],
      },
    };
  }

  const ahora = new Date();
  const ymdHoy = ahora.toISOString().slice(0, 10);
  const egresoId = createId();
  const observacionEgreso =
    `Liquidación ${empleado?.nombre ?? "empleado"} ` +
    `(${existing.periodoDesde} a ${existing.periodoHasta})` +
    (parsed.data.observacion ? ` — ${parsed.data.observacion}` : "");

  try {
    await db.transaction(async (tx) => {
      const [cierreDelDia] = await tx
        .select({ id: cierresCajaTable.id })
        .from(cierresCajaTable)
        .where(
          and(
            eq(cierresCajaTable.sucursalId, existing.sucursalId),
            eq(cierresCajaTable.fecha, ymdHoy),
          ),
        )
        .limit(1);

      if (cierreDelDia) {
        throw new Error(
          `La caja del ${ymdHoy} ya está cerrada para esta sucursal. Reabrí el cierre antes de registrar el pago.`,
        );
      }

      await tx.insert(egresosTable).values({
        id: egresoId,
        fecha: ahora,
        sucursalId: existing.sucursalId,
        rubroId: rubro.id,
        valor: existing.totalComision,
        mpId: parsed.data.mp_id,
        observacion: observacionEgreso,
        pagado: true,
        usuarioId: user.id,
      });

      const cuentaId = await getCuentaIdForMpTx(tx, parsed.data.mp_id);
      if (cuentaId) {
        await emitMovimientoBancarioTx(tx, {
          cuentaId,
          fecha: ahora,
          monto: -Math.abs(existing.totalComision),
          tipo: "egreso",
          sucursalId: existing.sucursalId,
          refTipo: "egreso",
          refId: egresoId,
          descripcion: observacionEgreso,
          usuarioId: user.id,
        });
      }

      await tx
        .update(liquidacionesTable)
        .set({
          estado: "pagada",
          mpId: parsed.data.mp_id,
          fechaPago: ahora,
          observacion: parsed.data.observacion ?? null,
          egresoId,
        })
        .where(eq(liquidacionesTable.id, id));
    });
  } catch (error) {
    return {
      ok: false,
      errors: {
        _: [
          error instanceof Error
            ? error.message
            : "No se pudo registrar el pago",
        ],
      },
    };
  }

  revalidatePath("/liquidaciones");
  revalidatePath(`/liquidaciones/${id}`);
  revalidatePath("/egresos");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/bancos");
  return { ok: true };
}

export async function anularLiquidacion(
  id: string,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string[]> }> {
  const user = await requireRole(["admin"]);
  const scope = buildAccessScope(user);
  const db = getDb();

  const [existing] = await db
    .select()
    .from(liquidacionesTable)
    .where(eq(liquidacionesTable.id, id))
    .limit(1);
  if (!existing) return { ok: false, errors: { _: ["No encontrada"] } };
  if (!scope.sucursalIdsPermitidas.includes(existing.sucursalId)) {
    return { ok: false, errors: { _: ["Sin acceso"] } };
  }

  try {
    await db.transaction(async (tx) => {
      if (existing.egresoId) {
        const [eg] = await tx
          .select({ fecha: egresosTable.fecha })
          .from(egresosTable)
          .where(eq(egresosTable.id, existing.egresoId))
          .limit(1);

        if (eg) {
          const ymdEgreso = eg.fecha.toISOString().slice(0, 10);
          const [cierre] = await tx
            .select({ id: cierresCajaTable.id })
            .from(cierresCajaTable)
            .where(
              and(
                eq(cierresCajaTable.sucursalId, existing.sucursalId),
                eq(cierresCajaTable.fecha, ymdEgreso),
              ),
            )
            .limit(1);
          if (cierre) {
            throw new Error(
              `El pago se registró el ${ymdEgreso} y la caja de ese día ya está cerrada. Reabrí el cierre antes de anular.`,
            );
          }
          await deleteMovimientosByRefTx(tx, "egreso", existing.egresoId);
          await tx.delete(egresosTable).where(eq(egresosTable.id, existing.egresoId));
        }
      }

      // Borrar libera las líneas para futuras liquidaciones
      await tx.delete(liquidacionesTable).where(eq(liquidacionesTable.id, id));
    });
  } catch (error) {
    return {
      ok: false,
      errors: {
        _: [
          error instanceof Error ? error.message : "No se pudo anular la liquidación",
        ],
      },
    };
  }

  revalidatePath("/liquidaciones");
  revalidatePath("/egresos");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/bancos");
  return { ok: true };
}

export interface EfectivoPeriodo {
  ingresos_ef: number;
  egresos_ef: number;
  neto_ef: number;
}

export async function getEfectivoEsperadoPeriodo(args: {
  sucursalId: string;
  desde: string;
  hasta: string;
}): Promise<EfectivoPeriodo> {
  await requireRole(["admin", "encargada"]);
  const db = getDb();

  const desdeIso = new Date(isoStart(args.desde));
  const hastaIso = new Date(isoEnd(args.hasta));

  const [mpEf] = await db
    .select()
    .from(mediosPagoTable)
    .where(eq(mediosPagoTable.codigo, "EF"))
    .limit(1);
  if (!mpEf) return { ingresos_ef: 0, egresos_ef: 0, neto_ef: 0 };

  const ingresosRows = await db
    .select({
      mp1: ingresosTable.mp1Id,
      v1: ingresosTable.valor1,
      mp2: ingresosTable.mp2Id,
      v2: ingresosTable.valor2,
    })
    .from(ingresosTable)
    .where(
      and(
        eq(ingresosTable.sucursalId, args.sucursalId),
        eq(ingresosTable.anulado, false),
        gte(ingresosTable.fecha, desdeIso),
        lte(ingresosTable.fecha, hastaIso),
      ),
    );

  let ingresosEf = 0;
  for (const r of ingresosRows) {
    if (r.mp1 === mpEf.id) ingresosEf += r.v1;
    if (r.mp2 === mpEf.id && r.v2 != null) ingresosEf += r.v2;
  }

  const egresosRows = await db
    .select({ valor: egresosTable.valor })
    .from(egresosTable)
    .where(
      and(
        eq(egresosTable.sucursalId, args.sucursalId),
        eq(egresosTable.pagado, true),
        eq(egresosTable.mpId, mpEf.id),
        gte(egresosTable.fecha, desdeIso),
        lte(egresosTable.fecha, hastaIso),
      ),
    );

  const egresosEf = egresosRows.reduce((s, r) => s + r.valor, 0);

  return {
    ingresos_ef: ingresosEf,
    egresos_ef: egresosEf,
    neto_ef: ingresosEf - egresosEf,
  };
}
