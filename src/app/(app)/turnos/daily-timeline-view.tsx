"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { HorarioSucursal } from "@/lib/types";
import type { TurnoDetalle } from "@/lib/turnos-helpers";
import type { ProfesionalReserva } from "@/lib/turnos-helpers";

const STATUS_CLASS: Record<string, string> = {
  pendiente: "bg-[#fff5dd] text-[#8c6b11] border-[#f1ddab]",
  confirmado: "bg-sage-50 text-sage-900 border-sage-200",
  en_curso: "bg-[#e9f2ff] text-[#1f5d99] border-[#c5d9f1]",
  completado: "bg-stone-100 text-stone-700 border-stone-200",
  cancelado: "bg-[#fff1ef] text-[#8a3b31] border-[#f1c5bf]",
  ausente: "bg-stone-200 text-stone-700 border-stone-300",
};

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
  ausente: "Ausente",
};

interface Props {
  fecha: string;
  turnos: TurnoDetalle[];
  profesionales: ProfesionalReserva[];
  horarios: HorarioSucursal[];
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToLabel(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

export function DailyTimelineView({ fecha, turnos, profesionales, horarios }: Props) {
  const searchParams = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const isToday = fecha === today;

  // Determine visible range from sucursal schedule
  const dayOfWeek = new Date(`${fecha}T12:00:00`).getDay();
  const dayHorarios = horarios.filter((h) => h.dia_semana === dayOfWeek);
  const startMin = dayHorarios.length > 0
    ? Math.min(...dayHorarios.map((h) => timeToMinutes(h.apertura)))
    : 8 * 60;
  const endMin = dayHorarios.length > 0
    ? Math.max(...dayHorarios.map((h) => timeToMinutes(h.cierre)))
    : 21 * 60;

  // Round to nearest 30min
  const gridStart = Math.floor(startMin / 30) * 30;
  const gridEnd = Math.ceil(endMin / 30) * 30;
  const totalSlots = (gridEnd - gridStart) / 30;
  const slotHeight = 60; // px per 30 min

  // Current time marker
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowOffset = ((nowMinutes - gridStart) / 30) * slotHeight;
  const showNowLine = isToday && nowMinutes >= gridStart && nowMinutes <= gridEnd;

  // Time slots for the Y axis
  const timeSlots: number[] = [];
  for (let m = gridStart; m < gridEnd; m += 30) {
    timeSlots.push(m);
  }

  function buildTurnoHref(turnoId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("turno", turnoId);
    return `/turnos?${params.toString()}`;
  }

  // Group turnos by profesional
  const turnosByProf: Record<string, TurnoDetalle[]> = {};
  for (const t of turnos) {
    (turnosByProf[t.profesional_id] ??= []).push(t);
  }

  const visibleProfs = profesionales.length > 0 ? profesionales : [];

  if (visibleProfs.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-stone-200 bg-cream/60 px-5 py-10 text-center text-sm text-stone-700">
        No hay profesionales configurados para esta sucursal.
      </div>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-4 overflow-hidden">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Vista por horario
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Timeline del día con bloques por duración real del servicio.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `56px repeat(${visibleProfs.length}, minmax(180px, 1fr))`,
            minWidth: `${56 + visibleProfs.length * 180}px`,
          }}
        >
          {/* Header row */}
          <div className="sticky top-0 z-10 border-b border-border bg-card" />
          {visibleProfs.map((prof) => (
            <div
              key={prof.id}
              className="sticky top-0 z-10 border-b border-border bg-card px-2 py-2 text-center"
            >
              <div
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: prof.color }}
              >
                {prof.empleado.nombre.split(" ").map((c) => c[0]).slice(0, 2).join("")}
              </div>
              <p className="mt-1 text-xs font-medium text-ink truncate">{prof.empleado.nombre}</p>
            </div>
          ))}

          {/* Time grid */}
          <div className="relative" style={{ height: totalSlots * slotHeight }}>
            {timeSlots.map((m, i) => (
              <div
                key={m}
                className="absolute left-0 right-0 flex items-start border-t border-stone-100 pr-2"
                style={{ top: i * slotHeight, height: slotHeight }}
              >
                <span className="mt-[-0.5em] text-[10px] text-muted-foreground w-full text-right">
                  {minutesToLabel(m)}
                </span>
              </div>
            ))}
          </div>

          {/* Profesional columns */}
          {visibleProfs.map((prof) => {
            const profTurnos = turnosByProf[prof.empleado_id] ?? [];
            return (
              <div
                key={prof.id}
                className="relative border-l border-stone-100"
                style={{ height: totalSlots * slotHeight }}
              >
                {/* Grid lines */}
                {timeSlots.map((m, i) => (
                  <div
                    key={m}
                    className="absolute left-0 right-0 border-t border-stone-50"
                    style={{ top: i * slotHeight, height: slotHeight }}
                  />
                ))}

                {/* Turno blocks */}
                {profTurnos.map((turno) => {
                  const tMin = timeToMinutes(turno.hora);
                  const top = ((tMin - gridStart) / 30) * slotHeight;
                  const height = Math.max((turno.duracion_min / 30) * slotHeight, 28);
                  const isSmall = turno.duracion_min <= 30;

                  return (
                    <Link
                      key={turno.id}
                      href={buildTurnoHref(turno.id)}
                      className={`absolute left-1 right-1 rounded-xl border px-2 py-1 transition hover:shadow-md hover:scale-[1.02] cursor-pointer overflow-hidden ${STATUS_CLASS[turno.estado]}`}
                      style={{ top, height }}
                    >
                      <div className={`${isSmall ? "flex items-center gap-2" : ""}`}>
                        <p className={`font-semibold ${isSmall ? "text-[10px]" : "text-xs"}`}>
                          {turno.hora}
                        </p>
                        <p className={`font-medium truncate ${isSmall ? "text-[10px]" : "text-xs"}`}>
                          {turno.cliente_nombre}
                        </p>
                      </div>
                      {!isSmall && (
                        <>
                          <p className="text-[10px] truncate opacity-80">
                            {turno.servicio?.nombre}
                          </p>
                          <p className="text-[10px] opacity-60">
                            {turno.duracion_min} min · {STATUS_LABEL[turno.estado]}
                          </p>
                        </>
                      )}
                    </Link>
                  );
                })}

                {/* Now line */}
                {showNowLine && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: nowOffset }}
                  >
                    <div className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-red-500 -ml-1" />
                      <div className="h-[2px] flex-1 bg-red-500" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
