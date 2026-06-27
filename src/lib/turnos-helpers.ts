import type {
  Empleado,
  HorarioSucursal,
  ProfesionalAgenda,
  ProfesionalHorario,
  ProfesionalServicio,
  Servicio,
  ServicioHorario,
  Sucursal,
  Turno,
  TurnoEstado,
} from "@/lib/types";

export interface ProfesionalReserva extends ProfesionalAgenda {
  empleado: Empleado;
}

export interface TurnoDetalle extends Turno {
  servicio: Servicio | null;
  sucursal: Sucursal | null;
  profesional: ProfesionalReserva | null;
}

export interface SlotDisponible {
  fecha: string;
  hora: string;
  profesional_id: string;
  profesional_nombre: string;
  profesional_color: string;
}

function getEffectiveEligibilityServiceId(service: Servicio) {
  if (service.es_promo) {
    return service.promo_primer_servicio_id ?? null;
  }
  return service.id;
}

export function filterProfesionalesByServicio(args: {
  sucursalId: string;
  servicioId: string;
  profesionales: ProfesionalReserva[];
  servicios: Servicio[];
  profesionalesServicios?: ProfesionalServicio[];
}) {
  const service = args.servicios.find((item) => item.id === args.servicioId);
  if (!service) return [];

  const eligibilityServiceId = getEffectiveEligibilityServiceId(service);
  if (!eligibilityServiceId) return [];

  return args.profesionales.filter((profesional) => {
    if (profesional.sucursal_id !== args.sucursalId) return false;

    const serviciosAsignados = (args.profesionalesServicios ?? []).filter(
      (item) =>
        item.empleado_id === profesional.empleado_id &&
        item.sucursal_id === args.sucursalId,
    );

    if (serviciosAsignados.length === 0) return true;

    return serviciosAsignados.some(
      (item) => item.servicio_id === eligibilityServiceId,
    );
  });
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number) {
  const hours = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (total % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function addMinutesToTime(value: string, minutes: number) {
  return minutesToTime(timeToMinutes(value) + minutes);
}

export function isBlockingTurnoStatus(status: TurnoEstado) {
  return status !== "cancelado" && status !== "ausente";
}

export function isSameDate(date: Date, isoDate: string) {
  return date.toISOString().slice(0, 10) === isoDate;
}

export function listOpenDatesForSucursal(
  horarios: HorarioSucursal[],
  sucursalId: string,
  count = 6,
  start = new Date(),
) {
  const dates: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  // Cota dura de días escaneados: si la sucursal no tiene horarios cargados
  // (o ninguno con cierre > apertura) ningún día tiene ventana y, sin este
  // límite, el while jamás alcanza `count` y cuelga el navegador.
  let scanned = 0;
  while (dates.length < count && scanned < 60) {
    const hasWindow = horarios.some(
      (item) =>
        item.sucursal_id === sucursalId &&
        item.dia_semana === cursor.getDay() &&
        timeToMinutes(item.cierre) > timeToMinutes(item.apertura),
    );
    if (hasWindow) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
    scanned += 1;
  }

  return dates;
}

function overlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) {
  return startA < endB && startB < endA;
}

interface AvailabilityWindow {
  apertura: string;
  cierre: string;
}

function intersectWindows(
  base: AvailabilityWindow[],
  overlay: AvailabilityWindow[],
) {
  const windows: AvailabilityWindow[] = [];
  for (const current of base) {
    const currentStart = timeToMinutes(current.apertura);
    const currentEnd = timeToMinutes(current.cierre);
    for (const next of overlay) {
      const start = Math.max(currentStart, timeToMinutes(next.apertura));
      const end = Math.min(currentEnd, timeToMinutes(next.cierre));
      if (end > start) {
        windows.push({ apertura: minutesToTime(start), cierre: minutesToTime(end) });
      }
    }
  }
  return windows;
}

export function buildAvailableSlots(args: {
  fecha: string;
  sucursalId: string;
  servicioId: string;
  profesionalId?: string;
  servicios: Servicio[];
  turnos: Turno[];
  horarios: HorarioSucursal[];
  profesionales: ProfesionalReserva[];
  serviciosHorarios?: ServicioHorario[];
  profesionalesHorarios?: ProfesionalHorario[];
  profesionalesServicios?: ProfesionalServicio[];
}) {
  const service = args.servicios.find((item) => item.id === args.servicioId);
  if (!service) return [];

  const day = new Date(`${args.fecha}T12:00:00`).getDay();

  const sucursalWindows = args.horarios.filter(
    (item) => item.sucursal_id === args.sucursalId && item.dia_semana === day,
  );
  if (sucursalWindows.length === 0) return [];

  // Disponibilidad por servicio: si el servicio tiene franjas cargadas,
  // las ventanas efectivas son la intersección con las de la sucursal.
  // Si no tiene ninguna, queda disponible en todo el horario de la sucursal.
  const serviceWindowsAll = (args.serviciosHorarios ?? []).filter(
    (item) => item.servicio_id === args.servicioId,
  );
  const serviceHasConfig = serviceWindowsAll.length > 0;
  const serviceDayWindows = serviceWindowsAll.filter(
    (item) => item.dia_semana === day,
  );
  if (serviceHasConfig && serviceDayWindows.length === 0) return [];

  const sucursalAvailability = sucursalWindows.map((item) => ({
    apertura: item.apertura,
    cierre: item.cierre,
  }));
  const serviceAvailability = serviceDayWindows.map((item) => ({
    apertura: item.apertura,
    cierre: item.cierre,
  }));
  const baseWindows = serviceHasConfig
    ? intersectWindows(sucursalAvailability, serviceAvailability)
    : sucursalAvailability;
  if (baseWindows.length === 0) return [];

  const profesionalesElegibles = filterProfesionalesByServicio({
    sucursalId: args.sucursalId,
    servicioId: args.servicioId,
    profesionales: args.profesionales,
    servicios: args.servicios,
    profesionalesServicios: args.profesionalesServicios,
  });
  const profesionales = args.profesionalId
    ? profesionalesElegibles.filter(
        (item) => item.empleado_id === args.profesionalId,
      )
    : profesionalesElegibles;

  const duration = service.duracion_min ?? 60;
  // La grilla de horarios arranca en la apertura y avanza de a la duración del
  // servicio: cada turno empieza justo cuando terminaría el anterior (ej. un
  // servicio de 45': 10:00, 10:45, 11:30…), igual que el sistema de referencia.
  // Como el chequeo de colisión usa fin exclusivo, un turno que termina a las
  // 11:00 deja libre el slot de las 11:00.
  const slotStep = duration;
  const MAX_SLOTS_PER_DATE = 48;

  const blocked = args.turnos.filter(
    (turno) =>
      turno.sucursal_id === args.sucursalId &&
      turno.fecha_turno === args.fecha &&
      isBlockingTurnoStatus(turno.estado),
  );

  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  );
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isToday = args.fecha === todayStr;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const slots: SlotDisponible[] = [];
  for (const prof of profesionales.sort((a, b) => a.prioridad - b.prioridad)) {
    const profWindowsAll = (args.profesionalesHorarios ?? []).filter(
      (item) =>
        item.empleado_id === prof.empleado_id &&
        item.sucursal_id === args.sucursalId,
    );
    const profHasConfig = profWindowsAll.length > 0;
    const profDayWindows = profWindowsAll
      .filter((item) => item.dia_semana === day)
      .map((item) => ({ apertura: item.apertura, cierre: item.cierre }));
    if (profHasConfig && profDayWindows.length === 0) {
      continue;
    }

    const windows = profHasConfig
      ? intersectWindows(baseWindows, profDayWindows)
      : baseWindows;
    if (windows.length === 0) continue;

    const profTurnos = blocked.filter(
      (turno) => turno.profesional_id === prof.empleado_id,
    );

    for (const window of windows) {
      let cursor = timeToMinutes(window.apertura);
      const end = timeToMinutes(window.cierre);
      while (cursor + duration <= end) {
        if (isToday && cursor <= currentMinutes) {
          cursor += slotStep;
          continue;
        }

        const slotEnd = cursor + duration;
        const hasCollision = profTurnos.some((turno) => {
          const bookedStart = timeToMinutes(turno.hora);
          const bookedEnd = bookedStart + turno.duracion_min;
          return overlaps(cursor, slotEnd, bookedStart, bookedEnd);
        });
        if (!hasCollision) {
          slots.push({
            fecha: args.fecha,
            hora: minutesToTime(cursor),
            profesional_id: prof.empleado_id,
            profesional_nombre: prof.empleado.nombre,
            profesional_color: prof.color,
          });
        }
        cursor += slotStep;
      }
    }
  }

  const deduped = args.profesionalId
    ? slots
    : slots
        .sort((a, b) => a.hora.localeCompare(b.hora) || a.profesional_nombre.localeCompare(b.profesional_nombre))
        .filter(
          (slot, index, arr) =>
            arr.findIndex(
              (candidate) =>
                candidate.hora === slot.hora &&
                candidate.profesional_id === slot.profesional_id,
            ) === index,
        );

  return deduped.slice(0, MAX_SLOTS_PER_DATE);
}

