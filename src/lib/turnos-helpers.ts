import type {
  Empleado,
  HorarioSucursal,
  ProfesionalAgenda,
  Servicio,
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

  while (dates.length < count) {
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

export function buildAvailableSlots(args: {
  fecha: string;
  sucursalId: string;
  servicioId: string;
  profesionalId?: string;
  servicios: Servicio[];
  turnos: Turno[];
  horarios: HorarioSucursal[];
  profesionales: ProfesionalReserva[];
}) {
  const service = args.servicios.find((item) => item.id === args.servicioId);
  if (!service) return [];

  const windows = args.horarios.filter((item) => {
    const date = new Date(`${args.fecha}T12:00:00`);
    return (
      item.sucursal_id === args.sucursalId && item.dia_semana === date.getDay()
    );
  });
  if (windows.length === 0) return [];

  const profesionales = args.profesionalId
    ? args.profesionales.filter((item) => item.empleado_id === args.profesionalId)
    : args.profesionales.filter((item) => item.sucursal_id === args.sucursalId);

  const duration = service.duracion_min ?? 60;
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
    const profTurnos = blocked.filter(
      (turno) => turno.profesional_id === prof.empleado_id,
    );

    for (const window of windows) {
      let cursor = timeToMinutes(window.apertura);
      const end = timeToMinutes(window.cierre);
      while (cursor + duration <= end) {
        if (isToday && cursor <= currentMinutes) {
          cursor += 45;
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
        cursor += 45;
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

  return deduped.slice(0, 18);
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
