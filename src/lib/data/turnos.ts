"use server";

import { revalidatePath } from "next/cache";
import { store, id } from "@/lib/mock/store";
import { fieldErrors, requireRole } from "./_helpers";
import { buildAccessScope, clampSucursalId, isSucursalAllowed } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import {
  buildAvailableSlots,
  buildTurnoDetalle,
  listOpenDatesForSucursal,
  type ProfesionalReserva,
  type TurnoDetalle,
} from "@/lib/turnos-helpers";
import {
  turnoCreateSchema,
  turnoEstadoSchema,
  turnoReprogramacionSchema,
} from "@/lib/validations/turno";

function getProfesionalesReserva(): ProfesionalReserva[] {
  return store.profesionalesAgenda
    .map((meta) => {
      const empleado = store.empleados.find((item) => item.id === meta.empleado_id);
      if (!empleado || !empleado.activo || !meta.activo_publico) return null;
      return { ...meta, empleado };
    })
    .filter((item): item is ProfesionalReserva => Boolean(item))
    .sort((a, b) => a.prioridad - b.prioridad || a.empleado.nombre.localeCompare(b.empleado.nombre));
}

export async function getReservaPublicaSnapshot() {
  const profesionales = getProfesionalesReserva();
  return {
    sucursales: store.sucursales.filter((item) => item.activo),
    servicios: store.servicios.filter((item) => item.activo),
    horarios: store.horariosSucursal,
    profesionales,
    turnos: store.turnos,
  };
}

export async function listTurnos(opts?: {
  fecha?: string;
  sucursalId?: string;
  profesionalId?: string;
  estado?: string;
}) {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const profesionales = getProfesionalesReserva();
  let rows = [...store.turnos];
  rows = rows.filter((item) => scope.sucursalIdsPermitidas.includes(item.sucursal_id));

  if (opts?.fecha) {
    rows = rows.filter((item) => item.fecha_turno === opts.fecha);
  }
  if (opts?.sucursalId) {
    if (!isSucursalAllowed(scope, opts.sucursalId)) return [];
    rows = rows.filter((item) => item.sucursal_id === opts.sucursalId);
  }
  if (opts?.profesionalId) {
    rows = rows.filter((item) => item.profesional_id === opts.profesionalId);
  }
  if (opts?.estado) {
    rows = rows.filter((item) => item.estado === opts.estado);
  }
  if (scope.rol === "empleado" && scope.empleadoId) {
    rows = rows.filter((item) => item.profesional_id === scope.empleadoId);
  }

  return rows
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .map((turno) =>
      buildTurnoDetalle({
        turno,
        servicios: store.servicios,
        sucursales: store.sucursales,
        profesionales,
      }),
    );
}

export async function getTurno(turnoId: string) {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const turno = store.turnos.find((item) => item.id === turnoId);
  if (!turno) return null;
  if (!scope.sucursalIdsPermitidas.includes(turno.sucursal_id)) return null;
  if (scope.rol === "empleado" && scope.empleadoId !== turno.profesional_id) {
    return null;
  }
  return buildTurnoDetalle({
    turno,
    servicios: store.servicios,
    sucursales: store.sucursales,
    profesionales: getProfesionalesReserva(),
  });
}

export async function getTurnosAgendaData(args?: {
  fecha?: string;
  sucursalId?: string;
  profesionalId?: string;
  estado?: string;
}) {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const profesionales = getProfesionalesReserva();
  const sucursalId = clampSucursalId(scope, args?.sucursalId) ?? store.sucursales[0]?.id;
  const fecha = args?.fecha ?? new Date().toISOString().slice(0, 10);
  const turnos = await listTurnos({
    fecha,
    sucursalId,
    profesionalId:
      scope.rol === "empleado" ? scope.empleadoId : args?.profesionalId,
    estado: args?.estado,
  });

  const profesionalesDeSucursal = profesionales.filter(
    (item) =>
      item.sucursal_id === sucursalId &&
      (scope.rol !== "empleado" || item.empleado_id === scope.empleadoId),
  );
  const resumen = {
    total: turnos.length,
    pendientes: turnos.filter((item) => item.estado === "pendiente").length,
    confirmados: turnos.filter((item) => item.estado === "confirmado").length,
    enCurso: turnos.filter((item) => item.estado === "en_curso").length,
    completados: turnos.filter((item) => item.estado === "completado").length,
  };

  return {
    fecha,
    sucursalId,
    turnos,
    resumen,
    profesionales: profesionalesDeSucursal,
    sucursales: store.sucursales.filter(
      (item) => item.activo && scope.sucursalIdsPermitidas.includes(item.id),
    ),
  };
}

