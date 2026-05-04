import {
  and,
  asc,
  eq,
  gte,
  inArray,
  lte,
} from "drizzle-orm";
import { buildAccessScope, clampSucursalId } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client/postgres";
import {
  empleados as empleadosTable,
  egresos as egresosTable,
  ingresoLineas as ingresoLineasTable,
  ingresos as ingresosTable,
  insumos as insumosTable,
  movimientosStock as movimientosStockTable,
  profiles as profilesTable,
  profesionalesAgenda as profesionalesAgendaTable,
  recetas as recetasTable,
  servicios as serviciosTable,
  stockSucursal as stockSucursalTable,
  sucursales as sucursalesTable,
  turnoEventos as turnoEventosTable,
  turnos as turnosTable,
} from "@/lib/db/schema";
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
    : startOfDay(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6),
      );
  const hasta = filters.hasta
    ? endOfDay(new Date(`${filters.hasta}T00:00:00`))
    : endOfDay(today);
  return { desde, hasta };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getAuthorizedContext(filters: AnalyticsFilters, scope: AccessScope) {
  const sucursalId = clampSucursalId(scope, filters.sucursalId);
  const empleadoId =
    scope.rol === "empleado" ? scope.empleadoId ?? null : filters.empleadoId ?? null;
  return { sucursalId, empleadoId };
}

function sum(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0);
}

