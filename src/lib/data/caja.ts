"use server";

import { revalidatePath } from "next/cache";
import { id, store } from "@/lib/mock/store";
import { requireUser } from "@/lib/auth/session";
import { fieldErrors, requireRole } from "./_helpers";
import { cierreCajaSchema, DENOMINACIONES_ARS } from "@/lib/validations/caja";
import type { CierreCaja, Cliente, Empleado, MedioPago } from "@/lib/types";
import {
  computeBreakdown,
  detallarLineas,
} from "./ingresos-helpers";

/**
 * Resumen de movimientos del día por medio de pago, para una sucursal.
 * Incluye ingresos (ventas no anuladas) y egresos (sólo pagados).
 */
export interface ResumenMpRow {
  mp: MedioPago;
  ingresos: number;
  egresos: number;
  neto: number;
}

export interface ResumenDelDia {
  fecha: string; // YYYY-MM-DD
  sucursal_id: string;
  porMp: ResumenMpRow[];
  totalIngresos: number;
  totalEgresos: number;
  totalNeto: number;
  // Atajos por código común para el cierre
  ef: { ingresos: number; egresos: number; neto: number };
  tr: { ingresos: number; egresos: number; neto: number };
  tc: { ingresos: number; egresos: number; neto: number };
  td: { ingresos: number; egresos: number; neto: number };
  // Cantidades de movimientos
  cantIngresos: number;
  cantEgresos: number;
  // Detalle del día
  tickets: TicketResumen[];
  comisionesPorEmpleado: ComisionEmpleadoRow[];
  totalComisiones: number;
  costoInsumos: number;
  paraElLocal: number; // total cobrado − comisiones (sin descontar insumos)
  netoNegocio: number; // total cobrado − comisiones − costo insumos
}

export interface TicketResumen {
  id: string;
  fecha: string;
  cliente: Cliente | null;
  total: number;
  comisiones: number;
  cantLineas: number;
  empleados: string[]; // nombres únicos
}

export interface ComisionEmpleadoRow {
  empleado: Empleado;
  total: number;
  lineas: number;
  pctDelTotal: number; // % sobre el total cobrado del día
}

function isoStartOfDay(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toISOString();
}
function isoEndOfDay(fecha: string): string {
  return new Date(`${fecha}T23:59:59.999`).toISOString();
}

function emptyMpTotals() {
  return { ingresos: 0, egresos: 0, neto: 0 };
}

export async function getResumenDelDia(
  sucursalId: string,
  fecha: string, // YYYY-MM-DD
): Promise<ResumenDelDia> {
  await requireUser();
  const desde = isoStartOfDay(fecha);
  const hasta = isoEndOfDay(fecha);

  const ingresosDelDia = store.ingresos.filter(
    (i) =>
      !i.anulado &&
      i.sucursal_id === sucursalId &&
      i.fecha >= desde &&
      i.fecha <= hasta,
  );
  const egresosDelDia = store.egresos.filter(
    (e) =>
      e.pagado &&
      e.sucursal_id === sucursalId &&
      e.fecha >= desde &&
      e.fecha <= hasta,
  );

  const acc = new Map<string, { ingresos: number; egresos: number }>();
  for (const mp of store.mediosPago) acc.set(mp.id, { ingresos: 0, egresos: 0 });

  for (const ing of ingresosDelDia) {
    const a = acc.get(ing.mp1_id);
    if (a) a.ingresos += ing.valor1;
    if (ing.mp2_id && ing.valor2 != null) {
      const b = acc.get(ing.mp2_id);
      if (b) b.ingresos += ing.valor2;
    }
  }
  for (const eg of egresosDelDia) {
    const a = acc.get(eg.mp_id);
    if (a) a.egresos += eg.valor;
  }

  const porMp: ResumenMpRow[] = store.mediosPago.map((mp) => {
    const a = acc.get(mp.id) ?? { ingresos: 0, egresos: 0 };
    return { mp, ingresos: a.ingresos, egresos: a.egresos, neto: a.ingresos - a.egresos };
  });

  const totalIngresos = porMp.reduce((s, r) => s + r.ingresos, 0);
  const totalEgresos = porMp.reduce((s, r) => s + r.egresos, 0);

  const byCodigo = (codigo: string) => {
    const row = porMp.find((r) => r.mp.codigo === codigo);
    return row
      ? { ingresos: row.ingresos, egresos: row.egresos, neto: row.neto }
      : emptyMpTotals();
  };

  // Tickets del día con desglose de comisiones
  const tickets: TicketResumen[] = [];
  const comAcc = new Map<string, { total: number; lineas: number }>();
  let totalComisionesAll = 0;
  let costoInsumosAll = 0;

  for (const ing of ingresosDelDia) {
    const lineas = detallarLineas(ing.id);
    const breakdown = computeBreakdown(ing, lineas);
    totalComisionesAll += breakdown.comisiones;
    costoInsumosAll += breakdown.costoInsumos;

    const empleadosNombres = new Set<string>();
    for (const l of lineas) {
      if (!l.empleado) continue;
      empleadosNombres.add(l.empleado.nombre);
      const cur = comAcc.get(l.empleado.id) ?? { total: 0, lineas: 0 };
      cur.total += l.comision_monto;
      cur.lineas += 1;
      comAcc.set(l.empleado.id, cur);
    }

    tickets.push({
      id: ing.id,
      fecha: ing.fecha,
      cliente: ing.cliente_id
        ? store.clientes.find((c) => c.id === ing.cliente_id) ?? null
        : null,
      total: ing.total,
      comisiones: breakdown.comisiones,
      cantLineas: lineas.length,
      empleados: Array.from(empleadosNombres),
    });
  }

  const comisionesPorEmpleado: ComisionEmpleadoRow[] = Array.from(
    comAcc.entries(),
  )
    .map(([empId, v]) => {
      const emp = store.empleados.find((e) => e.id === empId);
      return emp
        ? {
            empleado: emp,
            total: v.total,
            lineas: v.lineas,
            pctDelTotal:
              totalIngresos > 0 ? (v.total / totalIngresos) * 100 : 0,
          }
        : null;
    })
    .filter((x): x is ComisionEmpleadoRow => x !== null)
    .sort((a, b) => b.total - a.total);

  const paraElLocal = totalIngresos - totalComisionesAll;
  const netoNegocio = paraElLocal - costoInsumosAll;

  // Tickets ordenados por hora ascendente
  tickets.sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    fecha,
    sucursal_id: sucursalId,
    porMp,
    totalIngresos,
    totalEgresos,
    totalNeto: totalIngresos - totalEgresos,
    ef: byCodigo("EF"),
    tr: byCodigo("TR"),
    tc: byCodigo("TC"),
    td: byCodigo("TD"),
    cantIngresos: ingresosDelDia.length,
    cantEgresos: egresosDelDia.length,
    tickets,
    comisionesPorEmpleado,
    totalComisiones: totalComisionesAll,
    costoInsumos: costoInsumosAll,
    paraElLocal,
    netoNegocio,
  };
}

