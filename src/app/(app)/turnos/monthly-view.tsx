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
  fecha: string; // any date within the month (used to derive the month)
  turnosPorFecha: Record<string, TurnoDetalle[]>;
}

function getMonthGrid(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0 for our grid (ISO week)
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6; // Sunday wraps

  const cells: { iso: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const pd = new Date(year, month, -i);
    cells.push({
      iso: pd.toISOString().slice(0, 10),
      dayNum: pd.getDate(),
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const cd = new Date(year, month, day);
    cells.push({
      iso: cd.toISOString().slice(0, 10),
      dayNum: day,
      isCurrentMonth: true,
    });
  }

  // Next month padding to fill 6 rows
  while (cells.length < 42) {
    const nd = new Date(year, month + 1, cells.length - startOffset - lastDay.getDate() + 1);
    cells.push({
      iso: nd.toISOString().slice(0, 10),
      dayNum: nd.getDate(),
      isCurrentMonth: false,
    });
  }

  return cells;
}

export function MonthlyView({ fecha, turnosPorFecha }: Props) {
  const searchParams = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const cells = getMonthGrid(fecha);
  const HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  function buildDayHref(dayIso: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("fecha", dayIso);
    params.delete("vista");
    return `/turnos?${params.toString()}`;
  }

  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-4">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Vista mensual
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Panorama del mes. Toca un día para ver el detalle.
        </p>
      </div>

      {/* Desktop grid */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-px bg-stone-100 rounded-2xl overflow-hidden border border-stone-100">
          {HEADERS.map((h) => (
            <div
              key={h}
              className="bg-cream/70 px-2 py-2 text-center text-[10px] uppercase tracking-wider font-medium text-muted-foreground"
            >
              {h}
            </div>
          ))}
          {cells.map((cell) => {
            const dayTurnos = turnosPorFecha[cell.iso] ?? [];
            const isToday = cell.iso === today;
            const hasItems = dayTurnos.length > 0;
            return (
              <Link
                key={cell.iso}
                href={buildDayHref(cell.iso)}
                className={`bg-white min-h-[80px] p-1.5 transition hover:bg-sage-50/40 ${
                  !cell.isCurrentMonth ? "opacity-40" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? "bg-sage-900 text-white rounded-full w-6 h-6 flex items-center justify-center"
                        : "text-ink"
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {hasItems && (
                    <span className="text-[10px] font-medium text-sage-700">
                      {dayTurnos.length}
                    </span>
                  )}
                </div>
                {hasItems && (
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {dayTurnos.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.estado]}`}
                        title={`${t.hora} - ${t.cliente_nombre}`}
                      />
                    ))}
                    {dayTurnos.length > 5 && (
                      <span className="text-[8px] text-muted-foreground ml-0.5">
                        +{dayTurnos.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile grid — compact */}
      <div className="sm:hidden">
        <div className="grid grid-cols-7 gap-px bg-stone-100 rounded-2xl overflow-hidden border border-stone-100">
          {HEADERS.map((h) => (
            <div
              key={h}
              className="bg-cream/70 px-1 py-1.5 text-center text-[9px] uppercase tracking-wider font-medium text-muted-foreground"
            >
              {h.slice(0, 2)}
            </div>
          ))}
          {cells.map((cell) => {
            const dayTurnos = turnosPorFecha[cell.iso] ?? [];
            const isToday = cell.iso === today;
            const hasItems = dayTurnos.length > 0;
            return (
              <Link
                key={cell.iso}
                href={buildDayHref(cell.iso)}
                className={`bg-white min-h-[44px] p-1 flex flex-col items-center justify-start gap-0.5 ${
                  !cell.isCurrentMonth ? "opacity-30" : ""
                }`}
              >
                <span
                  className={`text-[11px] font-medium ${
                    isToday
                      ? "bg-sage-900 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                      : "text-ink"
                  }`}
                >
                  {cell.dayNum}
                </span>
                {hasItems && (
                  <span className="rounded-full bg-sage-100 text-sage-900 px-1 py-px text-[8px] font-semibold">
                    {dayTurnos.length}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
