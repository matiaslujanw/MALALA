"use server";

import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import {
  anticipos as anticiposTable,
  cierresCaja as cierresCajaTable,
  egresos as egresosTable,
  empleados as empleadosTable,
  rubrosGasto as rubrosGastoTable,
} from "@/lib/db/schema";
import { getActiveSucursalForUser } from "@/lib/auth/session";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import {
  emitMovimientoBancarioTx,
  getCuentaIdForMpTx,
} from "./movimientos-bancarios-helpers";
import { anticipoSchema } from "@/lib/validations/anticipo";
import type { Anticipo } from "@/lib/types";

function createId() {
  return crypto.randomUUID();
}

function isoStart(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toISOString();
}

function isoEnd(fecha: string): string {
  return new Date(`${fecha}T23:59:59.999`).toISOString();
}

function mapAnticipo(row: typeof anticiposTable.$inferSelect): Anticipo {
  return {
    id: row.id,
    empleado_id: row.empleadoId,
    sucursal_id: row.sucursalId,
    fecha: row.fecha.toISOString(),
    monto: row.monto,
    mp_id: row.mpId ?? undefined,
    egreso_id: row.egresoId ?? undefined,
    liquidacion_id: row.liquidacionId ?? undefined,
    observacion: row.observacion ?? undefined,
    usuario_id: row.usuarioId,
    creado_en: row.creadoEn.toISOString(),
  };
}

/** Todos los anticipos de un empleado, más recientes primero. */
export async function listAnticipos(empleadoId: string): Promise<Anticipo[]> {
  requireSupabaseRuntime("Los anticipos requieren Supabase configurado.");
  const db = getDb();
  const rows = await db
    .select()
    .from(anticiposTable)
    .where(eq(anticiposTable.empleadoId, empleadoId))
    .orderBy(desc(anticiposTable.fecha), desc(anticiposTable.creadoEn));
  return rows.map(mapAnticipo);
}

/**
 * Anticipos pendientes de descontar (liquidacion_id null) de un empleado en una
 * sucursal, dentro de un período. Se usan al previsualizar/crear la liquidación.
 */
export async function listAnticiposPendientesPeriodo(args: {
  empleadoId: string;
  sucursalId: string;
  desde: string;
  hasta: string;
}): Promise<Anticipo[]> {
  requireSupabaseRuntime("Los anticipos requieren Supabase configurado.");
  const db = getDb();
  const rows = await db
    .select()
    .from(anticiposTable)
    .where(
      and(
        eq(anticiposTable.empleadoId, args.empleadoId),
        eq(anticiposTable.sucursalId, args.sucursalId),
        isNull(anticiposTable.liquidacionId),
        gte(anticiposTable.fecha, new Date(isoStart(args.desde))),
        lte(anticiposTable.fecha, new Date(isoEnd(args.hasta))),
      ),
    )
    .orderBy(asc(anticiposTable.fecha));
  return rows.map(mapAnticipo);
}

export async function registrarAnticipo(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("Los anticipos requieren Supabase configurado.");

  const parsed = anticipoSchema.safeParse({
    empleado_id: formData.get("empleado_id"),
    monto: formData.get("monto"),
    mp_id: formData.get("mp_id"),
    observacion: formData.get("observacion"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const data = parsed.data;

  const scope = buildAccessScope(user);
  const sucursal = await getActiveSucursalForUser(user);
  if (!sucursal || !isSucursalAllowed(scope, sucursal.id)) {
    return { ok: false, errors: { _: ["Sin sucursal activa válida"] } };
  }

  const db = getDb();

  const [empleado] = await db
    .select({ nombre: empleadosTable.nombre })
    .from(empleadosTable)
    .where(eq(empleadosTable.id, data.empleado_id))
    .limit(1);
  if (!empleado) return { ok: false, errors: { _: ["Empleado no encontrado"] } };

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
          'No existe el rubro de gasto "Sueldos". Creálo en Catálogos → Rubros antes de cargar anticipos.',
        ],
      },
    };
  }

  const ahora = new Date();
  const ymdHoy = ahora.toISOString().slice(0, 10);
  const egresoId = createId();
  const anticipoId = createId();
  const observacionEgreso =
    `Anticipo ${empleado.nombre}` +
    (data.observacion ? ` — ${data.observacion}` : "");

  try {
    await db.transaction(async (tx) => {
      const [cierreDelDia] = await tx
        .select({ id: cierresCajaTable.id })
        .from(cierresCajaTable)
        .where(
          and(
            eq(cierresCajaTable.sucursalId, sucursal.id),
            eq(cierresCajaTable.fecha, ymdHoy),
          ),
        )
        .limit(1);
      if (cierreDelDia) {
        throw new Error(
          `La caja del ${ymdHoy} ya está cerrada para esta sucursal. Reabrí el cierre antes de registrar el anticipo.`,
        );
      }

      await tx.insert(egresosTable).values({
        id: egresoId,
        fecha: ahora,
        sucursalId: sucursal.id,
        rubroId: rubro.id,
        valor: data.monto,
        mpId: data.mp_id,
        observacion: observacionEgreso,
        pagado: true,
        usuarioId: user.id,
      });

      const cuentaId = await getCuentaIdForMpTx(tx, data.mp_id);
      if (cuentaId) {
        await emitMovimientoBancarioTx(tx, {
          cuentaId,
          fecha: ahora,
          monto: -Math.abs(data.monto),
          tipo: "egreso",
          sucursalId: sucursal.id,
          refTipo: "egreso",
          refId: egresoId,
          descripcion: observacionEgreso,
          usuarioId: user.id,
        });
      }

      await tx.insert(anticiposTable).values({
        id: anticipoId,
        empleadoId: data.empleado_id,
        sucursalId: sucursal.id,
        fecha: ahora,
        monto: data.monto,
        mpId: data.mp_id,
        egresoId,
        liquidacionId: null,
        observacion: data.observacion ?? null,
        usuarioId: user.id,
      });
    });
  } catch (error) {
    return {
      ok: false,
      errors: {
        _: [
          error instanceof Error ? error.message : "No se pudo registrar el anticipo",
        ],
      },
    };
  }

  revalidatePath(`/catalogos/empleados/${data.empleado_id}`);
  revalidatePath("/catalogos/empleados");
  revalidatePath("/egresos");
  revalidatePath("/caja");
  revalidatePath("/bancos");
  revalidatePath("/dashboard");
  return { ok: true };
}
