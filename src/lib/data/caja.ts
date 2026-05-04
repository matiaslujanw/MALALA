"use server";

import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { cierresCaja as cierresCajaTable, profiles as profilesTable, sucursales as sucursalesTable } from "@/lib/db/schema";
import { fieldErrors, requireRole } from "./_helpers";
import { cierreCajaSchema, DENOMINACIONES_ARS } from "@/lib/validations/caja";
import type { CierreCaja, Cliente, Empleado, MedioPago } from "@/lib/types";
import { listEgresos } from "./egresos";
import { computeBreakdown } from "./ingresos-helpers";
import { listIngresos } from "./ingresos";
import { listMediosPago } from "./medios-pago";

export interface ResumenMpRow {
  mp: MedioPago;
  ingresos: number;
  egresos: number;
  neto: number;
}

export interface ResumenDelDia {
  fecha: string;
  sucursal_id: string;
  porMp: ResumenMpRow[];
  totalIngresos: number;
  totalEgresos: number;
  totalNeto: number;
  ef: { ingresos: number; egresos: number; neto: number };
  tr: { ingresos: number; egresos: number; neto: number };
  tc: { ingresos: number; egresos: number; neto: number };
  td: { ingresos: number; egresos: number; neto: number };
  cantIngresos: number;
  cantEgresos: number;
  tickets: TicketResumen[];
  comisionesPorEmpleado: ComisionEmpleadoRow[];
  totalComisiones: number;
  costoInsumos: number;
  paraElLocal: number;
  netoNegocio: number;
}

export interface TicketResumen {
  id: string;
  fecha: string;
  cliente: Cliente | null;
  total: number;
  comisiones: number;
  cantLineas: number;
  empleados: string[];
}

export interface ComisionEmpleadoRow {
  empleado: Empleado;
  total: number;
  lineas: number;
  pctDelTotal: number;
}

