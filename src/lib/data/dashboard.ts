"use server";

import { requireUser } from "@/lib/auth/session";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import { getCierreDeFecha } from "./caja";
import { listEgresos } from "./egresos";
import { computeBreakdown } from "./ingresos-helpers";
import { listIngresos } from "./ingresos";
import { listStockBySucursal } from "./stock";
import type { Empleado, Servicio } from "@/lib/types";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface DashboardKpis {
  ventasHoy: number;
  ticketsHoy: number;
  ticketPromedioHoy: number;
  netoHoy: number;
  comisionesHoy: number;
  ventasMes: number;
  ticketsMes: number;
  netoMes: number;
  comisionesMes: number;
  egresosMes: number;
  stockBajo: number;
  stockNegativo: number;
  egresosPendientes: number;
  egresosPendientesMonto: number;
  cierreHoyId: string | null;
}

export interface DashboardData {
  kpis: DashboardKpis;
  ventasUltimos14: Array<{ fecha: string; total: number; tickets: number }>;
  topServicios: Array<{
    servicio: Servicio;
    cantidad: number;
    total: number;
  }>;
  topEmpleados: Array<{
    empleado: Empleado;
    comisiones: number;
    lineas: number;
  }>;
  ventasPorMp: Array<{
    codigo: string;
    nombre: string;
    total: number;
    pct: number;
  }>;
}

export async function getDashboardData(
  sucursalId: string,
): Promise<DashboardData> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (!isSucursalAllowed(scope, sucursalId)) {
    throw new Error("No tienes acceso a esa sucursal");
  }

  const now = new Date();
  const inicioHoy = startOfDay(now).toISOString();
  const finHoy = endOfDay(now).toISOString();
  const inicioMes = startOfMonth(now).toISOString();
  const inicio14 = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13)).toISOString();

  const ingresosHoy = await listIngresos({
    sucursalId,
    desde: inicioHoy,
    hasta: finHoy,
  });
  const ingresosMes = await listIngresos({
    sucursalId,
    desde: inicioMes,
    hasta: now.toISOString(),
  });
  const ingresosUltimos14 = await listIngresos({
    sucursalId,
    desde: inicio14,
    hasta: now.toISOString(),
  });
  const egresosMesRows = await listEgresos({
    sucursalId,
    desde: inicioMes,
    hasta: now.toISOString(),
  });
  const pendientes = await listEgresos({
    sucursalId,
    soloPendientes: true,
  });
  const stockRows = await listStockBySucursal(sucursalId);
  const cierreHoy = await getCierreDeFecha(sucursalId, ymd(now));

  const detalleHoy = ingresosHoy.map((row) => ({
    ingreso: row.ingreso,
    breakdown: computeBreakdown(row.ingreso, row.lineas),
  }));
  const detalleMes = ingresosMes.map((row) => ({
    ingreso: row.ingreso,
    lineas: row.lineas,
    breakdown: computeBreakdown(row.ingreso, row.lineas),
  }));

  const ventasHoy = detalleHoy.reduce((sum, row) => sum + row.breakdown.total, 0);
  const ticketsHoy = detalleHoy.length;
  const netoHoy = detalleHoy.reduce((sum, row) => sum + row.breakdown.neto, 0);
  const comisionesHoy = detalleHoy.reduce(
    (sum, row) => sum + row.breakdown.comisiones,
    0,
  );

  const ventasMes = detalleMes.reduce((sum, row) => sum + row.breakdown.total, 0);
  const ticketsMes = detalleMes.length;
  const netoMes = detalleMes.reduce((sum, row) => sum + row.breakdown.neto, 0);
  const comisionesMes = detalleMes.reduce(
    (sum, row) => sum + row.breakdown.comisiones,
    0,
  );

  const egresosMes = egresosMesRows.reduce((sum, row) => sum + row.egreso.valor, 0);
  const egresosPendientesMonto = pendientes.reduce(
    (sum, row) => sum + row.egreso.valor,
    0,
  );

  const ventasUltimos14 = [];
  for (let i = 13; i >= 0; i -= 1) {
    const fecha = new Date(now);
    fecha.setDate(fecha.getDate() - i);
    const fechaYmd = ymd(fecha);
    const delDia = ingresosUltimos14.filter(
      (row) => row.ingreso.fecha.slice(0, 10) === fechaYmd,
    );
    ventasUltimos14.push({
      fecha: fechaYmd,
      total: delDia.reduce((sum, row) => sum + row.ingreso.total, 0),
      tickets: delDia.length,
    });
  }

  const servAcc = new Map<string, { servicio: Servicio; cantidad: number; total: number }>();
  for (const row of ingresosMes) {
    for (const linea of row.lineas) {
      if (!linea.servicio) continue;
      const current = servAcc.get(linea.servicio.id) ?? {
        servicio: linea.servicio,
        cantidad: 0,
        total: 0,
      };
      current.cantidad += linea.cantidad;
      current.total += linea.subtotal;
      servAcc.set(linea.servicio.id, current);
    }
  }
  const topServicios = Array.from(servAcc.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const empAcc = new Map<string, { empleado: Empleado; comisiones: number; lineas: number }>();
  for (const row of ingresosMes) {
    for (const linea of row.lineas) {
      if (!linea.empleado) continue;
      const current = empAcc.get(linea.empleado.id) ?? {
        empleado: linea.empleado,
        comisiones: 0,
        lineas: 0,
      };
      current.comisiones += linea.comision_monto;
      current.lineas += 1;
      empAcc.set(linea.empleado.id, current);
    }
  }
  const topEmpleados = Array.from(empAcc.values())
    .sort((a, b) => b.comisiones - a.comisiones)
    .slice(0, 5);

  const mpAcc = new Map<string, { codigo: string; nombre: string; total: number }>();
  for (const row of ingresosMes) {
    if (row.mp1) {
      const current = mpAcc.get(row.mp1.id) ?? {
        codigo: row.mp1.codigo,
        nombre: row.mp1.nombre,
        total: 0,
      };
      current.total += row.ingreso.valor1;
      mpAcc.set(row.mp1.id, current);
    }
    if (row.mp2 && row.ingreso.valor2) {
      const current = mpAcc.get(row.mp2.id) ?? {
        codigo: row.mp2.codigo,
        nombre: row.mp2.nombre,
        total: 0,
      };
      current.total += row.ingreso.valor2;
      mpAcc.set(row.mp2.id, current);
    }
  }
  const totalMp = Array.from(mpAcc.values()).reduce((sum, item) => sum + item.total, 0);
  const ventasPorMp = Array.from(mpAcc.values())
    .map((item) => ({
      ...item,
      pct: totalMp > 0 ? (item.total / totalMp) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    kpis: {
      ventasHoy,
      ticketsHoy,
      ticketPromedioHoy: ticketsHoy > 0 ? ventasHoy / ticketsHoy : 0,
      netoHoy,
      comisionesHoy,
      ventasMes,
      ticketsMes,
      netoMes,
      comisionesMes,
      egresosMes,
      stockBajo: stockRows.filter((row) => row.estado === "bajo").length,
      stockNegativo: stockRows.filter((row) => row.estado === "negativo").length,
      egresosPendientes: pendientes.length,
      egresosPendientesMonto,
      cierreHoyId: cierreHoy?.id ?? null,
    },
    ventasUltimos14,
    topServicios,
    topEmpleados,
    ventasPorMp,
  };
}
