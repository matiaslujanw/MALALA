"use server";

import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import { requireRole, s } from "./_helpers";
import { getDb } from "@/lib/db/client/postgres";
import {
  cierresCaja as cierresCajaTable,
  clientes as clientesTable,
  egresos as egresosTable,
  ingresos as ingresosTable,
  insumos as insumosTable,
  movimientosStock as movimientosStockTable,
  profiles as profilesTable,
  proveedores as proveedoresTable,
  rubrosGasto as rubrosGastoTable,
  sucursales as sucursalesTable,
} from "@/lib/db/schema";

export type AuditEventType =
  | "venta"
  | "egreso"
  | "cierre"
  | "stock_compra"
  | "stock_venta"
  | "stock_ajuste"
  | "stock_transferencia";

export interface AuditEvent {
  id: string;
  fecha: string;
  tipo: AuditEventType;
  usuario_id: string;
  usuario_nombre: string;
  usuario_rol: string;
  sucursal_id: string;
  sucursal_nombre: string;
  titulo: string;
  detalle: string;
  monto?: number;
  href?: string;
  meta?: Record<string, string | number>;
}

export interface AuditFiltros {
  desde?: string;
  hasta?: string;
  usuarioId?: string;
  sucursalId?: string;
  tipos?: AuditEventType[];
  search?: string;
  limit?: number;
}

function toDateStart(value?: string) {
  return value ? new Date(value) : undefined;
}

function toDateEnd(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (value.length <= 10) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function buildSearch(detail: string, title: string, user: string, search?: string) {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    detail.toLowerCase().includes(q) ||
    title.toLowerCase().includes(q) ||
    user.toLowerCase().includes(q)
  );
}