export function listReservableDates(args: {
  count?: number;
  start?: Date;
  sucursalId: string;
  servicioId: string;
  profesionalId?: string;
  horarios: HorarioSucursal[];
  profesionales: ProfesionalReserva[];
  servicios: Servicio[];
  turnos: Turno[];
  serviciosHorarios?: ServicioHorario[];
  profesionalesHorarios?: ProfesionalHorario[];
  profesionalesServicios?: ProfesionalServicio[];
}) {
  const count = args.count ?? 6;
  const dates: string[] = [];
  const cursor = new Date(args.start ?? new Date());
  cursor.setHours(0, 0, 0, 0);
  let scanned = 0;

  while (dates.length < count && scanned < 60) {
    const fecha = cursor.toISOString().slice(0, 10);
    const slots = buildAvailableSlots({
      fecha,
      sucursalId: args.sucursalId,
      servicioId: args.servicioId,
      profesionalId: args.profesionalId,
      horarios: args.horarios,
      profesionales: args.profesionales,
      servicios: args.servicios,
      turnos: args.turnos.filter(
        (turno) => turno.sucursal_id === args.sucursalId && turno.fecha_turno === fecha,
      ),
      serviciosHorarios: args.serviciosHorarios,
      profesionalesHorarios: args.profesionalesHorarios,
      profesionalesServicios: args.profesionalesServicios,
    });
    if (slots.length > 0) {
      dates.push(fecha);
    }
    cursor.setDate(cursor.getDate() + 1);
    scanned += 1;
  }

  return dates;
}

export function buildTurnoDetalle(args: {
  turno: Turno;
  servicios: Servicio[];
  sucursales: Sucursal[];
  profesionales: ProfesionalReserva[];
}): TurnoDetalle {
  return {
    ...args.turno,
    servicio:
      args.servicios.find((item) => item.id === args.turno.servicio_id) ?? null,
    sucursal:
      args.sucursales.find((item) => item.id === args.turno.sucursal_id) ?? null,
    profesional:
      args.profesionales.find(
        (item) => item.empleado_id === args.turno.profesional_id,
      ) ?? null,
  };
}
