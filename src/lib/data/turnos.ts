import { and, asc, eq, gte, lte, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client/postgres";
import {
  empleados as empleadosTable,
  horariosSucursal as horariosSucursalTable,
  profesionalesAgenda as profesionalesAgendaTable,
  servicios as serviciosTable,
  sucursales as sucursalesTable,
  turnos as turnosTable,
} from "@/lib/db/schema";
import {
  buildAccessScope,
  clampSucursalId,
  isSucursalAllowed,
} from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import {
  buildAvailableSlots,
  buildTurnoDetalle,
  listOpenDatesForSucursal,
  type ProfesionalReserva,
  type TurnoDetalle,
} from "@/lib/turnos-helpers";
import type {
  Empleado,
  HorarioSucursal,
  Servicio,
  Sucursal,
  Turno,
  TurnoEstado,
} from "@/lib/types";

export function mapSucursal(
  row: typeof sucursalesTable.$inferSelect,
): Sucursal {
  return {
    id: row.id,
    nombre: row.nombre,
    activo: row.activo,
    slug: row.slug ?? undefined,
    direccion: row.direccion ?? undefined,
    telefono: row.telefono ?? undefined,
    horario_resumen: row.horarioResumen ?? undefined,
    rating: row.rating ?? undefined,
    reviews: row.reviews ?? undefined,
    mapa_url: row.mapaUrl ?? undefined,
    descripcion_corta: row.descripcionCorta ?? undefined,
  };
}

export function mapServicio(
  row: typeof serviciosTable.$inferSelect,
): Servicio {
  return {
    id: row.id,
    rubro: row.rubro,
    nombre: row.nombre,
    precio_lista: row.precioLista,
    precio_efectivo: row.precioEfectivo,
    comision_default_pct: row.comisionDefaultPct,
    activo: row.activo,
    duracion_min: row.duracionMin ?? undefined,
    descripcion_corta: row.descripcionCorta ?? undefined,
    destacado_pct: row.destacadoPct ?? undefined,
  };
}

export function mapEmpleado(
  row: typeof empleadosTable.$inferSelect,
): Empleado {
  return {
    id: row.id,
    nombre: row.nombre,
    activo: row.activo,
    sucursal_principal_id: row.sucursalPrincipalId,
    tipo_comision: row.tipoComision,
    porcentaje_default: row.porcentajeDefault,
    sueldo_asegurado: row.sueldoAsegurado,
    observacion: row.observacion ?? undefined,
  };
}

export function mapHorario(
  row: typeof horariosSucursalTable.$inferSelect,
): HorarioSucursal {
  return {
    id: row.id,
    sucursal_id: row.sucursalId,
    dia_semana: row.diaSemana,
    apertura: row.apertura,
    cierre: row.cierre,
  };
}

export function mapTurno(
  row: typeof turnosTable.$inferSelect,
): Turno {
  return {
    id: row.id,
    sucursal_id: row.sucursalId,
    servicio_id: row.servicioId,
    profesional_id: row.profesionalId,
    cliente_nombre: row.clienteNombre,
    cliente_telefono: row.clienteTelefono,
    cliente_email: row.clienteEmail ?? undefined,
    fecha_turno: row.fechaTurno,
    hora: row.hora,
    duracion_min: row.duracionMin,
    estado: row.estado,
    canal: row.canal,
    observacion: row.observacion ?? undefined,
    creado_en: row.creadoEn.toISOString(),
    creado_por_usuario_id: row.creadoPorUsuarioId ?? undefined,
    actualizado_en: row.actualizadoEn?.toISOString(),
    actualizado_por_usuario_id: row.actualizadoPorUsuarioId ?? undefined,
    origen: row.origen,
    sin_preferencia: row.sinPreferencia,
  };
}

async function getSucursalesActivas(scopeIds?: string[]) {
  const db = getDb();
  const filters = [eq(sucursalesTable.activo, true)];
  if (scopeIds?.length) {
    filters.push(inArray(sucursalesTable.id, scopeIds));
  }
  const rows = await db
    .select()
    .from(sucursalesTable)
    .where(and(...filters))
    .orderBy(asc(sucursalesTable.nombre));
  return rows.map(mapSucursal);
}

async function getServiciosActivos() {
  const db = getDb();
  const rows = await db
    .select()
    .from(serviciosTable)
    .where(eq(serviciosTable.activo, true))
    .orderBy(asc(serviciosTable.rubro), asc(serviciosTable.nombre));
  return rows.map(mapServicio);
}

export async function getHorarios(sucursalId?: string) {
  const db = getDb();
  const rows = sucursalId
    ? await db
        .select()
        .from(horariosSucursalTable)
        .where(eq(horariosSucursalTable.sucursalId, sucursalId))
    : await db.select().from(horariosSucursalTable);
  return rows.map(mapHorario);
}

export async function getProfesionalesReserva(args?: {
  sucursalIds?: string[];
  soloSucursalId?: string;
  includeInactivePublic?: boolean;
}) {
  const db = getDb();
  const filters = [];

  if (!args?.includeInactivePublic) {
    filters.push(eq(profesionalesAgendaTable.activoPublico, true));
    filters.push(eq(empleadosTable.activo, true));
  }
  if (args?.soloSucursalId) {
    filters.push(eq(profesionalesAgendaTable.sucursalId, args.soloSucursalId));
  } else if (args?.sucursalIds?.length) {
    filters.push(inArray(profesionalesAgendaTable.sucursalId, args.sucursalIds));
  }

  const rows = await db
    .select({
      meta: profesionalesAgendaTable,
      empleado: empleadosTable,
    })
    .from(profesionalesAgendaTable)
    .innerJoin(
      empleadosTable,
      eq(profesionalesAgendaTable.empleadoId, empleadosTable.id),
    )
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(
      asc(profesionalesAgendaTable.prioridad),
      asc(empleadosTable.nombre),
    );

  return rows.map(
    (row): ProfesionalReserva => ({
      id: row.meta.id,
      empleado_id: row.meta.empleadoId,
      sucursal_id: row.meta.sucursalId,
      especialidad: row.meta.especialidad,
      avatar_url: row.meta.avatarUrl,
      color: row.meta.color,
      bio: row.meta.bio ?? undefined,
      prioridad: row.meta.prioridad,
      activo_publico: row.meta.activoPublico,
      empleado: mapEmpleado(row.empleado),
    }),
  );
}

export async function getTurnosRaw(args?: {
  fecha?: string;
  sucursalIds?: string[];
  sucursalId?: string;
  profesionalId?: string;
  estado?: TurnoEstado | string;
  desdeFechaTurno?: string;
  hastaFechaTurno?: string;
}) {
  const db = getDb();
  const filters = [];

  if (args?.sucursalIds?.length) {
    filters.push(inArray(turnosTable.sucursalId, args.sucursalIds));
  }
  if (args?.sucursalId) {
    filters.push(eq(turnosTable.sucursalId, args.sucursalId));
  }
  if (args?.fecha) {
    filters.push(eq(turnosTable.fechaTurno, args.fecha));
  }
  if (args?.profesionalId) {
    filters.push(eq(turnosTable.profesionalId, args.profesionalId));
  }
  if (args?.estado) {
    filters.push(eq(turnosTable.estado, args.estado as TurnoEstado));
  }
  if (args?.desdeFechaTurno) {
    filters.push(gte(turnosTable.fechaTurno, args.desdeFechaTurno));
  }
  if (args?.hastaFechaTurno) {
    filters.push(lte(turnosTable.fechaTurno, args.hastaFechaTurno));
  }

  const rows = await db
    .select()
    .from(turnosTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(turnosTable.fechaTurno), asc(turnosTable.hora));

  return rows.map(mapTurno);
}

async function getTurnoContextForScope(scopeIds?: string[]) {
  const [sucursales, servicios, horarios, profesionales] = await Promise.all([
    getSucursalesActivas(scopeIds),
    getServiciosActivos(),
    getHorarios(),
    getProfesionalesReserva({ sucursalIds: scopeIds }),
  ]);

  return { sucursales, servicios, horarios, profesionales };
}

export async function getTurnoCatalogRefs(args: {
  servicioId: string;
  profesionalId: string;
  sucursalId: string;
}) {
  const db = getDb();
  const [servicioRow] = await db
    .select()
    .from(serviciosTable)
    .where(
      and(
        eq(serviciosTable.id, args.servicioId),
        eq(serviciosTable.activo, true),
      ),
    )
    .limit(1);

  const [profRow] = await db
    .select({
      meta: profesionalesAgendaTable,
      empleado: empleadosTable,
    })
    .from(profesionalesAgendaTable)
    .innerJoin(
      empleadosTable,
      eq(profesionalesAgendaTable.empleadoId, empleadosTable.id),
    )
    .where(
      and(
        eq(profesionalesAgendaTable.empleadoId, args.profesionalId),
        eq(profesionalesAgendaTable.sucursalId, args.sucursalId),
        eq(profesionalesAgendaTable.activoPublico, true),
        eq(empleadosTable.activo, true),
      ),
    )
    .limit(1);

  return {
    servicio: servicioRow ? mapServicio(servicioRow) : null,
    profesional: profRow
      ? ({
          id: profRow.meta.id,
          empleado_id: profRow.meta.empleadoId,
          sucursal_id: profRow.meta.sucursalId,
          especialidad: profRow.meta.especialidad,
          avatar_url: profRow.meta.avatarUrl,
          color: profRow.meta.color,
          bio: profRow.meta.bio ?? undefined,
          prioridad: profRow.meta.prioridad,
          activo_publico: profRow.meta.activoPublico,
          empleado: mapEmpleado(profRow.empleado),
        } satisfies ProfesionalReserva)
      : null,
  };
}

async function buildAgendaTurnos(args: {
  scopeSucursalIds: string[];
  fecha?: string;
  sucursalId?: string;
  profesionalId?: string;
  estado?: string;
  employeeScopeId?: string;
}) {
  const effectiveProfesionalId = args.employeeScopeId ?? args.profesionalId;
  const { sucursales, servicios, profesionales } = await getTurnoContextForScope(
    args.scopeSucursalIds,
  );

  const turnos = await getTurnosRaw({
    fecha: args.fecha,
    sucursalIds: args.scopeSucursalIds,
    sucursalId: args.sucursalId,
    profesionalId: effectiveProfesionalId,
    estado: args.estado,
  });

  const filtered =
    args.employeeScopeId
      ? turnos.filter((item) => item.profesional_id === args.employeeScopeId)
      : turnos;

  return filtered
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .map((turno) =>
      buildTurnoDetalle({
        turno,
        servicios,
        sucursales,
        profesionales,
      }),
    );
}

export async function getReservaPublicaSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  const [sucursales, servicios, horarios, profesionales, turnos] =
    await Promise.all([
      getSucursalesActivas(),
      getServiciosActivos(),
      getHorarios(),
      getProfesionalesReserva(),
      getTurnosRaw({ desdeFechaTurno: today }),
    ]);

  return {
    sucursales,
    servicios,
    horarios,
    profesionales,
    turnos,
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

  if (opts?.sucursalId && !isSucursalAllowed(scope, opts.sucursalId)) {
    return [];
  }

  return buildAgendaTurnos({
    scopeSucursalIds: scope.sucursalIdsPermitidas,
    fecha: opts?.fecha,
    sucursalId: opts?.sucursalId,
    profesionalId: opts?.profesionalId,
    estado: opts?.estado,
    employeeScopeId: scope.rol === "empleado" ? scope.empleadoId : undefined,
  });
}

export async function getTurno(turnoId: string) {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const db = getDb();
  const row = await db
    .select()
    .from(turnosTable)
    .where(eq(turnosTable.id, turnoId))
    .limit(1);

  const current = row[0];
  if (!current) return null;

  const turno = mapTurno(current);
  if (!scope.sucursalIdsPermitidas.includes(turno.sucursal_id)) return null;
  if (scope.rol === "empleado" && scope.empleadoId !== turno.profesional_id) {
    return null;
  }

  const { sucursales, servicios, profesionales } = await getTurnoContextForScope(
    scope.sucursalIdsPermitidas,
  );

  return buildTurnoDetalle({
    turno,
    servicios,
    sucursales,
    profesionales,
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
  const sucursales = await getSucursalesActivas(scope.sucursalIdsPermitidas);
  const sucursalId =
    clampSucursalId(scope, args?.sucursalId) ?? sucursales[0]?.id ?? "";
  const fecha = args?.fecha ?? new Date().toISOString().slice(0, 10);
  const [turnos, profesionales] = await Promise.all([
    buildAgendaTurnos({
      scopeSucursalIds: scope.sucursalIdsPermitidas,
      fecha,
      sucursalId,
      profesionalId: args?.profesionalId,
      estado: args?.estado,
      employeeScopeId: scope.rol === "empleado" ? scope.empleadoId : undefined,
    }),
    getProfesionalesReserva({
      soloSucursalId: sucursalId,
    }),
  ]);

  const profesionalesDeSucursal = profesionales.filter(
    (item) =>
      scope.rol !== "empleado" || item.empleado_id === scope.empleadoId,
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
    sucursales,
  };
}

export async function getTurnosAgendaRangeData(args: {
  fechaDesde: string;
  fechaHasta: string;
  sucursalId?: string;
  profesionalId?: string;
  estado?: string;
}) {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const sucursales = await getSucursalesActivas(scope.sucursalIdsPermitidas);
  const sucursalId =
    clampSucursalId(scope, args.sucursalId) ?? sucursales[0]?.id ?? "";

  const effectiveProfesionalId =
    scope.rol === "empleado" ? scope.empleadoId : args.profesionalId;

  const { servicios, profesionales: allProfs } = await getTurnoContextForScope(
    scope.sucursalIdsPermitidas,
  );

  const rawTurnos = await getTurnosRaw({
    desdeFechaTurno: args.fechaDesde,
    hastaFechaTurno: args.fechaHasta,
    sucursalIds: scope.sucursalIdsPermitidas,
    sucursalId,
    profesionalId: effectiveProfesionalId,
    estado: args.estado,
  });

  const filtered =
    scope.rol === "empleado" && scope.empleadoId
      ? rawTurnos.filter((t) => t.profesional_id === scope.empleadoId)
      : rawTurnos;

  const detallados = filtered
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .map((turno) =>
      buildTurnoDetalle({ turno, servicios, sucursales, profesionales: allProfs }),
    );

  const turnosPorFecha: Record<string, typeof detallados> = {};
  for (const t of detallados) {
    (turnosPorFecha[t.fecha_turno] ??= []).push(t);
  }

  const profesionalesDeSucursal = allProfs
    .filter((p) => p.sucursal_id === sucursalId)
    .filter((p) => scope.rol !== "empleado" || p.empleado_id === scope.empleadoId);

  const horarios = await getHorarios(sucursalId);

  return {
    turnosPorFecha,
    profesionales: profesionalesDeSucursal,
    sucursales,
    sucursalId,
    horarios: horarios.map(mapHorario),
  };
}

export async function getSlotsDisponibles(args: {
  fecha: string;
  sucursalId: string;
  servicioId: string;
  profesionalId?: string;
}) {
  const [horarios, profesionales, servicios, turnos] = await Promise.all([
    getHorarios(args.sucursalId),
    getProfesionalesReserva({
      soloSucursalId: args.sucursalId,
    }),
    getServiciosActivos(),
    getTurnosRaw({
      fecha: args.fecha,
      sucursalId: args.sucursalId,
    }),
  ]);

  return buildAvailableSlots({
    fecha: args.fecha,
    sucursalId: args.sucursalId,
    servicioId: args.servicioId,
    profesionalId: args.profesionalId,
    horarios,
    profesionales,
    servicios,
    turnos,
  });
}

export async function getFechasDisponibles(sucursalId: string) {
  const horarios = await getHorarios(sucursalId);
  return listOpenDatesForSucursal(horarios, sucursalId);
}

export type TurnoActionState =
  | { ok: true; turnoId: string; message: string }
  | { ok: false; errors: Record<string, string[]> };

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
