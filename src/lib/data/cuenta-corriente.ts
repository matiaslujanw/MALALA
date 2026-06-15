"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import {
  clientes as clientesTable,
  movimientosCc as movimientosCcTable,
} from "@/lib/db/schema";
import { getActiveSucursalForUser } from "@/lib/auth/session";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import {
  emitMovimientoBancarioTx,
  getCuentaIdForMpTx,
} from "./movimientos-bancarios-helpers";
import { cargoCcSchema, pagoCcSchema } from "@/lib/validations/cuenta-corriente";
import type { MovimientoCc, TipoMovimientoCc } from "@/lib/types";

// Tolerancia para comparaciones de punto flotante en pesos.
const EPS = 0.01;

function createId() {
  return crypto.randomUUID();
}

function mapMovimiento(
  row: typeof movimientosCcTable.$inferSelect,
): MovimientoCc {
  return {
    id: row.id,
    cliente_id: row.clienteId,
    fecha: row.fecha.toISOString(),
    tipo: row.tipo as TipoMovimientoCc,
    monto: row.monto,
    sucursal_id: row.sucursalId ?? undefined,
    mp_id: row.mpId ?? undefined,
    ref_tipo: row.refTipo ?? undefined,
    ref_id: row.refId ?? undefined,
    descripcion: row.descripcion ?? undefined,
    usuario_id: row.usuarioId,
    creado_en: row.creadoEn.toISOString(),
  };
}

export async function listMovimientosCc(
  clienteId: string,
): Promise<MovimientoCc[]> {
  requireSupabaseRuntime(
    "Los movimientos de cuenta corriente requieren Supabase.",
  );
  const db = getDb();
  const rows = await db
    .select()
    .from(movimientosCcTable)
    .where(eq(movimientosCcTable.clienteId, clienteId))
    .orderBy(desc(movimientosCcTable.fecha), desc(movimientosCcTable.creadoEn));
  return rows.map(mapMovimiento);
}

export async function toggleCuentaCorriente(
  clienteId: string,
): Promise<ActionResult> {
  await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("La cuenta corriente requiere Supabase configurado.");

  const db = getDb();
  const [cliente] = await db
    .select()
    .from(clientesTable)
    .where(eq(clientesTable.id, clienteId))
    .limit(1);
  if (!cliente) return { ok: false, errors: { _: ["Cliente no encontrado"] } };

  // No permitir deshabilitar con deuda pendiente: se perdería el rastro del saldo.
  if (cliente.cuentaCorrienteHabilitada && Math.abs(cliente.saldoCc) > EPS) {
    return {
      ok: false,
      errors: {
        _: [
          "No se puede deshabilitar la cuenta corriente con saldo pendiente. Saldá la deuda primero.",
        ],
      },
    };
  }

  await db
    .update(clientesTable)
    .set({ cuentaCorrienteHabilitada: !cliente.cuentaCorrienteHabilitada })
    .where(eq(clientesTable.id, clienteId));

  revalidatePath(`/catalogos/clientes/${clienteId}`);
  revalidatePath("/catalogos/clientes");
  revalidatePath("/ventas/nueva");
  return { ok: true };
}