export interface CierreConDetalle {
  cierre: CierreCaja;
  sucursal_nombre: string;
  cerrado_por_nombre: string;
  efectivoContado: number;
  efectivoEsperado: number;
  diferenciaEf: number;
}

function efectivoContadoDe(billetes: Record<string, number>): number {
  return Object.entries(billetes).reduce((acc, [denom, cant]) => {
    const d = Number(denom);
    if (!Number.isFinite(d)) return acc;
    return acc + d * (cant || 0);
  }, 0);
}

function detallarCierre(c: CierreCaja): CierreConDetalle {
  const sucursal = store.sucursales.find((s) => s.id === c.sucursal_id);
  const usuario = store.usuarios.find((u) => u.id === c.cerrado_por);
  const efectivoContado = efectivoContadoDe(c.billetes);
  const efectivoEsperado =
    c.saldo_inicial_ef + c.ingresos_ef - c.egresos_ef;
  return {
    cierre: c,
    sucursal_nombre: sucursal?.nombre ?? "—",
    cerrado_por_nombre: usuario?.nombre ?? "—",
    efectivoContado,
    efectivoEsperado,
    diferenciaEf: efectivoContado - efectivoEsperado,
  };
}

export async function listCierres(opts?: {
  sucursalId?: string;
  limit?: number;
}): Promise<CierreConDetalle[]> {
  await requireUser();
  let arr = [...store.cierresCaja];
  if (opts?.sucursalId) arr = arr.filter((c) => c.sucursal_id === opts.sucursalId);
  arr.sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (opts?.limit) arr = arr.slice(0, opts.limit);
  return arr.map(detallarCierre);
}

export async function getCierre(cierreId: string): Promise<CierreConDetalle | null> {
  await requireUser();
  const c = store.cierresCaja.find((x) => x.id === cierreId);
  return c ? detallarCierre(c) : null;
}

export async function getCierreDeFecha(
  sucursalId: string,
  fecha: string,
): Promise<CierreCaja | null> {
  await requireUser();
  return (
    store.cierresCaja.find(
      (c) => c.sucursal_id === sucursalId && c.fecha === fecha,
    ) ?? null
  );
}

/**
 * Devuelve el último cierre de la sucursal estrictamente anterior a `fecha`.
 * Sirve para arrastrar el saldo final como saldo inicial del día siguiente.
 */
export async function getUltimoCierreAntesDe(
  sucursalId: string,
  fecha: string, // YYYY-MM-DD
): Promise<CierreConDetalle | null> {
  await requireUser();
  const previos = store.cierresCaja
    .filter((c) => c.sucursal_id === sucursalId && c.fecha < fecha)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return previos[0] ? detallarCierre(previos[0]) : null;
}

