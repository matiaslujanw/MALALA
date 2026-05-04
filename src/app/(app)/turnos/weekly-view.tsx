"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { TurnoDetalle } from "@/lib/turnos-helpers";

const STATUS_DOT: Record<string, string> = {
  pendiente: "bg-[#c9a961]",
  confirmado: "bg-sage-500",
  en_curso: "bg-[#1f5d99]",
  completado: "bg-stone-500",
  cancelado: "bg-[#a84a3d]",
  ausente: "bg-stone-400",
};

interface Props {
  fecha: string; // Monday of the week
  turnosPorFecha: Record<string, TurnoDetalle[]>;
}

function getWeekDays(mondayIso: string) {
  const days: { iso: string; dayName: string; dayNum: number }[] = [];
  const NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${mondayIso}T12:00:00`);
    d.setDate(d.getDate() + i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      dayName: NAMES[i],
      dayNum: d.getDate(),
    });
  }
  return days;
}

export function WeeklyView({ fecha, turnosPorFecha }: Props) {
  const searchParams = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const weekDays = getWeekDays(fecha);

  function buildDayHref(dayIso: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("fecha", dayIso);
    params.delete("vista");
    return `/turnos?${params.toString()}`;
  }

  function buildTurnoHref(turnoId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("turno", turnoId);
    return `/turnos?${params.toString()}`;
  }

  const MAX_VISIBLE = 3;

  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-4">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Vista semanal
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Panorama de la semana con acceso rápido a cada día.
        </p>
      </div>

      {/* Desktop: 7-column grid */}
      <div className="hidden md:grid md:grid-cols-7 gap-2">
        {weekDays.map(({ iso, dayName, dayNum }) => {
          const dayTurnos = turnosPorFecha[iso] ?? [];
          const isCurrentDay = iso === today;
          return (
            <div
              key={iso}
              className={`rounded-2xl border p-3 min-h-[140px] transition ${
                isCurrentDay
                  ? "border-sage-300 bg-sage-50/50"
                  : "border-stone-100 bg-white hover:border-sage-200"
              }`}
            >
              <Link
                href={buildDayHref(iso)}
                className="flex items-center gap-1.5 group"
              >
                <span className="text-xs text-muted-foreground">{dayName}</span>
                <span
                  className={`text-sm font-semibold ${
                    isCurrentDay
                      ? "bg-sage-900 text-white rounded-full w-6 h-6 flex items-center justify-center"
                      : "text-ink group-hover:text-sage-700"
                  }`}
                >
                  {dayNum}
                </span>
              </Link>

              <div className="mt-2 space-y-1.5">
                {dayTurnos.slice(0, MAX_VISIBLE).map((turno) => (
                  <Link
                    key={turno.id}
                    href={buildTurnoHref(turno.id)}
                    className="block rounded-lg bg-stone-50 px-2 py-1 transition hover:bg-sage-50 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: turno.profesional?.color ?? "#999" }}
                      />
                      <span className="text-[10px] font-medium text-ink">{turno.hora}</span>
                    </div>
                    <p className="text-[10px] text-stone-700 truncate">
                      {turno.cliente_nombre}
                    </p>
                  </Link>
                ))}
                {dayTurnos.length > MAX_VISIBLE && (
                  <Link
                    href={buildDayHref(iso)}
                    className="block text-[10px] text-sage-700 font-medium hover:underline px-2"
                  >
                    +{dayTurnos.length - MAX_VISIBLE} más
                  </Link>
                )}
                {dayTurnos.length === 0 && (
                  <p className="text-[10px] text-stone-400 px-1">Sin turnos</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: Vertical list */}
      <div className="md:hidden space-y-3">
        {weekDays.map(({ iso, dayName, dayNum }) => {
          const dayTurnos = turnosPorFecha[iso] ?? [];
          const isCurrentDay = iso === today;
          return (
            <div
              key={iso}
              className={`rounded-2xl border p-3 ${
                isCurrentDay ? "border-sage-300 bg-sage-50/50" : "border-stone-100"
              }`}
            >
              <Link
                href={buildDayHref(iso)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      isCurrentDay
                        ? "bg-sage-900 text-white rounded-full w-7 h-7 flex items-center justify-center"
                        : "text-ink"
                    }`}
                  >
                    {dayNum}
                  </span>
                  <span className="text-xs text-muted-foreground">{dayName}</span>
                </div>
                <div className="flex items-center gap-1">
                  {dayTurnos.length > 0 && (
                    <span className="rounded-full bg-sage-100 text-sage-900 px-2 py-0.5 text-[10px] font-medium">
                      {dayTurnos.length} turno{dayTurnos.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </Link>

              {dayTurnos.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {dayTurnos.slice(0, MAX_VISIBLE).map((turno) => (
                    <Link
                      key={turno.id}
                      href={buildTurnoHref(turno.id)}
                      className="flex items-center gap-2 rounded-lg bg-stone-50 px-2 py-1.5 hover:bg-sage-50"
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: turno.profesional?.color ?? "#999" }}
                      />
                      <span className="text-xs font-medium text-ink">{turno.hora}</span>
                      <span className="text-xs text-stone-600 truncate flex-1">
                        {turno.cliente_nombre}
                      </span>
                      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[turno.estado]}`} />
                    </Link>
                  ))}
                  {dayTurnos.length > MAX_VISIBLE && (
                    <Link
                      href={buildDayHref(iso)}
                      className="block text-xs text-sage-700 font-medium hover:underline px-2"
                    >
                      +{dayTurnos.length - MAX_VISIBLE} más →
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