export async function getSlotsDisponibles(args: {
  fecha: string;
  sucursalId: string;
  servicioId: string;
  profesionalId?: string;
}) {
  return buildAvailableSlots({
    fecha: args.fecha,
    sucursalId: args.sucursalId,
    servicioId: args.servicioId,
    profesionalId: args.profesionalId,
    horarios: store.horariosSucursal,
    profesionales: getProfesionalesReserva(),
    servicios: store.servicios,
    turnos: store.turnos,
  });
}

export async function getFechasDisponibles(sucursalId: string) {
  return listOpenDatesForSucursal(store.horariosSucursal, sucursalId);
}

type TurnoActionState =
  | { ok: true; turnoId: string; message: string }
  | { ok: false; errors: Record<string, string[]> };

function buildCreatePayload(formData: FormData) {
  return {
    sucursal_id: formData.get("sucursal_id"),
    servicio_id: formData.get("servicio_id"),
    profesional_id: formData.get("profesional_id"),
    fecha_turno: formData.get("fecha_turno"),
    hora: formData.get("hora"),
    cliente_nombre: formData.get("cliente_nombre"),
    cliente_telefono: formData.get("cliente_telefono"),
    cliente_email: formData.get("cliente_email"),
    observacion: formData.get("observacion"),
    sin_preferencia:
      formData.get("sin_preferencia") === "true" ||
      formData.get("sin_preferencia") === "on",
    canal: formData.get("canal") ?? "web",
    origen: formData.get("origen") ?? "publico",
  };
}