export async function getAnalyticsSnapshot(
  filters: AnalyticsFilters = {},
): Promise<AnalyticsSnapshot> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const { desde, hasta } = resolveDateRange(filters);
  const { sucursalId, empleadoId } = getAuthorizedContext(filters, scope);
  const db = getDb();

  const ingresoBaseFilters = [
    inArray(ingresosTable.sucursalId, scope.sucursalIdsPermitidas),
    eq(ingresosTable.anulado, false),
    gte(ingresosTable.fecha, desde),
    lte(ingresosTable.fecha, hasta),
  ];
  if (sucursalId) {
    ingresoBaseFilters.push(eq(ingresosTable.sucursalId, sucursalId));
  }

  const turnoFilters = [
    inArray(turnosTable.sucursalId, scope.sucursalIdsPermitidas),
    gte(turnosTable.fechaTurno, isoDate(desde)),
    lte(turnosTable.fechaTurno, isoDate(hasta)),
  ];
  if (sucursalId) {
    turnoFilters.push(eq(turnosTable.sucursalId, sucursalId));
  }
  if (empleadoId) {
    turnoFilters.push(eq(turnosTable.profesionalId, empleadoId));
  }
  if (filters.turnoEstado) {
    turnoFilters.push(eq(turnosTable.estado, filters.turnoEstado));
  }

  const egresoFilters = [
    inArray(egresosTable.sucursalId, scope.sucursalIdsPermitidas),
    gte(egresosTable.fecha, desde),
    lte(egresosTable.fecha, hasta),
  ];
  if (sucursalId) {
    egresoFilters.push(eq(egresosTable.sucursalId, sucursalId));
  }

  const stockFilters = [inArray(stockSucursalTable.sucursalId, scope.sucursalIdsPermitidas)];
  if (sucursalId) {
    stockFilters.push(eq(stockSucursalTable.sucursalId, sucursalId));
  }

  // Supabase pooler is much more stable with a short sequential burst here than
  // with a wide Promise.all fan-out during the first render of the back office.
  const ingresosBase = await db
    .select()
    .from(ingresosTable)
    .where(and(...ingresoBaseFilters));
  const turnosRows = await db.select().from(turnosTable).where(and(...turnoFilters));
  const egresosRows = await db
    .select()
    .from(egresosTable)
    .where(and(...egresoFilters));
  const stockRows = await db
    .select()
    .from(stockSucursalTable)
    .where(and(...stockFilters));
  const insumosRows = await db.select().from(insumosTable);
  const recetasRows = await db.select().from(recetasTable);
  const serviciosRows = await db.select().from(serviciosTable);
  const sucursalesRows = await db
    .select()
    .from(sucursalesTable)
    .where(inArray(sucursalesTable.id, scope.sucursalIdsPermitidas));
  const agendaRows = await db
    .select()
    .from(profesionalesAgendaTable)
    .where(
      and(
        inArray(profesionalesAgendaTable.sucursalId, scope.sucursalIdsPermitidas),
        sucursalId ? eq(profesionalesAgendaTable.sucursalId, sucursalId) : undefined,
      ),
    );
  const empleadosRows = await db.select().from(empleadosTable);

  const ingresoIds = ingresosBase.map((item) => item.id);
  const allIngresoLineas =
    ingresoIds.length > 0
      ? await db
          .select()
          .from(ingresoLineasTable)
          .where(inArray(ingresoLineasTable.ingresoId, ingresoIds))
      : [];

  const allowedIngresoIds =
    empleadoId
      ? new Set(
          allIngresoLineas
            .filter((linea) => linea.empleadoId === empleadoId)
            .map((linea) => linea.ingresoId),
        )
      : null;

  const ingresosRows =
    allowedIngresoIds
      ? ingresosBase.filter((item) => allowedIngresoIds.has(item.id))
      : ingresosBase;
  const filteredIngresoIds = new Set(ingresosRows.map((item) => item.id));
  const ingresoLineasRows = allIngresoLineas.filter((item) =>
    filteredIngresoIds.has(item.ingresoId),
  );

  const serviceMap = new Map(serviciosRows.map((item) => [item.id, item]));
  const insumoMap = new Map(insumosRows.map((item) => [item.id, item]));
  const sucursalMap = new Map(sucursalesRows.map((item) => [item.id, item.nombre]));
  const empleadoMap = new Map(empleadosRows.map((item) => [item.id, item.nombre]));

  const costoInsumosByServicio = new Map<string, number>();
  for (const receta of recetasRows) {
    const insumo = insumoMap.get(receta.insumoId);
    if (!insumo || insumo.precioUnitario == null) continue;
    costoInsumosByServicio.set(
      receta.servicioId,
      (costoInsumosByServicio.get(receta.servicioId) ?? 0) +
        receta.cantidad * insumo.precioUnitario,
    );
  }

  const ingresosTotal = sum(ingresosRows.map((item) => item.total));
  const egresosTotal = sum(egresosRows.map((item) => item.valor));

  const comisionesTotal = sum(ingresoLineasRows.map((item) => item.comisionMonto));
  const costoInsumosTotal = sum(
    ingresoLineasRows.map(
      (item) =>
        (costoInsumosByServicio.get(item.servicioId) ?? 0) * item.cantidad,
    ),
  );
  const netoTotal = ingresosTotal - comisionesTotal - costoInsumosTotal;

  const totalMinutes = sum(turnosRows.map((item) => item.duracionMin));
  const daysTracked = Math.max(
    1,
    Math.ceil((hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  const activePros = new Set(
    agendaRows
      .filter((item) => !empleadoId || item.empleadoId === empleadoId)
      .map((item) => item.empleadoId),
  );
  const capacityMinutes = Math.max(activePros.size, 1) * daysTracked * 8 * 60;

  const turnosCancelados = turnosRows.filter(
    (item) => item.estado === "cancelado",
  ).length;

  const byDay = new Map<string, number>();
  for (const ingreso of ingresosRows) {
    const key = ingreso.fecha.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + ingreso.total);
  }

  const byTurnoEstado = new Map<string, number>();
  for (const turno of turnosRows) {
    byTurnoEstado.set(turno.estado, (byTurnoEstado.get(turno.estado) ?? 0) + 1);
  }

  const bySucursalIngresos = new Map<string, number>();
  for (const ingreso of ingresosRows) {
    const name = sucursalMap.get(ingreso.sucursalId) ?? "Sin sucursal";
    bySucursalIngresos.set(name, (bySucursalIngresos.get(name) ?? 0) + ingreso.total);
  }

  const byEmpleado = new Map<string, number>();
  for (const linea of ingresoLineasRows) {
    if (!linea.empleadoId) continue;
    const name = empleadoMap.get(linea.empleadoId) ?? "Sin asignar";
    byEmpleado.set(name, (byEmpleado.get(name) ?? 0) + linea.subtotal);
  }

  const byServicio = new Map<string, number>();
  for (const linea of ingresoLineasRows) {
    const servicio = serviceMap.get(linea.servicioId);
    if (!servicio) continue;
    if (filters.rubro && servicio.rubro !== filters.rubro) continue;
    byServicio.set(
      servicio.nombre,
      (byServicio.get(servicio.nombre) ?? 0) + linea.subtotal,
    );
  }

  const stockCritico = new Map<string, number>();
  for (const row of stockRows) {
    const insumo = insumoMap.get(row.insumoId);
    if (!insumo) continue;
    if (row.cantidad < insumo.umbralStockBajo) {
      const name = sucursalMap.get(row.sucursalId) ?? "Sin sucursal";
      stockCritico.set(name, (stockCritico.get(name) ?? 0) + 1);
    }
  }

  const byHour = new Map<string, number>();
  for (const turno of turnosRows.filter(
    (item) => item.estado !== "cancelado" && item.estado !== "ausente",
  )) {
    const hour = `${turno.hora.slice(0, 2)}hs`;
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }

  const customerVisits = new Map<string, number>();
  const registerCustomer = (key?: string | null) => {
    if (!key) return;
    customerVisits.set(key, (customerVisits.get(key) ?? 0) + 1);
  };

  for (const turno of turnosRows) {
    registerCustomer(turno.clienteTelefono || turno.clienteNombre);
  }
  for (const ingreso of ingresosRows) {
    registerCustomer(ingreso.clienteId);
  }

  const recurrentes = Array.from(customerVisits.values()).filter(
    (count) => count > 1,
  ).length;
  const nuevos = Array.from(customerVisits.values()).filter(
    (count) => count <= 1,
  ).length;
  const retentionTotal = recurrentes + nuevos;

  const movimientoRows =
    scope.sucursalIdsPermitidas.length > 0
      ? await db
          .select({
            movimiento: movimientosStockTable,
            actor: profilesTable.nombre,
          })
          .from(movimientosStockTable)
          .leftJoin(
            profilesTable,
            eq(movimientosStockTable.usuarioId, profilesTable.userId),
          )
          .where(inArray(movimientosStockTable.sucursalId, scope.sucursalIdsPermitidas))
          .orderBy(asc(movimientosStockTable.fecha))
      : [];

  const eventoRows =
    scope.sucursalIdsPermitidas.length > 0
      ? await db
          .select({
            evento: turnoEventosTable,
            turnoSucursalId: turnosTable.sucursalId,
            turnoProfesionalId: turnosTable.profesionalId,
            actor: profilesTable.nombre,
          })
          .from(turnoEventosTable)
          .innerJoin(turnosTable, eq(turnoEventosTable.turnoId, turnosTable.id))
          .leftJoin(
            profilesTable,
            eq(turnoEventosTable.actorUsuarioId, profilesTable.userId),
          )
          .where(inArray(turnosTable.sucursalId, scope.sucursalIdsPermitidas))
          .orderBy(asc(turnoEventosTable.fecha))
      : [];

  const recentActivity = [
    ...eventoRows
      .filter((item) =>
        scope.rol === "empleado" && scope.empleadoId
          ? item.turnoProfesionalId === scope.empleadoId
          : true,
      )
      .map((item) => ({
        id: item.evento.id,
        modulo: "Turnos",
        actor: item.actor ?? "Sistema",
        fecha: item.evento.fecha.toISOString(),
        detalle: item.evento.detalle ?? item.evento.tipo,
      })),
    ...movimientoRows.map((item) => ({
      id: item.movimiento.id,
      modulo: "Stock",
      actor: item.actor ?? "Sistema",
      fecha: item.movimiento.fecha.toISOString(),
      detalle: `${item.movimiento.tipo} por ${item.movimiento.cantidad}`,
    })),
  ]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 8);

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
      tickets: ingresosRows.length,
      turnos: turnosRows.length,
      ocupacionPct: Math.round((totalMinutes / capacityMinutes) * 100),
      cancelacionesPct:
        turnosRows.length > 0
          ? Math.round((turnosCancelados / turnosRows.length) * 100)
          : 0,
      stockBajo: stockRows.filter((row) => {
        const insumo = insumoMap.get(row.insumoId);
        return insumo && row.cantidad >= 0 && row.cantidad < insumo.umbralStockBajo;
      }).length,
      stockNegativo: stockRows.filter((row) => row.cantidad < 0).length,
      egresos: egresosTotal,
    },
    charts: {
      ingresosPorDia: Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, value })),
      turnosPorEstado: Array.from(byTurnoEstado.entries()).map(
        ([label, value]) => ({
          label,
          value,
        }),
      ),
      ingresosPorSucursal: Array.from(bySucursalIngresos.entries()).map(
        ([label, value]) => ({
          label,
          value,
        }),
      ),
      rendimientoPorProfesional: Array.from(byEmpleado.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, value]) => ({ label, value })),
      stockCriticoPorSucursal: Array.from(stockCritico.entries()).map(
        ([label, value]) => ({
          label,
          value,
        }),
      ),
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
        tasaPct:
          retentionTotal > 0
            ? Math.round((recurrentes / retentionTotal) * 100)
            : 0,
      },
    },
    governance: {
      metricas: [
        {
          nombre: "Ocupacion",
          definicion:
            "Minutos reservados sobre capacidad teorica de 8 horas por profesional activo.",
        },
        {
          nombre: "Cancelaciones",
          definicion:
            "Porcentaje de turnos cancelados sobre el total de turnos del periodo filtrado.",
        },
        {
          nombre: "Neto",
          definicion:
            "Total cobrado menos comisiones y costo estimado de insumos.",
        },
        {
          nombre: "Stock critico",
          definicion:
            "Insumos por debajo del umbral o en negativo segun stock actual por sucursal.",
        },
      ],
      actividadReciente: recentActivity,
    },
  };
}
