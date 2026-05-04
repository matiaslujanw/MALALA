"use server";

import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import {
  clientes as clientesTable,
  cierresCaja as cierresCajaTable,
  empleados as empleadosTable,
  ingresoLineas as ingresoLineasTable,
  ingresos as ingresosTable,
  insumos as insumosTable,
  mediosPago as mediosPagoTable,
  recetas as recetasTable,
  servicios as serviciosTable,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import {
  buildCostoInsumosByServicio,
  computeBreakdown,
  detallarLineas,
  type IngresoConDetalle,
} from "./ingresos-helpers";
import { ingresoSchema } from "@/lib/validations/ingreso";
import { fieldErrors, requireRole } from "./_helpers";
import { applyMovementTx } from "./stock";
import type {
  Cliente,
  Empleado,
  Ingreso,
  IngresoLinea,
  Insumo,
  MedioPago,
  Receta,
  Servicio,
} from "@/lib/types";

export interface IngresoFiltros {
  sucursalId?: string;
  empleadoId?: string;
  clienteId?: string;
  desde?: string; // ISO
  hasta?: string; // ISO
  incluirAnulados?: boolean;
}

function createId() {
  return crypto.randomUUID();
}

function mapIngreso(row: typeof ingresosTable.$inferSelect): Ingreso {
  return {
    id: row.id,
    fecha: row.fecha.toISOString(),
    sucursal_id: row.sucursalId,
    cliente_id: row.clienteId ?? undefined,
    subtotal: row.subtotal,
    descuento_pct: row.descuentoPct,
    descuento_monto: row.descuentoMonto,
    total: row.total,
    mp1_id: row.mp1Id,
    valor1: row.valor1,
    mp2_id: row.mp2Id ?? undefined,
    valor2: row.valor2 ?? undefined,
    observacion: row.observacion ?? undefined,
    usuario_id: row.usuarioId,
    anulado: row.anulado,
  };
}

function mapIngresoLinea(row: typeof ingresoLineasTable.$inferSelect): IngresoLinea {
  return {
    id: row.id,
    ingreso_id: row.ingresoId,
    servicio_id: row.servicioId,
    empleado_id: row.empleadoId ?? undefined,
    precio_efectivo: row.precioEfectivo,
    cantidad: row.cantidad,
    subtotal: row.subtotal,
    comision_pct: row.comisionPct,
    comision_monto: row.comisionMonto,
  };
}

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

function mapMedioPago(row: typeof mediosPagoTable.$inferSelect): MedioPago {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    activo: row.activo,
  };
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

function mapEmpleado(row: typeof empleadosTable.$inferSelect): Empleado {
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

function mapInsumo(row: typeof insumosTable.$inferSelect): Insumo {
  return {
    id: row.id,
    nombre: row.nombre,
    proveedor_id: row.proveedorId ?? undefined,
    unidad_medida: row.unidadMedida,
    tamano_envase: row.tamanoEnvase,
    precio_envase: row.precioEnvase,
    precio_unitario: row.precioUnitario ?? null,
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

async function loadIngresoCatalogs(args: {
  ingresos: Ingreso[];
  lineas: IngresoLinea[];
}) {
  const db = getDb();
  const clienteIds = Array.from(
    new Set(args.ingresos.map((item) => item.cliente_id).filter(Boolean)),
  ) as string[];
  const medioPagoIds = Array.from(
    new Set(
      args.ingresos.flatMap((item) =>
        [item.mp1_id, item.mp2_id].filter(Boolean),
      ),
    ),
  ) as string[];
  const servicioIds = Array.from(
    new Set(args.lineas.map((item) => item.servicio_id)),
  );
  const empleadoIds = Array.from(
    new Set(args.lineas.map((item) => item.empleado_id).filter(Boolean)),
  ) as string[];

  const [clientesRows, mediosPagoRows, serviciosRows, empleadosRows, recetasRows] =
    await Promise.all([
      clienteIds.length > 0
        ? db
            .select()
            .from(clientesTable)
            .where(inArray(clientesTable.id, clienteIds))
        : Promise.resolve([]),
      medioPagoIds.length > 0
        ? db
            .select()
            .from(mediosPagoTable)
            .where(inArray(mediosPagoTable.id, medioPagoIds))
        : Promise.resolve([]),
      servicioIds.length > 0
        ? db
            .select()
            .from(serviciosTable)
            .where(inArray(serviciosTable.id, servicioIds))
        : Promise.resolve([]),
      empleadoIds.length > 0
        ? db
            .select()
            .from(empleadosTable)
            .where(inArray(empleadosTable.id, empleadoIds))
        : Promise.resolve([]),
      servicioIds.length > 0
        ? db
            .select()
            .from(recetasTable)
            .where(inArray(recetasTable.servicioId, servicioIds))
        : Promise.resolve([]),
    ]);

  const recetaRowsMapped = recetasRows.map(mapReceta);
  const insumoIds = Array.from(
    new Set(recetaRowsMapped.map((item) => item.insumo_id)),
  );
  const insumosRows =
    insumoIds.length > 0
      ? await db
          .select()
          .from(insumosTable)
          .where(inArray(insumosTable.id, insumoIds))
      : [];

  const servicios = serviciosRows.map(mapServicio);
  const empleados = empleadosRows.map(mapEmpleado);
  const costoInsumosByServicio = buildCostoInsumosByServicio(
    recetaRowsMapped,
    insumosRows.map(mapInsumo),
  );

  return {
    clientesById: new Map(clientesRows.map((item) => [item.id, mapCliente(item)])),
    mediosPagoById: new Map(
      mediosPagoRows.map((item) => [item.id, mapMedioPago(item)]),
    ),
    serviciosById: new Map(servicios.map((item) => [item.id, item])),
    empleadosById: new Map(empleados.map((item) => [item.id, item])),
    costoInsumosByServicio,
  };
}

function buildIngresosConDetalle(args: {
  ingresos: Ingreso[];
  lineas: IngresoLinea[];
  clientesById: Map<string, Cliente>;
  mediosPagoById: Map<string, MedioPago>;
  serviciosById: Map<string, Servicio>;
  empleadosById: Map<string, Empleado>;
  costoInsumosByServicio: Map<string, number>;
}) {
  const lineasByIngreso = new Map<string, IngresoLinea[]>();
  for (const linea of args.lineas) {
    const current = lineasByIngreso.get(linea.ingreso_id) ?? [];
    current.push(linea);
    lineasByIngreso.set(linea.ingreso_id, current);
  }

  return args.ingresos.map((ingreso): IngresoConDetalle => {
    const lineas = detallarLineas(lineasByIngreso.get(ingreso.id) ?? [], {
      serviciosById: args.serviciosById,
      empleadosById: args.empleadosById,
      costoInsumosByServicio: args.costoInsumosByServicio,
    });
    return {
      ingreso,
      cliente: ingreso.cliente_id
        ? (args.clientesById.get(ingreso.cliente_id) ?? null)
        : null,
      mp1: args.mediosPagoById.get(ingreso.mp1_id) ?? null,
      mp2: ingreso.mp2_id
        ? (args.mediosPagoById.get(ingreso.mp2_id) ?? null)
        : null,
      lineas,
      breakdown: computeBreakdown(ingreso, lineas),
    };
  });
}

export async function listIngresos(
  filtros: IngresoFiltros = {},
): Promise<IngresoConDetalle[]> {
  const user = await requireUser();
  const scope = buildAccessScope(user);

  if (filtros.sucursalId && !isSucursalAllowed(scope, filtros.sucursalId)) {
    return [];
  }
  if (
    scope.rol === "empleado" &&
    filtros.empleadoId &&
    filtros.empleadoId !== scope.empleadoId
  ) {
    return [];
  }

  const filters = [inArray(ingresosTable.sucursalId, scope.sucursalIdsPermitidas)];
  if (!filtros.incluirAnulados) {
    filters.push(eq(ingresosTable.anulado, false));
  }
  if (filtros.sucursalId) {
    filters.push(eq(ingresosTable.sucursalId, filtros.sucursalId));
  }
  if (filtros.clienteId) {
    filters.push(eq(ingresosTable.clienteId, filtros.clienteId));
  }
  if (filtros.desde) {
    filters.push(gte(ingresosTable.fecha, new Date(filtros.desde)));
  }
  if (filtros.hasta) {
    filters.push(lte(ingresosTable.fecha, new Date(filtros.hasta)));
  }

  const db = getDb();
  const ingresosRows = await db
    .select()
    .from(ingresosTable)
    .where(and(...filters))
    .orderBy(desc(ingresosTable.fecha));

  if (ingresosRows.length === 0) return [];

  let lineas = (
    await db
      .select()
      .from(ingresoLineasTable)
      .where(
        inArray(
          ingresoLineasTable.ingresoId,
          ingresosRows.map((item) => item.id),
        ),
      )
  ).map(mapIngresoLinea);

  const empleadoId = scope.rol === "empleado" ? scope.empleadoId : filtros.empleadoId;
  if (empleadoId) {
    const ingresoIdsPermitidos = new Set(
      lineas
        .filter((linea) => linea.empleado_id === empleadoId)
        .map((linea) => linea.ingreso_id),
    );
    lineas = lineas.filter((linea) => ingresoIdsPermitidos.has(linea.ingreso_id));
    const ingresos = ingresosRows
      .filter((item) => ingresoIdsPermitidos.has(item.id))
      .map(mapIngreso);
    if (ingresos.length === 0) return [];
    const lookups = await loadIngresoCatalogs({ ingresos, lineas });
    return buildIngresosConDetalle({
      ingresos,
      lineas,
      ...lookups,
    });
  }

  const ingresos = ingresosRows.map(mapIngreso);
  const lookups = await loadIngresoCatalogs({ ingresos, lineas });
  return buildIngresosConDetalle({
    ingresos,
    lineas,
    ...lookups,
  });
}

export async function getIngreso(
  ingresoId: string,
): Promise<IngresoConDetalle | null> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const db = getDb();
  const [row] = await db
    .select()
    .from(ingresosTable)
    .where(eq(ingresosTable.id, ingresoId))
    .limit(1);

  if (!row) return null;
  if (!scope.sucursalIdsPermitidas.includes(row.sucursalId)) return null;

  const lineas = (
    await db
      .select()
      .from(ingresoLineasTable)
      .where(eq(ingresoLineasTable.ingresoId, ingresoId))
  ).map(mapIngresoLinea);

  if (scope.rol === "empleado" && scope.empleadoId) {
    const isOwn = lineas.some((linea) => linea.empleado_id === scope.empleadoId);
    if (!isOwn) return null;
  }

  const ingreso = mapIngreso(row);
  const lookups = await loadIngresoCatalogs({
    ingresos: [ingreso],
    lineas,
  });
  return buildIngresosConDetalle({
    ingresos: [ingreso],
    lineas,
    ...lookups,
  })[0] ?? null;
}

export type CreateIngresoResult =
  | { ok: true; ingresoId: string; warnings?: string[] }
  | { ok: false; errors: Record<string, string[]> };

export async function createIngreso(
  formData: FormData,
): Promise<CreateIngresoResult> {
  const user = await requireRole(["admin", "encargada", "empleado"]);
  const scope = buildAccessScope(user);

  const lineasRaw = formData.get("lineas");
  let lineasParsed: unknown = [];
  if (typeof lineasRaw === "string") {
    try {
      lineasParsed = JSON.parse(lineasRaw);
    } catch {
      return { ok: false, errors: { lineas: ["JSON invalido"] } };
    }
  }

  const parsed = ingresoSchema.safeParse({
    sucursal_id: formData.get("sucursal_id"),
    cliente_id: formData.get("cliente_id"),
    lineas: lineasParsed,
    descuento_tipo: formData.get("descuento_tipo") ?? "pct",
    descuento_valor: formData.get("descuento_valor") ?? 0,
    mp1_id: formData.get("mp1_id"),
    valor1: formData.get("valor1"),
    mp2_id: formData.get("mp2_id"),
    valor2: formData.get("valor2"),
    observacion: formData.get("observacion"),
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  if (!isSucursalAllowed(scope, parsed.data.sucursal_id)) {
    return {
      ok: false,
      errors: { sucursal_id: ["No tienes acceso a esa sucursal"] },
    };
  }

  const data = parsed.data;
  const subtotal = data.lineas.reduce((acc, linea) => acc + linea.precio_efectivo, 0);
  const descuentoMonto =
    data.descuento_tipo === "pct"
      ? subtotal * (data.descuento_valor / 100)
      : data.descuento_valor;
  const descuentoPct =
    data.descuento_tipo === "pct"
      ? data.descuento_valor
      : subtotal > 0
        ? (data.descuento_valor / subtotal) * 100
        : 0;
  const total = subtotal - descuentoMonto;
  const ingresoId = createId();
  const fecha = new Date();
  const hoyYmd = fecha.toISOString().slice(0, 10);
  const warnings: string[] = [];

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const [cierreDelDia] = await tx
        .select({ id: cierresCajaTable.id })
        .from(cierresCajaTable)
        .where(
          and(
            eq(cierresCajaTable.sucursalId, data.sucursal_id),
            eq(cierresCajaTable.fecha, hoyYmd),
          ),
        )
        .limit(1);

      if (cierreDelDia) {
        throw new Error(
          "La caja de hoy ya esta cerrada para esta sucursal. Reabri el cierre para registrar mas ventas.",
        );
      }

      await tx.insert(ingresosTable).values({
        id: ingresoId,
        fecha,
        sucursalId: data.sucursal_id,
        clienteId: data.cliente_id ?? null,
        subtotal,
        descuentoPct,
        descuentoMonto,
        total,
        mp1Id: data.mp1_id,
        valor1: data.valor1,
        mp2Id: data.mp2_id ?? null,
        valor2: data.valor2 ?? null,
        observacion: data.observacion ?? null,
        usuarioId: user.id,
        anulado: false,
      });

      await tx.insert(ingresoLineasTable).values(
        data.lineas.map((linea) => ({
          id: createId(),
          ingresoId,
          servicioId: linea.servicio_id,
          empleadoId: linea.empleado_id,
          precioEfectivo: linea.precio_efectivo,
          cantidad: 1,
          subtotal: linea.precio_efectivo,
          comisionPct: linea.comision_pct,
          comisionMonto: linea.precio_efectivo * (linea.comision_pct / 100),
        })),
      );

      const servicioIds = Array.from(
        new Set(data.lineas.map((linea) => linea.servicio_id)),
      );
      const recetasRows =
        servicioIds.length > 0
          ? await tx
              .select()
              .from(recetasTable)
              .where(inArray(recetasTable.servicioId, servicioIds))
          : [];
      const recetaMap = new Map<string, Array<(typeof recetasTable.$inferSelect)>>(
        servicioIds.map((servicioId) => [servicioId, []]),
      );
      for (const receta of recetasRows) {
        const current = recetaMap.get(receta.servicioId) ?? [];
        current.push(receta);
        recetaMap.set(receta.servicioId, current);
      }

      const deltasPorInsumo = new Map<string, number>();
      for (const linea of data.lineas) {
        const recetasDeServicio = recetaMap.get(linea.servicio_id) ?? [];
        for (const receta of recetasDeServicio) {
          deltasPorInsumo.set(
            receta.insumoId,
            (deltasPorInsumo.get(receta.insumoId) ?? 0) - receta.cantidad,
          );
        }
      }

      const insumoIds = Array.from(deltasPorInsumo.keys());
      const insumosRows =
        insumoIds.length > 0
          ? await tx
              .select()
              .from(insumosTable)
              .where(inArray(insumosTable.id, insumoIds))
          : [];
      const insumoNombreById = new Map(
        insumosRows.map((item) => [item.id, item.nombre]),
      );

      for (const [insumoId, delta] of deltasPorInsumo.entries()) {
        const { stock } = await applyMovementTx(tx, {
          insumo_id: insumoId,
          sucursal_id: data.sucursal_id,
          delta,
          tipo: "venta",
          ref_tipo: "ingreso",
          ref_id: ingresoId,
          usuario_id: user.id,
        });

        if (stock.cantidad < 0) {
          warnings.push(
            `Stock negativo en ${insumoNombreById.get(insumoId) ?? "insumo"}: ${stock.cantidad}`,
          );
        }
      }
    });
  } catch (error) {
    return {
      ok: false,
      errors: {
        _: [error instanceof Error ? error.message : "No se pudo crear la venta"],
      },
    };
  }

  revalidatePath("/ventas");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
  revalidatePath("/caja");
  return { ok: true, ingresoId, warnings: warnings.length ? warnings : undefined };
}