function createId() {
  return crypto.randomUUID();
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

function mapCierre(row: typeof cierresCajaTable.$inferSelect): CierreCaja {
  return {
    id: row.id,
    sucursal_id: row.sucursalId,
    fecha: row.fecha,
    saldo_inicial_ef: row.saldoInicialEf,
    saldo_banco: row.saldoBanco,
    billetes: row.billetes,
    ingresos_ef: row.ingresosEf,
    egresos_ef: row.egresosEf,
    ingresos_banc: row.ingresosBanc,
    egresos_banc: row.egresosBanc,
    cobros_tc: row.cobrosTc,
    cobros_td: row.cobrosTd,
    vouchers: row.vouchers,
    giftcards: row.giftcards,
    autoconsumos: row.autoconsumos,
    cheques: row.cheques,
    aportes: row.aportes,
    ingresos_cc: row.ingresosCc,
    anticipos: row.anticipos,
    observacion: row.observacion ?? undefined,
    cerrado_por: row.cerradoPor,
    fecha_cierre: row.fechaCierre.toISOString(),
  };
}

export async function getResumenDelDia(
  sucursalId: string,
  fecha: string,
): Promise<ResumenDelDia> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (!scope.puedeVerCaja || !isSucursalAllowed(scope, sucursalId)) {
    throw new Error("No tienes acceso a esta caja");
  }

  const desde = isoStartOfDay(fecha);
  const hasta = isoEndOfDay(fecha);

  const mediosPago = await listMediosPago();
  const ingresosDelDia = await listIngresos({
    sucursalId,
    desde,
    hasta,
  });
  const egresosDelDia = await listEgresos({
    sucursalId,
    desde,
    hasta,
  });

  const egresosPagados = egresosDelDia.filter((item) => item.egreso.pagado);
  const acc = new Map<string, { ingresos: number; egresos: number }>();
  for (const mp of mediosPago) acc.set(mp.id, { ingresos: 0, egresos: 0 });

  for (const row of ingresosDelDia) {
    const mp1 = acc.get(row.ingreso.mp1_id);
    if (mp1) mp1.ingresos += row.ingreso.valor1;
    if (row.ingreso.mp2_id && row.ingreso.valor2 != null) {
      const mp2 = acc.get(row.ingreso.mp2_id);
      if (mp2) mp2.ingresos += row.ingreso.valor2;
    }
  }

  for (const row of egresosPagados) {
    const mp = acc.get(row.egreso.mp_id);
    if (mp) mp.egresos += row.egreso.valor;
  }

  const porMp: ResumenMpRow[] = mediosPago.map((mp) => {
    const totals = acc.get(mp.id) ?? { ingresos: 0, egresos: 0 };
    return {
      mp,
      ingresos: totals.ingresos,
      egresos: totals.egresos,
      neto: totals.ingresos - totals.egresos,
    };
  });

  const totalIngresos = porMp.reduce((sum, row) => sum + row.ingresos, 0);
  const totalEgresos = porMp.reduce((sum, row) => sum + row.egresos, 0);
  const byCodigo = (codigo: string) => {
    const row = porMp.find((item) => item.mp.codigo === codigo);
    return row
      ? { ingresos: row.ingresos, egresos: row.egresos, neto: row.neto }
      : emptyMpTotals();
  };

  const tickets: TicketResumen[] = [];
  const comAcc = new Map<string, { empleado: Empleado; total: number; lineas: number }>();
  let totalComisionesAll = 0;
  let costoInsumosAll = 0;

  for (const row of ingresosDelDia) {
    const breakdown = computeBreakdown(row.ingreso, row.lineas);
    totalComisionesAll += breakdown.comisiones;
    costoInsumosAll += breakdown.costoInsumos;

    const empleadosNombres = new Set<string>();
    for (const linea of row.lineas) {
      if (!linea.empleado) continue;
      empleadosNombres.add(linea.empleado.nombre);
      const current = comAcc.get(linea.empleado.id) ?? {
        empleado: linea.empleado,
        total: 0,
        lineas: 0,
      };
      current.total += linea.comision_monto;
      current.lineas += 1;
      comAcc.set(linea.empleado.id, current);
    }

    tickets.push({
      id: row.ingreso.id,
      fecha: row.ingreso.fecha,
      cliente: row.cliente,
      total: row.ingreso.total,
      comisiones: breakdown.comisiones,
      cantLineas: row.lineas.length,
      empleados: Array.from(empleadosNombres),
    });
  }

  const comisionesPorEmpleado = Array.from(comAcc.values())
    .map((item) => ({
      empleado: item.empleado,
      total: item.total,
      lineas: item.lineas,
      pctDelTotal: totalIngresos > 0 ? (item.total / totalIngresos) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const paraElLocal = totalIngresos - totalComisionesAll;
  const netoNegocio = paraElLocal - costoInsumosAll;

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
    cantEgresos: egresosPagados.length,
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

function detallarCierre(args: {
  cierre: CierreCaja;
  sucursalNombre: string;
  usuarioNombre: string;
}): CierreConDetalle {
  const efectivoContado = efectivoContadoDe(args.cierre.billetes);
  const efectivoEsperado =
    args.cierre.saldo_inicial_ef +
    args.cierre.ingresos_ef -
    args.cierre.egresos_ef;
  return {
    cierre: args.cierre,
    sucursal_nombre: args.sucursalNombre,
    cerrado_por_nombre: args.usuarioNombre,
    efectivoContado,
    efectivoEsperado,
    diferenciaEf: efectivoContado - efectivoEsperado,
  };
}

export async function listCierres(opts?: {
  sucursalId?: string;
  limit?: number;
}): Promise<CierreConDetalle[]> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (!scope.puedeVerCaja) return [];
  if (opts?.sucursalId && !isSucursalAllowed(scope, opts.sucursalId)) return [];

  const db = getDb();
  const filters = [inArray(cierresCajaTable.sucursalId, scope.sucursalIdsPermitidas)];
  if (opts?.sucursalId) {
    filters.push(eq(cierresCajaTable.sucursalId, opts.sucursalId));
  }

  const rows = await db
    .select({
      cierre: cierresCajaTable,
      sucursalNombre: sucursalesTable.nombre,
      usuarioNombre: profilesTable.nombre,
    })
    .from(cierresCajaTable)
    .innerJoin(
      sucursalesTable,
      eq(cierresCajaTable.sucursalId, sucursalesTable.id),
    )
    .leftJoin(profilesTable, eq(cierresCajaTable.cerradoPor, profilesTable.userId))
    .where(and(...filters))
    .orderBy(desc(cierresCajaTable.fecha))
    .limit(opts?.limit ?? 100);

  return rows.map((row) =>
    detallarCierre({
      cierre: mapCierre(row.cierre),
      sucursalNombre: row.sucursalNombre,
      usuarioNombre: row.usuarioNombre ?? "Sistema",
    }),
  );
}

export async function getCierre(cierreId: string): Promise<CierreConDetalle | null> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (!scope.puedeVerCaja) return null;

  const db = getDb();
  const [row] = await db
    .select({
      cierre: cierresCajaTable,
      sucursalNombre: sucursalesTable.nombre,
      usuarioNombre: profilesTable.nombre,
    })
    .from(cierresCajaTable)
    .innerJoin(
      sucursalesTable,
      eq(cierresCajaTable.sucursalId, sucursalesTable.id),
    )
    .leftJoin(profilesTable, eq(cierresCajaTable.cerradoPor, profilesTable.userId))
    .where(eq(cierresCajaTable.id, cierreId))
    .limit(1);

  if (!row) return null;
  if (!scope.sucursalIdsPermitidas.includes(row.cierre.sucursalId)) return null;

  return detallarCierre({
    cierre: mapCierre(row.cierre),
    sucursalNombre: row.sucursalNombre,
    usuarioNombre: row.usuarioNombre ?? "Sistema",
  });
}

export async function getCierreDeFecha(
  sucursalId: string,
  fecha: string,
): Promise<CierreCaja | null> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (!scope.puedeVerCaja || !isSucursalAllowed(scope, sucursalId)) return null;

  const db = getDb();
  const [row] = await db
    .select()
    .from(cierresCajaTable)
    .where(
      and(
        eq(cierresCajaTable.sucursalId, sucursalId),
        eq(cierresCajaTable.fecha, fecha),
      ),
    )
    .limit(1);

  return row ? mapCierre(row) : null;
}

export async function getUltimoCierreAntesDe(
  sucursalId: string,
  fecha: string,
): Promise<CierreConDetalle | null> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (!scope.puedeVerCaja || !isSucursalAllowed(scope, sucursalId)) return null;

  const db = getDb();
  const [row] = await db
    .select({
      cierre: cierresCajaTable,
      sucursalNombre: sucursalesTable.nombre,
      usuarioNombre: profilesTable.nombre,
    })
    .from(cierresCajaTable)
    .innerJoin(
      sucursalesTable,
      eq(cierresCajaTable.sucursalId, sucursalesTable.id),
    )
    .leftJoin(profilesTable, eq(cierresCajaTable.cerradoPor, profilesTable.userId))
    .where(
      and(
        eq(cierresCajaTable.sucursalId, sucursalId),
        lt(cierresCajaTable.fecha, fecha),
      ),
    )
    .orderBy(desc(cierresCajaTable.fecha))
    .limit(1);

  if (!row) return null;
  return detallarCierre({
    cierre: mapCierre(row.cierre),
    sucursalNombre: row.sucursalNombre,
    usuarioNombre: row.usuarioNombre ?? "Sistema",
  });
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

export async function getCierreQueBloqueaFecha(
  sucursalId: string,
  fechaIso: string,
): Promise<CierreCaja | null> {
  await requireUser();
  return getCierreDeFecha(sucursalId, fechaIso.slice(0, 10));
}

export async function reabrirCierre(
  cierreId: string,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string[]> }> {
  const user = await requireRole(["admin"]);
  const scope = buildAccessScope(user);
  const db = getDb();
  const [cierre] = await db
    .select()
    .from(cierresCajaTable)
    .where(eq(cierresCajaTable.id, cierreId))
    .limit(1);

  if (!cierre) {
    return { ok: false, errors: { _: ["Cierre no encontrado"] } };
  }
  if (!scope.sucursalIdsPermitidas.includes(cierre.sucursalId)) {
    return { ok: false, errors: { _: ["No tienes acceso a ese cierre"] } };
  }

  await db.delete(cierresCajaTable).where(eq(cierresCajaTable.id, cierreId));
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
  const scope = buildAccessScope(user);

  const billetes: Record<string, number> = {};
  for (const denom of DENOMINACIONES_ARS) {
    const raw = formData.get(`billete_${denom}`);
    const cantidad = typeof raw === "string" && raw !== "" ? Number(raw) : 0;
    if (Number.isFinite(cantidad) && cantidad > 0) {
      billetes[String(denom)] = Math.floor(cantidad);
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

  if (!isSucursalAllowed(scope, data.sucursal_id)) {
    return {
      ok: false,
      errors: { sucursal_id: ["No tienes acceso a esa sucursal"] },
    };
  }

  const db = getDb();
  const [dup] = await db
    .select({ id: cierresCajaTable.id })
    .from(cierresCajaTable)
    .where(
      and(
        eq(cierresCajaTable.sucursalId, data.sucursal_id),
        eq(cierresCajaTable.fecha, data.fecha),
      ),
    )
    .limit(1);

  if (dup) {
    return {
      ok: false,
      errors: { fecha: ["Ya existe un cierre para esta fecha y sucursal"] },
    };
  }

  const resumen = await getResumenDelDia(data.sucursal_id, data.fecha);
  const cierreId = createId();

  await db.insert(cierresCajaTable).values({
    id: cierreId,
    sucursalId: data.sucursal_id,
    fecha: data.fecha,
    saldoInicialEf: data.saldo_inicial_ef,
    saldoBanco: data.saldo_banco,
    billetes: data.billetes,
    ingresosEf: resumen.ef.ingresos,
    egresosEf: resumen.ef.egresos,
    ingresosBanc: resumen.tr.ingresos,
    egresosBanc: resumen.tr.egresos,
    cobrosTc: resumen.tc.ingresos,
    cobrosTd: resumen.td.ingresos,
    vouchers: data.vouchers,
    giftcards: data.giftcards,
    autoconsumos: data.autoconsumos,
    cheques: data.cheques,
    aportes: data.aportes,
    ingresosCc: data.ingresos_cc,
    anticipos: data.anticipos,
    observacion: data.observacion ?? null,
    cerradoPor: user.id,
    fechaCierre: new Date(),
  });

  revalidatePath("/caja");
  revalidatePath("/dashboard");
  return { ok: true, cierreId };
}
