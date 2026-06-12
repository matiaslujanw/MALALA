"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import {
  clientes as clientesTable,
  empleados as empleadosTable,
  horariosSucursal as horariosSucursalTable,
  profesionalesAgenda as profesionalesAgendaTable,
  servicios as serviciosTable,
  sucursales as sucursalesTable,
  turnoEventos as turnoEventosTable,
  turnos as turnosTable,
} from "@/lib/db/schema";
import { buildAvailableSlots, buildTurnoDetalle, type ProfesionalReserva, type TurnoDetalle } from "@/lib/turnos-helpers";
import { listServiciosHorariosAll } from "@/lib/data/servicios-horarios";
import { turnoReprogramacionSchema } from "@/lib/validations/turno";
import { notificarTurno } from "@/lib/integraciones/notificaciones-turno";
import { fieldErrors } from "./_helpers";
import { mapCliente, mapEmpleado, mapHorario, mapServicio, mapSucursal, mapTurno } from "./turnos";
import type { TurnoEstado } from "@/lib/types";

export type TurnoTokenResult =
  | {
      status: "ok";
      detalle: TurnoDetalle;
      bloqueado: false;
    }
  | {
      status: "ok_bloqueado";
      detalle: TurnoDetalle;
      bloqueado: true;
      motivo: "estado_terminal" | "expirado";
    }
  | { status: "no_encontrado" };

const estadosNoModificables: TurnoEstado[] = [
  "completado",
  "cancelado",
  "ausente",
  "en_curso",
];

export async function getTurnoPorToken(token: string): Promise<TurnoTokenResult> {
  if (!token || token.length < 8) return { status: "no_encontrado" };

  const db = getDb();
  const [row] = await db
    .select({
      turno: turnosTable,
      cliente: clientesTable,
      servicio: serviciosTable,
      sucursal: sucursalesTable,
    })
    .from(turnosTable)
    .innerJoin(clientesTable, eq(turnosTable.clienteId, clientesTable.id))
    .innerJoin(serviciosTable, eq(turnosTable.servicioId, serviciosTable.id))
    .innerJoin(sucursalesTable, eq(turnosTable.sucursalId, sucursalesTable.id))
    .where(eq(turnosTable.tokenAcceso, token))
    .limit(1);

  if (!row) return { status: "no_encontrado" };

  const profRows = await db
    .select({ meta: profesionalesAgendaTable, empleado: empleadosTable })
    .from(profesionalesAgendaTable)
    .innerJoin(empleadosTable, eq(profesionalesAgendaTable.empleadoId, empleadosTable.id))
    .where(
      and(
        eq(profesionalesAgendaTable.sucursalId, row.turno.sucursalId),
        eq(profesionalesAgendaTable.activoPublico, true),
        eq(empleadosTable.activo, true),
      ),
    );

  const profesionales: ProfesionalReserva[] = profRows.map((p) => ({
    id: p.meta.id,
    empleado_id: p.meta.empleadoId,
    sucursal_id: p.meta.sucursalId,
    especialidad: p.meta.especialidad,
    avatar_url: p.meta.avatarUrl,
    color: p.meta.color,
    bio: p.meta.bio ?? undefined,
    prioridad: p.meta.prioridad,
    activo_publico: p.meta.activoPublico,
    empleado: mapEmpleado(p.empleado),
  }));

  const turno = mapTurno(row.turno, row.cliente);
  const detalle = buildTurnoDetalle({
    turno,
    servicios: [mapServicio(row.servicio)],
    sucursales: [mapSucursal(row.sucursal)],
    profesionales,
  });

  const expirado = row.turno.tokenExpiraEn.getTime() <= Date.now();
  if (expirado) {
    return { status: "ok_bloqueado", detalle, bloqueado: true, motivo: "expirado" };
  }
  if (estadosNoModificables.includes(turno.estado)) {
    return {
      status: "ok_bloqueado",
      detalle,
      bloqueado: true,
      motivo: "estado_terminal",
    };
  }

  return { status: "ok", detalle, bloqueado: false };
}

export interface TurnoPublicSlotsArgs {
  token: string;
  fecha: string;
}

