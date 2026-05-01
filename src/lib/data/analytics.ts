"use server";

import { requireUser } from "@/lib/auth/session";
import { buildAccessScope, clampSucursalId } from "@/lib/auth/access";
import { store } from "@/lib/mock/store";
import { computeBreakdown } from "./ingresos-helpers";
import type { AccessScope, TurnoEstado } from "@/lib/types";

export interface AnalyticsFilters {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  empleadoId?: string;
  turnoEstado?: TurnoEstado | "";
  rubro?: string;
}

export interface AnalyticsPoint {
  label: string;
  value: number;
}

export interface RetentionSnapshot {
  recurrentes: number;
  nuevos: number;
  total: number;
  tasaPct: number;
}

export interface AnalyticsSnapshot {
  scope: AccessScope;
  filters: {
    desde: string;
    hasta: string;
    sucursalId: string | null;
    empleadoId: string | null;
    turnoEstado: string;
    rubro: string;
  };
  kpis: {
    ingresos: number;
    neto: number;
    tickets: number;
    turnos: number;
    ocupacionPct: number;
    cancelacionesPct: number;
    stockBajo: number;
    stockNegativo: number;
    egresos: number;
  };
  charts: {
    ingresosPorDia: AnalyticsPoint[];
    turnosPorEstado: AnalyticsPoint[];
    ingresosPorSucursal: AnalyticsPoint[];
    rendimientoPorProfesional: AnalyticsPoint[];
    stockCriticoPorSucursal: AnalyticsPoint[];
    serviciosTop: AnalyticsPoint[];
    turnosPorHora: AnalyticsPoint[];
    retencionClientes: RetentionSnapshot;
  };
  governance: {
    metricas: Array<{ nombre: string; definicion: string }>;
    actividadReciente: Array<{
      id: string;
      modulo: string;
      actor: string;
      fecha: string;
      detalle: string;
    }>;
  };
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function resolveDateRange(filters: AnalyticsFilters) {
  const today = new Date();
  const desde = filters.desde
    ? startOfDay(new Date(`${filters.desde}T00:00:00`))
    : startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
  const hasta = filters.hasta
    ? endOfDay(new Date(`${filters.hasta}T00:00:00`))
    : endOfDay(today);
  return { desde, hasta };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function inRange(value: string, desde: Date, hasta: Date) {
  const date = new Date(value);
  return date >= desde && date <= hasta;
}

function getAuthorizedContext(filters: AnalyticsFilters, scope: AccessScope) {
  const sucursalId = clampSucursalId(scope, filters.sucursalId);
  const empleadoId =
    scope.rol === "empleado" ? scope.empleadoId ?? null : filters.empleadoId ?? null;
  return { sucursalId, empleadoId };
}

function aggregateForIngreso(ingresoId: string) {
  const ingreso = store.ingresos.find((item) => item.id === ingresoId);
  if (!ingreso) return null;
  const lineas = store.ingresoLineas.filter((item) => item.ingreso_id === ingresoId);
  return computeBreakdown(ingreso, lineas);
}

export async function getAnalyticsSnapshot(
  filters: AnalyticsFilters = {},
): Promise<AnalyticsSnapshot> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const { desde, hasta } = resolveDateRange(filters);
  const { sucursalId, empleadoId } = getAuthorizedContext(filters, scope);

  const ingresoIdsByEmpleado = empleadoId
    ? new Set(
        store.ingresoLineas
          .filter((linea) => linea.empleado_id === empleadoId)
          .map((linea) => linea.ingreso_id),
      )
    : null;

  const ingresos = store.ingresos.filter((item) => {
    if (item.anulado) return false;
    if (!scope.sucursalIdsPermitidas.includes(item.sucursal_id)) return false;
    if (sucursalId && item.sucursal_id !== sucursalId) return false;
    if (!inRange(item.fecha, desde, hasta)) return false;
    if (ingresoIdsByEmpleado && !ingresoIdsByEmpleado.has(item.id)) return false;
    return true;
  });

  const turnos = store.turnos.filter((item) => {
    if (!scope.sucursalIdsPermitidas.includes(item.sucursal_id)) return false;
    if (sucursalId && item.sucursal_id !== sucursalId) return false;
    if (empleadoId && item.profesional_id !== empleadoId) return false;
    if (filters.turnoEstado && item.estado !== filters.turnoEstado) return false;
    return inRange(`${item.fecha_turno}T12:00:00.000Z`, desde, hasta);
  });

  const egresos = store.egresos.filter((item) => {
    if (!scope.sucursalIdsPermitidas.includes(item.sucursal_id)) return false;
    if (sucursalId && item.sucursal_id !== sucursalId) return false;
    return inRange(item.fecha, desde, hasta);
  });

  const stockRows = store.stockSucursal.filter(
    (item) =>
      scope.sucursalIdsPermitidas.includes(item.sucursal_id) &&
      (!sucursalId || item.sucursal_id === sucursalId),
  );

  const ingresosBreakdown = ingresos.map((item) => aggregateForIngreso(item.id)).filter(Boolean);
  const ingresosTotal = ingresos.reduce((acc, item) => acc + item.total, 0);
  const netoTotal = ingresosBreakdown.reduce((acc, item) => acc + (item?.neto ?? 0), 0);
  const egresosTotal = egresos.reduce((acc, item) => acc + item.valor, 0);

  const totalMinutes = turnos.reduce((acc, item) => acc + item.duracion_min, 0);
  const daysTracked = Math.max(
    1,
    Math.ceil((hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  const activePros = new Set(
    store.profesionalesAgenda
      .filter((item) => scope.sucursalIdsPermitidas.includes(item.sucursal_id))
      .filter((item) => !sucursalId || item.sucursal_id === sucursalId)
      .map((item) => item.empleado_id),
  );
  const capacityMinutes = Math.max(activePros.size, 1) * daysTracked * 8 * 60;

  const turnosCancelados = turnos.filter((item) => item.estado === "cancelado").length;

  const byDay = new Map<string, number>();
  ingresos.forEach((item) => {
    const key = item.fecha.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + item.total);
  });

  const byTurnoEstado = new Map<string, number>();
  turnos.forEach((item) => {
    byTurnoEstado.set(item.estado, (byTurnoEstado.get(item.estado) ?? 0) + 1);
  });

  const bySucursalIngresos = new Map<string, number>();
  ingresos.forEach((item) => {
    const suc = store.sucursales.find((s) => s.id === item.sucursal_id)?.nombre ?? "Sin sucursal";
    bySucursalIngresos.set(suc, (bySucursalIngresos.get(suc) ?? 0) + item.total);
  });

  const byEmpleado = new Map<string, number>();
  store.ingresoLineas.forEach((linea) => {
    const ingreso = ingresos.find((item) => item.id === linea.ingreso_id);
    if (!ingreso || !linea.empleado_id) return;
    const empleado = store.empleados.find((item) => item.id === linea.empleado_id)?.nombre ?? "Sin asignar";
    byEmpleado.set(empleado, (byEmpleado.get(empleado) ?? 0) + linea.subtotal);
  });

  const byServicio = new Map<string, number>();
  store.ingresoLineas.forEach((linea) => {
    const ingreso = ingresos.find((item) => item.id === linea.ingreso_id);
    if (!ingreso) return;
    const servicio = store.servicios.find((item) => item.id === linea.servicio_id);
    if (!servicio) return;
    if (filters.rubro && servicio.rubro !== filters.rubro) return;
    byServicio.set(servicio.nombre, (byServicio.get(servicio.nombre) ?? 0) + linea.subtotal);
  });

  const stockCritico = new Map<string, number>();
  stockRows.forEach((row) => {
    const insumo = store.insumos.find((item) => item.id === row.insumo_id);
    if (!insumo) return;
    if (row.cantidad < insumo.umbral_stock_bajo) {
      const suc = store.sucursales.find((item) => item.id === row.sucursal_id)?.nombre ?? "Sin sucursal";
      stockCritico.set(suc, (stockCritico.get(suc) ?? 0) + 1);
    }
  });

  const recentActivity = [
    ...store.turnoEventos
      .filter((item) => {
        const turno = store.turnos.find((t) => t.id === item.turno_id);
        return turno && scope.sucursalIdsPermitidas.includes(turno.sucursal_id);
      })
      .map((item) => ({
        id: item.id,
        modulo: "Turnos",
        actor:
          store.usuarios.find((userRow) => userRow.id === item.actor_usuario_id)?.nombre ??
          "Sistema",
        fecha: item.fecha,
        detalle: item.detalle ?? item.tipo,
      })),
    ...store.movimientosStock
      .filter((item) => scope.sucursalIdsPermitidas.includes(item.sucursal_id))
      .map((item) => ({
        id: item.id,
        modulo: "Stock",
        actor:
          store.usuarios.find((userRow) => userRow.id === item.usuario_id)?.nombre ??
          "Sistema",
        fecha: item.fecha,
        detalle: `${item.tipo} por ${item.cantidad}`,
      })),
  ]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 8);

  const byHour = new Map<string, number>();
  turnos
    .filter((item) => item.estado !== "cancelado" && item.estado !== "ausente")
    .forEach((item) => {
      const hour = `${item.hora.slice(0, 2)}hs`;
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    });

  const customerVisits = new Map<string, number>();
  const registerCustomer = (key?: string | null) => {
    if (!key) return;
    customerVisits.set(key, (customerVisits.get(key) ?? 0) + 1);
  };

  turnos.forEach((item) => {
    registerCustomer(item.cliente_telefono || item.cliente_nombre);
  });

  ingresos.forEach((item) => {
    if (item.cliente_id) {
      registerCustomer(item.cliente_id);
    }
  });

  const recurrentes = Array.from(customerVisits.values()).filter((count) => count > 1).length;
  const nuevos = Array.from(customerVisits.values()).filter((count) => count <= 1).length;
  const retentionTotal = recurrentes + nuevos;

  return {
    scope,
    filters: {
      desde: isoDate(desde),
      hasta: isoDate(hasta),
      sucursalId,
      empleadoId,
      turnoEstado: filters.turnoEstado ?? "",
      rubro: filters.rubro ?? "",
    },
    kpis: {
      ingresos: ingresosTotal,
      neto: netoTotal,
      tickets: ingresos.length,
      turnos: turnos.length,
      ocupacionPct: Math.round((totalMinutes / capacityMinutes) * 100),
      cancelacionesPct:
        turnos.length > 0 ? Math.round((turnosCancelados / turnos.length) * 100) : 0,
      stockBajo: stockRows.filter((row) => {
        const insumo = store.insumos.find((item) => item.id === row.insumo_id);
        return insumo && row.cantidad >= 0 && row.cantidad < insumo.umbral_stock_bajo;
      }).length,
      stockNegativo: stockRows.filter((row) => row.cantidad < 0).length,
      egresos: egresosTotal,
    },
    charts: {
      ingresosPorDia: Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, value })),
      turnosPorEstado: Array.from(byTurnoEstado.entries()).map(([label, value]) => ({
        label,
        value,
      })),
      ingresosPorSucursal: Array.from(bySucursalIngresos.entries()).map(([label, value]) => ({
        label,
        value,
      })),
      rendimientoPorProfesional: Array.from(byEmpleado.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, value]) => ({ label, value })),
      stockCriticoPorSucursal: Array.from(stockCritico.entries()).map(([label, value]) => ({
        label,
        value,
      })),
      serviciosTop: Array.from(byServicio.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value]) => ({ label, value })),
      turnosPorHora: Array.from(byHour.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, value })),
      retencionClientes: {
        recurrentes,
        nuevos,
        total: retentionTotal,
        tasaPct: retentionTotal > 0 ? Math.round((recurrentes / retentionTotal) * 100) : 0,
      },
    },
    governance: {
      metricas: [
        {
          nombre: "Ocupacion",
          definicion: "Minutos reservados sobre capacidad teorica de 8 horas por profesional activo.",
        },
        {
          nombre: "Cancelaciones",
          definicion: "Porcentaje de turnos cancelados sobre el total de turnos del periodo filtrado.",
        },
        {
          nombre: "Neto",
          definicion: "Total cobrado menos comisiones y costo estimado de insumos.",
        },
        {
          nombre: "Stock critico",
          definicion: "Insumos por debajo del umbral o en negativo segun stock actual por sucursal.",
        },
      ],
      actividadReciente: recentActivity,
    },
  };
}