export async function getAuditTimeline(
  filtros: AuditFiltros = {},
): Promise<AuditEvent[]> {
  const user = await requireRole(["admin", "encargada"]);
  const scope = buildAccessScope(user);
  if (filtros.sucursalId && !isSucursalAllowed(scope, filtros.sucursalId)) {
    return [];
  }

  const db = getDb();
  const desde = toDateStart(filtros.desde);
  const hasta = toDateEnd(filtros.hasta);
  const sucursalId = filtros.sucursalId ?? null;
  const search = s(filtros.search);
  const tipos = filtros.tipos?.length ? new Set(filtros.tipos) : null;

  const ingresoFilters = [inArray(ingresosTable.sucursalId, scope.sucursalIdsPermitidas)];
  const egresoFilters = [inArray(egresosTable.sucursalId, scope.sucursalIdsPermitidas)];
  const cierreFilters = [inArray(cierresCajaTable.sucursalId, scope.sucursalIdsPermitidas)];
  const movimientoFilters = [
    inArray(movimientosStockTable.sucursalId, scope.sucursalIdsPermitidas),
  ];

  if (sucursalId) {
    ingresoFilters.push(eq(ingresosTable.sucursalId, sucursalId));
    egresoFilters.push(eq(egresosTable.sucursalId, sucursalId));
    cierreFilters.push(eq(cierresCajaTable.sucursalId, sucursalId));
    movimientoFilters.push(eq(movimientosStockTable.sucursalId, sucursalId));
  }
  if (filtros.usuarioId) {
    ingresoFilters.push(eq(ingresosTable.usuarioId, filtros.usuarioId));
    egresoFilters.push(eq(egresosTable.usuarioId, filtros.usuarioId));
    cierreFilters.push(eq(cierresCajaTable.cerradoPor, filtros.usuarioId));
    movimientoFilters.push(eq(movimientosStockTable.usuarioId, filtros.usuarioId));
  }
  if (desde) {
    ingresoFilters.push(gte(ingresosTable.fecha, desde));
    egresoFilters.push(gte(egresosTable.fecha, desde));
    cierreFilters.push(gte(cierresCajaTable.fechaCierre, desde));
    movimientoFilters.push(gte(movimientosStockTable.fecha, desde));
  }
  if (hasta) {
    ingresoFilters.push(lte(ingresosTable.fecha, hasta));
    egresoFilters.push(lte(egresosTable.fecha, hasta));
    cierreFilters.push(lte(cierresCajaTable.fechaCierre, hasta));
    movimientoFilters.push(lte(movimientosStockTable.fecha, hasta));
  }

  const ingresosRows = await db
    .select({
      id: ingresosTable.id,
      fecha: ingresosTable.fecha,
      usuarioId: ingresosTable.usuarioId,
      usuarioNombre: profilesTable.nombre,
      usuarioRol: profilesTable.rol,
      sucursalId: ingresosTable.sucursalId,
      sucursalNombre: sucursalesTable.nombre,
      total: ingresosTable.total,
      anulado: ingresosTable.anulado,
      clienteNombre: clientesTable.nombre,
    })
    .from(ingresosTable)
    .leftJoin(profilesTable, eq(ingresosTable.usuarioId, profilesTable.userId))
    .leftJoin(sucursalesTable, eq(ingresosTable.sucursalId, sucursalesTable.id))
    .leftJoin(clientesTable, eq(ingresosTable.clienteId, clientesTable.id))
    .where(and(...ingresoFilters))
    .orderBy(desc(ingresosTable.fecha));

  const egresosRows = await db
    .select({
      id: egresosTable.id,
      fecha: egresosTable.fecha,
      usuarioId: egresosTable.usuarioId,
      usuarioNombre: profilesTable.nombre,
      usuarioRol: profilesTable.rol,
      sucursalId: egresosTable.sucursalId,
      sucursalNombre: sucursalesTable.nombre,
      valor: egresosTable.valor,
      pagado: egresosTable.pagado,
      rubro: rubrosGastoTable.rubro,
      subrubro: rubrosGastoTable.subrubro,
      proveedorNombre: proveedoresTable.nombre,
      insumoNombre: insumosTable.nombre,
      cantidad: egresosTable.cantidad,
    })
    .from(egresosTable)
    .leftJoin(profilesTable, eq(egresosTable.usuarioId, profilesTable.userId))
    .leftJoin(sucursalesTable, eq(egresosTable.sucursalId, sucursalesTable.id))
    .leftJoin(rubrosGastoTable, eq(egresosTable.rubroId, rubrosGastoTable.id))
    .leftJoin(proveedoresTable, eq(egresosTable.proveedorId, proveedoresTable.id))
    .leftJoin(insumosTable, eq(egresosTable.insumoId, insumosTable.id))
    .where(and(...egresoFilters))
    .orderBy(desc(egresosTable.fecha));

  const cierresRows = await db
    .select({
      id: cierresCajaTable.id,
      fecha: cierresCajaTable.fecha,
      fechaCierre: cierresCajaTable.fechaCierre,
      cerradoPor: cierresCajaTable.cerradoPor,
      usuarioNombre: profilesTable.nombre,
      usuarioRol: profilesTable.rol,
      sucursalId: cierresCajaTable.sucursalId,
      sucursalNombre: sucursalesTable.nombre,
      billetes: cierresCajaTable.billetes,
      saldoInicialEf: cierresCajaTable.saldoInicialEf,
      ingresosEf: cierresCajaTable.ingresosEf,
      egresosEf: cierresCajaTable.egresosEf,
    })
    .from(cierresCajaTable)
    .leftJoin(profilesTable, eq(cierresCajaTable.cerradoPor, profilesTable.userId))
    .leftJoin(sucursalesTable, eq(cierresCajaTable.sucursalId, sucursalesTable.id))
    .where(and(...cierreFilters))
    .orderBy(desc(cierresCajaTable.fechaCierre));

  const movimientosRows = await db
    .select({
      id: movimientosStockTable.id,
      fecha: movimientosStockTable.fecha,
      usuarioId: movimientosStockTable.usuarioId,
      usuarioNombre: profilesTable.nombre,
      usuarioRol: profilesTable.rol,
      sucursalId: movimientosStockTable.sucursalId,
      sucursalNombre: sucursalesTable.nombre,
      tipo: movimientosStockTable.tipo,
      cantidad: movimientosStockTable.cantidad,
      motivo: movimientosStockTable.motivo,
      insumoNombre: insumosTable.nombre,
    })
    .from(movimientosStockTable)
    .leftJoin(profilesTable, eq(movimientosStockTable.usuarioId, profilesTable.userId))
    .leftJoin(sucursalesTable, eq(movimientosStockTable.sucursalId, sucursalesTable.id))
    .leftJoin(insumosTable, eq(movimientosStockTable.insumoId, insumosTable.id))
    .where(and(...movimientoFilters))
    .orderBy(desc(movimientosStockTable.fecha));

  const events: AuditEvent[] = [];

  if (!tipos || tipos.has("venta")) {
    for (const row of ingresosRows) {
      const title = row.anulado ? "Venta anulada" : "Venta";
      const detail = row.clienteNombre ?? "Consumidor Final";
      const actor = row.usuarioNombre ?? "Sistema";
      if (!buildSearch(detail, title, actor, search)) continue;
      events.push({
        id: `venta:${row.id}`,
        fecha: row.fecha.toISOString(),
        tipo: "venta",
        usuario_id: row.usuarioId,
        usuario_nombre: actor,
        usuario_rol: row.usuarioRol ?? "-",
        sucursal_id: row.sucursalId,
        sucursal_nombre: row.sucursalNombre ?? "-",
        titulo: title,
        detalle: detail,
        monto: row.total,
        href: `/ventas/${row.id}`,
        meta: { anulado: row.anulado ? 1 : 0 },
      });
    }
  }

  if (!tipos || tipos.has("egreso")) {
    for (const row of egresosRows) {
      const detail = [
        row.subrubro ? `${row.rubro} · ${row.subrubro}` : row.rubro,
        row.insumoNombre
          ? `${row.insumoNombre}${row.cantidad ? ` x ${row.cantidad}` : ""}`
          : null,
        row.proveedorNombre ?? null,
      ]
        .filter(Boolean)
        .join(" · ");
      const actor = row.usuarioNombre ?? "Sistema";
      const title = row.pagado ? "Egreso (pagado)" : "Egreso (pendiente)";
      if (!buildSearch(detail || "-", title, actor, search)) continue;
      events.push({
        id: `egreso:${row.id}`,
        fecha: row.fecha.toISOString(),
        tipo: "egreso",
        usuario_id: row.usuarioId,
        usuario_nombre: actor,
        usuario_rol: row.usuarioRol ?? "-",
        sucursal_id: row.sucursalId,
        sucursal_nombre: row.sucursalNombre ?? "-",
        titulo: title,
        detalle: detail || "-",
        monto: row.valor,
        href: "/egresos",
        meta: { pagado: row.pagado ? 1 : 0 },
      });
    }
  }

  if (!tipos || tipos.has("cierre")) {
    for (const row of cierresRows) {
      const efectivoContado = Object.entries((row.billetes ?? {}) as Record<string, number>).reduce(
        (acc, [denominacion, cantidad]) => acc + Number(denominacion) * Number(cantidad || 0),
        0,
      );
      const esperado = row.saldoInicialEf + row.ingresosEf - row.egresosEf;
      const diferencia = efectivoContado - esperado;
      const actor = row.usuarioNombre ?? "Sistema";
      const title = "Cierre de caja";
      const detail = `Dia ${row.fecha} · diferencia ${diferencia}`;
      if (!buildSearch(detail, title, actor, search)) continue;
      events.push({
        id: `cierre:${row.id}`,
        fecha: row.fechaCierre.toISOString(),
        tipo: "cierre",
        usuario_id: row.cerradoPor,
        usuario_nombre: actor,
        usuario_rol: row.usuarioRol ?? "-",
        sucursal_id: row.sucursalId,
        sucursal_nombre: row.sucursalNombre ?? "-",
        titulo: title,
        detalle: detail,
        monto: efectivoContado,
        href: `/caja/${row.id}`,
        meta: { diferencia },
      });
    }
  }

  for (const row of movimientosRows) {
    const actor = row.usuarioNombre ?? "Sistema";
    let tipo: AuditEventType = "stock_ajuste";
    let titulo = "Ajuste manual de stock";
    if (row.tipo === "compra") {
      tipo = "stock_compra";
      titulo = "Compra (suma stock)";
    } else if (row.tipo === "venta") {
      tipo = "stock_venta";
      titulo = "Consumo por venta";
    } else if (
      row.tipo === "transferencia_entrada" ||
      row.tipo === "transferencia_salida"
    ) {
      tipo = "stock_transferencia";
      titulo =
        row.tipo === "transferencia_entrada"
          ? "Transferencia · entrada"
          : "Transferencia · salida";
    }
    if (tipos && !tipos.has(tipo)) continue;

    const detail = `${row.insumoNombre ?? "Insumo"} · ${row.cantidad > 0 ? "+" : ""}${row.cantidad}${row.motivo ? ` · ${row.motivo}` : ""}`;
    if (!buildSearch(detail, titulo, actor, search)) continue;
    events.push({
      id: `stockmov:${row.id}`,
      fecha: row.fecha.toISOString(),
      tipo,
      usuario_id: row.usuarioId,
      usuario_nombre: actor,
      usuario_rol: row.usuarioRol ?? "-",
      sucursal_id: row.sucursalId,
      sucursal_nombre: row.sucursalNombre ?? "-",
      titulo,
      detalle: detail,
      meta: { cantidad: row.cantidad },
    });
  }

  events.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return filtros.limit ? events.slice(0, filtros.limit) : events;
}