async function createTurnoInternal(
  formData: FormData,
  access: "publico" | "interno",
): Promise<TurnoActionState> {
  const parsed = turnoCreateSchema.safeParse(buildCreatePayload(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const actor =
    access === "interno"
      ? await requireUser()
      : null;
  const actorScope = actor ? buildAccessScope(actor) : null;

  if (access === "interno") {
    await requireRole(["admin", "encargada"]);
  }

  const servicio = store.servicios.find((item) => item.id === parsed.data.servicio_id);
  const profesional = getProfesionalesReserva().find(
    (item) =>
      item.empleado_id === parsed.data.profesional_id &&
      item.sucursal_id === parsed.data.sucursal_id,
  );
  if (!servicio || !profesional) {
    return { ok: false, errors: { _: ["No se pudo validar el turno seleccionado"] } };
  }
  if (actorScope && !actorScope.sucursalIdsPermitidas.includes(parsed.data.sucursal_id)) {
    return { ok: false, errors: { _: ["No tienes acceso a esa sucursal"] } };
  }

  const slots = await getSlotsDisponibles({
    fecha: parsed.data.fecha_turno,
    sucursalId: parsed.data.sucursal_id,
    servicioId: parsed.data.servicio_id,
    profesionalId: parsed.data.profesional_id,
  });
  const exists = slots.some((slot) => slot.hora === parsed.data.hora);
  if (!exists) {
    return { ok: false, errors: { hora: ["Ese horario ya no esta disponible"] } };
  }

  const turnoId = id();
  store.turnos.push({
    id: turnoId,
    sucursal_id: parsed.data.sucursal_id,
    servicio_id: parsed.data.servicio_id,
    profesional_id: parsed.data.profesional_id,
    cliente_nombre: parsed.data.cliente_nombre,
    cliente_telefono: parsed.data.cliente_telefono,
    cliente_email: parsed.data.cliente_email,
    fecha_turno: parsed.data.fecha_turno,
    hora: parsed.data.hora,
    duracion_min: servicio.duracion_min ?? 60,
    estado: access === "publico" ? "pendiente" : "confirmado",
    canal: parsed.data.canal,
    observacion: parsed.data.observacion,
    creado_en: new Date().toISOString(),
    creado_por_usuario_id: actor?.id,
    origen: parsed.data.origen,
    sin_preferencia: parsed.data.sin_preferencia,
  });
  store.turnoEventos.push({
    id: id(),
    turno_id: turnoId,
    tipo: "creado",
    actor_usuario_id: actor?.id,
    fecha: new Date().toISOString(),
    detalle:
      access === "publico" ? "Reserva creada desde landing" : "Turno creado desde agenda",
  });

  revalidatePath("/");
  revalidatePath("/turnos");

  return {
    ok: true,
    turnoId,
    message:
      access === "publico"
        ? "Tu turno fue reservado. Te esperamos en MALALA."
        : "Turno creado en agenda.",
  };
}

export async function createPublicTurnoAction(
  _prevState: TurnoActionState | null,
  formData: FormData,
) {
  return createTurnoInternal(formData, "publico");
}

export async function createAdminTurnoAction(formData: FormData) {
  return createTurnoInternal(formData, "interno");
}

export async function submitAdminTurnoAction(formData: FormData): Promise<void> {
  await createAdminTurnoAction(formData);
}

export async function updateTurnoEstadoAction(formData: FormData) {
  await requireRole(["admin", "encargada"]);
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const parsed = turnoEstadoSchema.safeParse({
    turno_id: formData.get("turno_id"),
    estado: formData.get("estado"),
  });
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const turno = store.turnos.find((item) => item.id === parsed.data.turno_id);
  if (!turno) return { ok: false, errors: { _: ["Turno no encontrado"] } };
  if (!scope.sucursalIdsPermitidas.includes(turno.sucursal_id)) {
    return { ok: false, errors: { _: ["No tienes acceso a ese turno"] } };
  }

  turno.estado = parsed.data.estado;
  turno.actualizado_en = new Date().toISOString();
  turno.actualizado_por_usuario_id = user.id;
  store.turnoEventos.push({
    id: id(),
    turno_id: turno.id,
    tipo: parsed.data.estado,
    actor_usuario_id: user.id,
    fecha: turno.actualizado_en,
    detalle: `Estado cambiado a ${parsed.data.estado}`,
  });
  revalidatePath("/turnos");
  revalidatePath("/");
  return { ok: true };
}

export async function submitUpdateTurnoEstadoAction(
  formData: FormData,
): Promise<void> {
  await updateTurnoEstadoAction(formData);
}

export async function reprogramTurnoAction(formData: FormData) {
  await requireRole(["admin", "encargada"]);
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const parsed = turnoReprogramacionSchema.safeParse({
    turno_id: formData.get("turno_id"),
    fecha_turno: formData.get("fecha_turno"),
    hora: formData.get("hora"),
    profesional_id: formData.get("profesional_id"),
  });
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const turno = store.turnos.find((item) => item.id === parsed.data.turno_id);
  if (!turno) return { ok: false, errors: { _: ["Turno no encontrado"] } };
  if (!scope.sucursalIdsPermitidas.includes(turno.sucursal_id)) {
    return { ok: false, errors: { _: ["No tienes acceso a ese turno"] } };
  }

  const slots = await getSlotsDisponibles({
    fecha: parsed.data.fecha_turno,
    sucursalId: turno.sucursal_id,
    servicioId: turno.servicio_id,
    profesionalId: parsed.data.profesional_id,
  });
  const available = slots.some((slot) => slot.hora === parsed.data.hora);
  if (!available) {
    return { ok: false, errors: { hora: ["Horario no disponible para reprogramar"] } };
  }

  turno.fecha_turno = parsed.data.fecha_turno;
  turno.hora = parsed.data.hora;
  turno.profesional_id = parsed.data.profesional_id;
  turno.estado = "confirmado";
  turno.actualizado_en = new Date().toISOString();
  turno.actualizado_por_usuario_id = user.id;
  store.turnoEventos.push({
    id: id(),
    turno_id: turno.id,
    tipo: "reprogramado",
    actor_usuario_id: user.id,
    fecha: turno.actualizado_en,
    detalle: `Reprogramado a ${parsed.data.fecha_turno} ${parsed.data.hora}`,
  });

  revalidatePath("/turnos");
  revalidatePath("/");
  return { ok: true };
}

export async function submitReprogramTurnoAction(
  formData: FormData,
): Promise<void> {
  await reprogramTurnoAction(formData);
}

export async function listTurnosByDayAndProfesional(
  fecha: string,
  sucursalId: string,
) {
  const rows = (await listTurnos({ fecha, sucursalId })).reduce<
    Record<string, TurnoDetalle[]>
  >((acc, turno) => {
    (acc[turno.profesional_id] ??= []).push(turno);
    return acc;
  }, {});
  return rows;
}