export async function getSlotsDisponiblesPorToken(args: TurnoPublicSlotsArgs) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(turnosTable)
    .where(eq(turnosTable.tokenAcceso, args.token))
    .limit(1);

  if (!row) return [];
  if (row.tokenExpiraEn.getTime() <= Date.now()) return [];

  const [horarios, profRows, servRows, turnosRows] = await Promise.all([
    db.select().from(horariosSucursalTable).where(eq(horariosSucursalTable.sucursalId, row.sucursalId)),
    db
      .select({ meta: profesionalesAgendaTable, empleado: empleadosTable })
      .from(profesionalesAgendaTable)
      .innerJoin(empleadosTable, eq(profesionalesAgendaTable.empleadoId, empleadosTable.id))
      .where(
        and(
          eq(profesionalesAgendaTable.sucursalId, row.sucursalId),
          eq(profesionalesAgendaTable.activoPublico, true),
          eq(empleadosTable.activo, true),
        ),
      )
      .orderBy(asc(profesionalesAgendaTable.prioridad), asc(empleadosTable.nombre)),
    db.select().from(serviciosTable).where(eq(serviciosTable.activo, true)),
    db
      .select({ turno: turnosTable, cliente: clientesTable })
      .from(turnosTable)
      .innerJoin(clientesTable, eq(turnosTable.clienteId, clientesTable.id))
      .where(
        and(
          eq(turnosTable.sucursalId, row.sucursalId),
          eq(turnosTable.fechaTurno, args.fecha),
        ),
      ),
  ]);

  return buildAvailableSlots({
    fecha: args.fecha,
    sucursalId: row.sucursalId,
    servicioId: row.servicioId,
    horarios: horarios.map(mapHorario),
    profesionales: profRows.map(
      (p): ProfesionalReserva => ({
        id: p.meta.id,
        empleado_id: p.meta.empleadoId,
        sucursal_id: p.meta.sucursalId,
        especialidad: p.meta.especialidad,
        avatar_url: p.meta.avatarUrl,
        color: p.meta.color,
        bio: p.meta.bio ?? undefined,
        prioridad: p.meta.prioridad,
        activo_publico: p.meta.activoPublico,
        empleado: mapEmpleado(p.empleado),
      }),
    ),
    servicios: servRows.map(mapServicio),
    turnos: turnosRows
      .filter((t) => t.turno.id !== row.id)
      .map((t) => mapTurno(t.turno, t.cliente)),
    serviciosHorarios: await listServiciosHorariosAll(),
  });
}

export type PublicActionResult =
  | { ok: true; message: string }
  | { ok: false; errors: Record<string, string[]> };

function publicFailure(message: string): PublicActionResult {
  return { ok: false, errors: { _: [message] } };
}

async function loadActiveTurnoByToken(token: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(turnosTable)
    .where(eq(turnosTable.tokenAcceso, token))
    .limit(1);

  if (!row) return { error: "Link inválido" as const, row: null };
  if (row.tokenExpiraEn.getTime() <= Date.now()) {
    return { error: "El link ya expiró" as const, row: null };
  }
  if (estadosNoModificables.includes(row.estado)) {
    return { error: "Este turno ya no se puede modificar" as const, row: null };
  }
  return { error: null, row };
}

export async function cancelarTurnoPorTokenAction(
  _prev: PublicActionResult | null,
  formData: FormData,
): Promise<PublicActionResult> {
  const token = String(formData.get("token") ?? "");
  const { error, row } = await loadActiveTurnoByToken(token);
  if (error || !row) return publicFailure(error ?? "Link inválido");

  const db = getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(turnosTable)
      .set({ estado: "cancelado", actualizadoEn: now })
      .where(eq(turnosTable.id, row.id));
    await tx.insert(turnoEventosTable).values({
      id: crypto.randomUUID(),
      turnoId: row.id,
      tipo: "cancelado",
      fecha: now,
      detalle: "Cancelado por el cliente desde magic link",
    });
  });

  await notificarTurno({ turnoId: row.id, tipo: "cancelacion" });

  revalidatePath(`/turno/${token}`);
  revalidatePath("/turnos");

  return { ok: true, message: "Tu turno fue cancelado." };
}

