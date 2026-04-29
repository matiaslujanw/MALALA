"use server";

import { store } from "@/lib/mock/store";
import { requireUser } from "@/lib/auth/session";
import { computeBreakdown, detallarLineas } from "./ingresos-helpers";
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
  const x = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  return x;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface DashboardKpis {
  // Hoy
  ventasHoy: number;
  ticketsHoy: number;
  ticketPromedioHoy: number;
  netoHoy: number;
  comisionesHoy: number;
  // Mes
  ventasMes: number;
  ticketsMes: number;
  netoMes: number;
  comisionesMes: number;
  egresosMes: number;
  // Stock
  stockBajo: number;
  stockNegativo: number;
  // Egresos
  egresosPendientes: number;
  egresosPendientesMonto: number;
  // Caja
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
  await requireUser();

  const now = new Date();
  const inicioHoy = startOfDay(now).toISOString();
  const finHoy = endOfDay(now).toISOString();
  const inicioMes = startOfMonth(now).toISOString();

  // Ingresos no anulados de la sucursal
  const ingresos = store.ingresos.filter(
    (i) => !i.anulado && i.sucursal_id === sucursalId,
  );

  const ingresosHoy = ingresos.filter(
    (i) => i.fecha >= inicioHoy && i.fecha <= finHoy,
  );
  const ingresosMes = ingresos.filter((i) => i.fecha >= inicioMes);

  // Breakdowns
  const detalleHoy = ingresosHoy.map((i) => ({
    ingreso: i,
    breakdown: computeBreakdown(i, detallarLineas(i.id)),
  }));
  const detalleMes = ingresosMes.map((i) => ({
    ingreso: i,
    lineas: detallarLineas(i.id),
    breakdown: computeBreakdown(i, detallarLineas(i.id)),
  }));

  const ventasHoy = detalleHoy.reduce((s, x) => s + x.breakdown.total, 0);
  const ticketsHoy = detalleHoy.length;
  const netoHoy = detalleHoy.reduce((s, x) => s + x.breakdown.neto, 0);
  const comisionesHoy = detalleHoy.reduce(
    (s, x) => s + x.breakdown.comisiones,
    0,
  );

  const ventasMes = detalleMes.reduce((s, x) => s + x.breakdown.total, 0);
  const ticketsMes = detalleMes.length;
  const netoMes = detalleMes.reduce((s, x) => s + x.breakdown.neto, 0);
  const comisionesMes = detalleMes.reduce(
    (s, x) => s + x.breakdown.comisiones,
    0,
  );

  // Egresos del mes
  const egresosMesArr = store.egresos.filter(
    (e) => e.sucursal_id === sucursalId && e.fecha >= inicioMes,
  );
  const egresosMes = egresosMesArr.reduce((s, e) => s + e.valor, 0);

  // Egresos pendientes (todo el tiempo)
  const pendientes = store.egresos.filter(
    (e) => e.sucursal_id === sucursalId && !e.pagado,
  );
  const egresosPendientesMonto = pendientes.reduce((s, e) => s + e.valor, 0);

  // Stock bajo / negativo
  let stockBajo = 0;
  let stockNegativo = 0;
  for (const insumo of store.insumos.filter((i) => i.activo)) {
    const row = store.stockSucursal.find(
      (s) => s.insumo_id === insumo.id && s.sucursal_id === sucursalId,
    );
    const cant = row?.cantidad ?? 0;
    if (cant < 0) stockNegativo++;
    else if (cant < insumo.umbral_stock_bajo) stockBajo++;
  }

  // Cierre de hoy
  const fechaHoyYMD = ymd(now);
  const cierreHoy = store.cierresCaja.find(
    (c) => c.sucursal_id === sucursalId && c.fecha === fechaHoyYMD,
  );

  // Ventas últimos 14 días
  const ventasUltimos14: Array<{ fecha: string; total: number; tickets: number }> =
    [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const desde = startOfDay(d).toISOString();
    const hasta = endOfDay(d).toISOString();
    const delDia = ingresos.filter((x) => x.fecha >= desde && x.fecha <= hasta);
    const total = delDia.reduce((s, x) => s + x.total, 0);
    ventasUltimos14.push({
      fecha: ymd(d),
      total,
      tickets: delDia.length,
    });
  }

  // Top servicios del mes
  const servAcc = new Map<string, { cantidad: number; total: number }>();
  for (const x of detalleMes) {
    for (const l of x.lineas) {
      if (!l.servicio) continue;
      const cur = servAcc.get(l.servicio.id) ?? { cantidad: 0, total: 0 };
      cur.cantidad += l.cantidad;
      cur.total += l.subtotal;
      servAcc.set(l.servicio.id, cur);
    }
  }
  const topServicios = Array.from(servAcc.entries())
    .map(([id, v]) => ({
      servicio: store.servicios.find((s) => s.id === id)!,
      cantidad: v.cantidad,
      total: v.total,
    }))
    .filter((x) => x.servicio)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Top empleados por comisión del mes
  const empAcc = new Map<string, { comisiones: number; lineas: number }>();
  for (const x of detalleMes) {
    for (const l of x.lineas) {
      if (!l.empleado) continue;
      const cur = empAcc.get(l.empleado.id) ?? { comisiones: 0, lineas: 0 };
      cur.comisiones += l.comision_monto;
      cur.lineas += 1;
      empAcc.set(l.empleado.id, cur);
    }
  }
  const topEmpleados = Array.from(empAcc.entries())
    .map(([id, v]) => ({
      empleado: store.empleados.find((e) => e.id === id)!,
      comisiones: v.comisiones,
      lineas: v.lineas,
    }))
    .filter((x) => x.empleado)
    .sort((a, b) => b.comisiones - a.comisiones)
    .slice(0, 5);

  // Ventas por medio de pago (mes)
  const mpAcc = new Map<string, number>();
  for (const i of ingresosMes) {
    mpAcc.set(i.mp1_id, (mpAcc.get(i.mp1_id) ?? 0) + i.valor1);
    if (i.mp2_id && i.valor2) {
      mpAcc.set(i.mp2_id, (mpAcc.get(i.mp2_id) ?? 0) + i.valor2);
    }
  }
  const totalMp = Array.from(mpAcc.values()).reduce((s, v) => s + v, 0);
  const ventasPorMp = Array.from(mpAcc.entries())
    .map(([id, total]) => {
      const mp = store.mediosPago.find((m) => m.id === id);
      return {
        codigo: mp?.codigo ?? "—",
        nombre: mp?.nombre ?? "—",
        total,
        pct: totalMp > 0 ? (total / totalMp) * 100 : 0,
      };
    })
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
      stockBajo,
      stockNegativo,
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