export async function registrarCargoCc(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("La cuenta corriente requiere Supabase configurado.");

  const parsed = cargoCcSchema.safeParse({
    cliente_id: formData.get("cliente_id"),
    monto: formData.get("monto"),
    descripcion: formData.get("descripcion"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const data = parsed.data;

  const sucursal = await getActiveSucursalForUser(user);
  const db = getDb();
  const fecha = new Date();

  try {
    await db.transaction(async (tx) => {
      const [cliente] = await tx
        .select()
        .from(clientesTable)
        .where(eq(clientesTable.id, data.cliente_id))
        .limit(1);
      if (!cliente) throw new Error("Cliente no encontrado");
      if (!cliente.cuentaCorrienteHabilitada) {
        throw new Error("El cliente no tiene la cuenta corriente habilitada");
      }

      await tx.insert(movimientosCcTable).values({
        id: createId(),
        clienteId: data.cliente_id,
        fecha,
        tipo: "cargo",
        monto: data.monto,
        sucursalId: sucursal?.id ?? null,
        mpId: null,
        refTipo: "manual",
        refId: null,
        descripcion: data.descripcion ?? null,
        usuarioId: user.id,
      });

      await tx
        .update(clientesTable)
        .set({ saldoCc: cliente.saldoCc + data.monto })
        .where(eq(clientesTable.id, data.cliente_id));
    });
  } catch (error) {
    return {
      ok: false,
      errors: {
        _: [error instanceof Error ? error.message : "No se pudo registrar el cargo"],
      },
    };
  }

  revalidatePath(`/catalogos/clientes/${data.cliente_id}`);
  revalidatePath("/catalogos/clientes");
  return { ok: true };
}

/**
 * Registra un pago de cuenta corriente: baja la deuda del cliente e ingresa la
 * plata a bancos por el medio de pago elegido. No permite pagar de más.
 */
export async function registrarPagoCc(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "encargada"]);
  requireSupabaseRuntime("La cuenta corriente requiere Supabase configurado.");

  const parsed = pagoCcSchema.safeParse({
    cliente_id: formData.get("cliente_id"),
    monto: formData.get("monto"),
    mp_id: formData.get("mp_id"),
    cuenta_id: formData.get("cuenta_id"),
    descripcion: formData.get("descripcion"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const data = parsed.data;

  const sucursal = await getActiveSucursalForUser(user);
  const db = getDb();
  const fecha = new Date();

  try {
    await db.transaction(async (tx) => {
      const [cliente] = await tx
        .select()
        .from(clientesTable)
        .where(eq(clientesTable.id, data.cliente_id))
        .limit(1);
      if (!cliente) throw new Error("Cliente no encontrado");
      if (!cliente.cuentaCorrienteHabilitada) {
        throw new Error("El cliente no tiene la cuenta corriente habilitada");
      }
      if (cliente.saldoCc <= EPS) {
        throw new Error("El cliente no tiene deuda pendiente");
      }

      const monto = data.monto;
      if (monto > cliente.saldoCc + EPS) {
        throw new Error(
          `El pago no puede superar la deuda (${cliente.saldoCc.toFixed(2)})`,
        );
      }

      await tx.insert(movimientosCcTable).values({
        id: createId(),
        clienteId: data.cliente_id,
        fecha,
        tipo: "pago",
        monto,
        sucursalId: sucursal?.id ?? null,
        mpId: data.mp_id,
        refTipo: "manual",
        refId: null,
        descripcion: data.descripcion ?? null,
        usuarioId: user.id,
      });

      await tx
        .update(clientesTable)
        .set({ saldoCc: cliente.saldoCc - monto })
        .where(eq(clientesTable.id, data.cliente_id));

      // El pago entra a bancos por la cuenta elegida en el form (override) o,
      // si no se eligió, por la cuenta por defecto del medio de pago. Si no hay
      // ninguna, el pago igual se registra (baja la deuda) pero no impacta en
      // bancos hasta asignarle una cuenta.
      const cuentaId =
        data.cuenta_id ?? (await getCuentaIdForMpTx(tx, data.mp_id));
      if (cuentaId) {
        await emitMovimientoBancarioTx(tx, {
          cuentaId,
          fecha,
          monto,
          tipo: "ingreso",
          sucursalId: sucursal?.id ?? null,
          refTipo: "cc_pago",
          refId: data.cliente_id,
          descripcion: "Pago de cuenta corriente",
          usuarioId: user.id,
        });
      }
    });
  } catch (error) {
    return {
      ok: false,
      errors: {
        _: [error instanceof Error ? error.message : "No se pudo registrar el pago"],
      },
    };
  }

  revalidatePath(`/catalogos/clientes/${data.cliente_id}`);
  revalidatePath("/catalogos/clientes");
  revalidatePath("/bancos");
  return { ok: true };
}