export async function reprogramarTurnoPorTokenAction(
  _prev: PublicActionResult | null,
  formData: FormData,
): Promise<PublicActionResult> {
  const token = String(formData.get("token") ?? "");
  const { error, row } = await loadActiveTurnoByToken(token);
  if (error || !row) return publicFailure(error ?? "Link inválido");

  const parsed = turnoReprogramacionSchema.safeParse({
    turno_id: row.id,
    fecha_turno: formData.get("fecha_turno"),
    hora: formData.get("hora"),
    profesional_id: formData.get("profesional_id"),
  });
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${row.sucursalId}), hashtext(${parsed.data.fecha_turno}))`,
      );

      const [horarios, profRows, servRows, blocked] = await Promise.all([
        tx
          .select()
          .from(horariosSucursalTable)
          .where(eq(horariosSucursalTable.sucursalId, row.sucursalId)),
        tx
          .select({ meta: profesionalesAgendaTable, empleado: empleadosTable })
          .from(profesionalesAgendaTable)
          .innerJoin(empleadosTable, eq(profesionalesAgendaTable.empleadoId, empleadosTable.id))
          .where(
            and(
              eq(profesionalesAgendaTable.sucursalId, row.sucursalId),
              eq(profesionalesAgendaTable.activoPublico, true),
              eq(empleadosTable.activo, true),
            ),
          ),
        tx.select().from(serviciosTable).where(eq(serviciosTable.activo, true)),
        tx
          .select({ turno: turnosTable, cliente: clientesTable })
          .from(turnosTable)
          .innerJoin(clientesTable, eq(turnosTable.clienteId, clientesTable.id))
          .where(
            and(
              eq(turnosTable.sucursalId, row.sucursalId),
              eq(turnosTable.fechaTurno, parsed.data.fecha_turno),
            ),
          ),
      ]);

      const slots = buildAvailableSlots({
        fecha: parsed.data.fecha_turno,
        sucursalId: row.sucursalId,
        servicioId: row.servicioId,
        profesionalId: parsed.data.profesional_id,
        horarios: horarios.map(mapHorario),
        profesionales: profRows.map(
          (p): ProfesionalReserva => ({
            id: p.meta.id,
            empleado_id: p.meta.empleadoId,
            sucursal_id: p.meta.sucursalId,
            especialidad: p.meta.especialidad,
            avatar_url: p.meta.avatarUrl,
            color: p.meta.color,
            bio: p.meta.bio ?? undefined,
            prioridad: p.meta.prioridad,
            activo_publico: p.meta.activoPublico,
            empleado: mapEmpleado(p.empleado),
          }),
        ),
        servicios: servRows.map(mapServicio),
        turnos: blocked
          .filter((t) => t.turno.id !== row.id)
          .map((t) => mapTurno(t.turno, t.cliente)),
        serviciosHorarios: await listServiciosHorariosAll(),
      });

      if (!slots.some((s) => s.hora === parsed.data.hora)) {
        throw new Error("Ese horario ya no está disponible");
      }

      const now = new Date();
      const nuevoExpira = new Date(
        `${parsed.data.fecha_turno}T${parsed.data.hora}:00-03:00`,
      );

      await tx
        .update(turnosTable)
        .set({
          fechaTurno: parsed.data.fecha_turno,
          hora: parsed.data.hora,
          profesionalId: parsed.data.profesional_id,
          estado: "confirmado",
          actualizadoEn: now,
          tokenExpiraEn: nuevoExpira,
          recordatorio2hEnviadoEn: null,
        })
        .where(eq(turnosTable.id, row.id));

      await tx.insert(turnoEventosTable).values({
        id: crypto.randomUUID(),
        turnoId: row.id,
        tipo: "reprogramado",
        fecha: now,
        detalle: `Reprogramado por el cliente a ${parsed.data.fecha_turno} ${parsed.data.hora}`,
      });
    });
  } catch (err) {
    return publicFailure(err instanceof Error ? err.message : "No se pudo reprogramar");
  }

  await notificarTurno({ turnoId: row.id, tipo: "reprogramacion" });

  revalidatePath(`/turno/${token}`);
  revalidatePath("/turnos");

  return { ok: true, message: "Listo, tu turno fue reprogramado." };
}