export interface SugerenciasArrastre {
  saldoInicialEf: number;
  saldoInicialBanco: number;
  desdeCierre: { id: string; fecha: string } | null;
}

export async function getSugerenciasArrastre(
  sucursalId: string,
  fecha: string,
): Promise<SugerenciasArrastre> {
  const ultimo = await getUltimoCierreAntesDe(sucursalId, fecha);
  if (!ultimo) {
    return {
      saldoInicialEf: 0,
      saldoInicialBanco: 0,
      desdeCierre: null,
    };
  }
  return {
    saldoInicialEf: ultimo.efectivoContado,
    saldoInicialBanco: ultimo.cierre.saldo_banco,
    desdeCierre: { id: ultimo.cierre.id, fecha: ultimo.cierre.fecha },
  };
}

/**
 * Devuelve el cierre que afecta a la fecha indicada, si lo hay.
 * Útil para bloquear cargas con fecha ya cerrada.
 */
export async function getCierreQueBloqueaFecha(
  sucursalId: string,
  fechaIso: string,
): Promise<CierreCaja | null> {
  await requireUser();
  const ymd = fechaIso.slice(0, 10);
  return (
    store.cierresCaja.find(
      (c) => c.sucursal_id === sucursalId && c.fecha === ymd,
    ) ?? null
  );
}

/**
 * Reapertura: elimina el cierre, dejando el día como "abierto" otra vez.
 * Sólo admin.
 */
export async function reabrirCierre(
  cierreId: string,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string[]> }> {
  await requireRole(["admin"]);
  const idx = store.cierresCaja.findIndex((c) => c.id === cierreId);
  if (idx < 0) {
    return { ok: false, errors: { _: ["Cierre no encontrado"] } };
  }
  store.cierresCaja.splice(idx, 1);
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type CreateCierreResult =
  | { ok: true; cierreId: string }
  | { ok: false; errors: Record<string, string[]> };

export async function createCierre(
  _prev: CreateCierreResult | null,
  formData: FormData,
): Promise<CreateCierreResult> {
  const user = await requireRole(["admin", "encargada"]);

  // Reconstruir billetes desde inputs `billete_<denom>`
  const billetes: Record<string, number> = {};
  for (const denom of DENOMINACIONES_ARS) {
    const raw = formData.get(`billete_${denom}`);
    const n = typeof raw === "string" && raw !== "" ? Number(raw) : 0;
    if (Number.isFinite(n) && n > 0) {
      billetes[String(denom)] = Math.floor(n);
    }
  }

  const parsed = cierreCajaSchema.safeParse({
    sucursal_id: formData.get("sucursal_id"),
    fecha: formData.get("fecha"),
    saldo_inicial_ef: formData.get("saldo_inicial_ef") ?? 0,
    saldo_banco: formData.get("saldo_banco") ?? 0,
    billetes,
    vouchers: formData.get("vouchers") ?? 0,
    giftcards: formData.get("giftcards") ?? 0,
    autoconsumos: formData.get("autoconsumos") ?? 0,
    cheques: formData.get("cheques") ?? 0,
    aportes: formData.get("aportes") ?? 0,
    ingresos_cc: formData.get("ingresos_cc") ?? 0,
    anticipos: formData.get("anticipos") ?? 0,
    observacion: formData.get("observacion"),
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  // Un cierre por sucursal+fecha
  const dup = store.cierresCaja.find(
    (c) => c.sucursal_id === data.sucursal_id && c.fecha === data.fecha,
  );
  if (dup) {
    return {
      ok: false,
      errors: { fecha: ["Ya existe un cierre para esta fecha y sucursal"] },
    };
  }

  // Tomar totales del día como snapshot
  const resumen = await getResumenDelDia(data.sucursal_id, data.fecha);

  const cierre: CierreCaja = {
    id: id(),
    sucursal_id: data.sucursal_id,
    fecha: data.fecha,
    saldo_inicial_ef: data.saldo_inicial_ef,
    saldo_banco: data.saldo_banco,
    billetes: data.billetes,
    ingresos_ef: resumen.ef.ingresos,
    egresos_ef: resumen.ef.egresos,
    ingresos_banc: resumen.tr.ingresos,
    egresos_banc: resumen.tr.egresos,
    cobros_tc: resumen.tc.ingresos,
    cobros_td: resumen.td.ingresos,
    vouchers: data.vouchers,
    giftcards: data.giftcards,
    autoconsumos: data.autoconsumos,
    cheques: data.cheques,
    aportes: data.aportes,
    ingresos_cc: data.ingresos_cc,
    anticipos: data.anticipos,
    observacion: data.observacion,
    cerrado_por: user.id,
    fecha_cierre: new Date().toISOString(),
  };
  store.cierresCaja.push(cierre);

  revalidatePath("/caja");
  revalidatePath("/dashboard");
  return { ok: true, cierreId: cierre.id };
}
