import Link from "next/link";
import { Clock3, Filter, Plus, UserRound, X } from "lucide-react";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { QuickAddForm } from "@/components/quick-add-form";
import {
  getHorarios,
  getTurno,
  getTurnosAgendaData,
  getTurnosAgendaRangeData,
} from "@/lib/data/turnos";
import {
  submitReprogramTurnoAction,
  submitUpdateTurnoEstadoAction,
} from "@/lib/data/turnos-actions";
import { listServicios } from "@/lib/data/servicios";
import { formatARS, formatLongDate } from "@/lib/utils";
import { DateSelector } from "./date-selector";
import { ViewSelector, type VistaAgenda } from "./view-selector";
import { DailyTimelineView } from "./daily-timeline-view";
import { WeeklyView } from "./weekly-view";
import { MonthlyView } from "./monthly-view";

interface SearchParams {
  fecha?: string;
  sucursal?: string;
  profesional?: string;
  estado?: string;
  turno?: string;
  vista?: string;
}

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
  ausente: "Ausente",
};

const STATUS_CLASS: Record<string, string> = {
  pendiente: "bg-[#fff5dd] text-[#8c6b11]",
  confirmado: "bg-sage-50 text-sage-900",
  en_curso: "bg-[#e9f2ff] text-[#1f5d99]",
  completado: "bg-stone-100 text-stone-700",
  cancelado: "bg-[#fff1ef] text-[#8a3b31]",
  ausente: "bg-stone-200 text-stone-700",
};

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const activeSucursal = await getActiveSucursal();
  const sp = await searchParams;
  const fecha = sp.fecha ?? new Date().toISOString().slice(0, 10);
  const sucursalId = sp.sucursal ?? activeSucursal?.id ?? "";
  const vista = (sp.vista as VistaAgenda) || "diaria";

  const agenda = await getTurnosAgendaData({
    fecha,
    sucursalId,
    profesionalId: sp.profesional || undefined,
    estado: sp.estado || undefined,
  });
  const servicios = await listServicios();
  const turnoSeleccionado = sp.turno ? await getTurno(sp.turno) : null;

  // Fetch horarios for diaria timeline
  const horarios = (vista === "diaria") ? await getHorarios(sucursalId) : [];

  // Fetch range data for semanal/mensual
  let rangeData: Awaited<ReturnType<typeof getTurnosAgendaRangeData>> | null = null;
  let weekMonday = fecha;
  let monthFirst = fecha;

  if (vista === "semanal") {
    const d = new Date(`${fecha}T12:00:00`);
    const dayOffset = (d.getDay() + 6) % 7; // Monday=0
    d.setDate(d.getDate() - dayOffset);
    weekMonday = d.toISOString().slice(0, 10);
    const endD = new Date(d);
    endD.setDate(endD.getDate() + 6);
    rangeData = await getTurnosAgendaRangeData({
      fechaDesde: weekMonday,
      fechaHasta: endD.toISOString().slice(0, 10),
      sucursalId,
      profesionalId: sp.profesional || undefined,
      estado: sp.estado || undefined,
    });
  } else if (vista === "mensual") {
    const d = new Date(`${fecha}T12:00:00`);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    monthFirst = first.toISOString().slice(0, 10);
    // Pad to include full weeks
    let startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - startOffset);
    const gridEnd = new Date(last);
    gridEnd.setDate(gridEnd.getDate() + (6 - ((last.getDay() + 6) % 7)));
    rangeData = await getTurnosAgendaRangeData({
      fechaDesde: gridStart.toISOString().slice(0, 10),
      fechaHasta: gridEnd.toISOString().slice(0, 10),
      sucursalId,
      profesionalId: sp.profesional || undefined,
      estado: sp.estado || undefined,
    });
  }

  const turnosPorProfesional = agenda.turnos.reduce<Record<string, typeof agenda.turnos>>(
    (acc, turno) => {
      (acc[turno.profesional_id] ??= []).push(turno);
      return acc;
    },
    {},
  );
  const canManage = user.rol === "admin" || user.rol === "encargada";

  const effectiveDateLabel = vista === "semanal" ? weekMonday : vista === "mensual" ? monthFirst : fecha;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Agenda operativa
          </p>
          <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
            Turnos
          </h1>
          <p className="text-sm text-muted-foreground">
            {agenda.sucursales.find((item) => item.id === sucursalId)?.nombre} ·{" "}
            {formatLongDate(`${fecha}T12:00:00`)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateSelector fecha={effectiveDateLabel} vista={vista} />
          <ViewSelector active={vista} />
        </div>
      </header>

      {(vista === "diaria" || vista === "actual") && (
        <div className="grid gap-4 md:grid-cols-4">
          <Kpi label="Turnos del dia" value={String(agenda.resumen.total)} hint="agenda activa" />
          <Kpi label="Pendientes" value={String(agenda.resumen.pendientes)} hint="web o recepcion" tone="warm" />
          <Kpi label="Confirmados" value={String(agenda.resumen.confirmados)} hint="listos para asistir" tone="sage" />
          <Kpi label="En curso / completados" value={`${agenda.resumen.enCurso} / ${agenda.resumen.completados}`} hint="seguimiento del dia" />
        </div>
      )}

      <form
        action="/turnos"
        method="get"
        className="grid gap-3 rounded-[1.5rem] border border-border bg-card p-4 lg:grid-cols-[1.1fr_1fr_1fr_auto]"
      >
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Sucursal
          </label>
          <select
            name="sucursal"
            defaultValue={sucursalId}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
          >
            {agenda.sucursales.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Profesional
          </label>
          <select
            name="profesional"
            defaultValue={sp.profesional ?? ""}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {agenda.profesionales.map((item) => (
              <option key={item.id} value={item.empleado_id}>
                {item.empleado.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Estado
          </label>
          <select
            name="estado"
            defaultValue={sp.estado ?? ""}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <input type="hidden" name="fecha" value={fecha} />
          <input type="hidden" name="vista" value={vista} />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition hover:bg-sage-700"
          >
            <Filter className="h-4 w-4" />
            Filtrar
          </button>
        </div>
      </form>

      {vista === "diaria" && (
        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <DailyTimelineView
            fecha={fecha}
            turnos={agenda.turnos}
            profesionales={agenda.profesionales}
            horarios={horarios}
          />
          <aside className="space-y-6">
            {canManage && (
              <QuickAddForm
                sucursalId={sucursalId}
                fecha={fecha}
                servicios={servicios}
                profesionales={agenda.profesionales}
              />
            )}
          </aside>
        </div>
      )}

      {vista === "semanal" && rangeData && (
        <WeeklyView fecha={weekMonday} turnosPorFecha={rangeData.turnosPorFecha} />
      )}

      {vista === "mensual" && rangeData && (
        <MonthlyView fecha={monthFirst} turnosPorFecha={rangeData.turnosPorFecha} />
      )}

      {vista === "actual" && (
      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Vista por profesional
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada columna agrupa los turnos del dia en la sucursal elegida.
                </p>
              </div>
            </div>

            {agenda.profesionales.length === 0 ? (
              <EmptyAgenda />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {agenda.profesionales.map((prof) => {
                  const items = turnosPorProfesional[prof.empleado_id] ?? [];
                  return (
                    <div
                      key={prof.id}
                      className="rounded-[1.5rem] border border-stone-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8f8f4_100%)] p-4"
                    >
                      <div className="mb-4 flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                          style={{ backgroundColor: prof.color }}
                        >
                          {initials(prof.empleado.nombre)}
                        </div>
                        <div>
                          <p className="font-medium text-ink">{prof.empleado.nombre}</p>
                          <p className="text-xs text-muted-foreground">{prof.especialidad}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {items.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
                            Sin turnos cargados para hoy.
                          </div>
                        ) : (
                          items.map((turno) => (
                            <Link
                              key={turno.id}
                              href={buildHref(sp, { turno: turno.id })}
                              className="block rounded-2xl border border-stone-100 bg-white p-4 transition hover:border-sage-200 hover:bg-sage-50/30"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-lg font-semibold text-ink">{turno.hora}</p>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[turno.estado]}`}
                                >
                                  {STATUS_LABEL[turno.estado]}
                                </span>
                              </div>
                              <p className="mt-2 font-medium text-ink">{turno.cliente_nombre}</p>
                              <p className="text-sm text-stone-700">
                                {turno.servicio?.nombre}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                Canal {turno.canal} · {formatARS(turno.servicio?.precio_efectivo ?? 0)}
                              </p>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[1.75rem] border border-border bg-card p-4">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Listado compacto
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Lectura rapida de estados, horarios y servicios.
              </p>
            </div>

            {agenda.turnos.length === 0 ? (
              <EmptyAgenda />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-stone-100">
                <table className="w-full text-sm">
                  <thead className="bg-cream/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Hora</th>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Servicio</th>
                      <th className="px-4 py-3 font-medium">Profesional</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {agenda.turnos.map((turno) => (
                      <tr key={turno.id} className="hover:bg-cream/30">
                        <td className="px-4 py-3 font-medium">{turno.hora}</td>
                        <td className="px-4 py-3">{turno.cliente_nombre}</td>
                        <td className="px-4 py-3">{turno.servicio?.nombre}</td>
                        <td className="px-4 py-3">{turno.profesional?.empleado.nombre}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[turno.estado]}`}
                          >
                            {STATUS_LABEL[turno.estado]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {canManage && (
            <QuickAddForm
              sucursalId={sucursalId}
              fecha={fecha}
              servicios={servicios}
              profesionales={agenda.profesionales}
            />
          )}

          <section className="rounded-[1.75rem] border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-full bg-cream p-2 text-stone-700">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Detalle y acciones
                </p>
                <p className="text-sm text-muted-foreground">
                  Selecciona un turno desde la agenda para administrarlo.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-stone-200 bg-cream/60 px-4 py-6 text-sm text-stone-700">
              Selecciona un turno en la vista para ver sus detalles en una ventana emergente.
            </div>
          </section>
        </aside>
      </div>
      )}

      {turnoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-[2rem] bg-card p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <Link 
              href={buildHref(sp, { turno: undefined })} 
              className="absolute right-6 top-6 rounded-full bg-stone-100 p-2 text-stone-500 hover:bg-stone-200 transition"
            >
              <X className="h-4 w-4" />
            </Link>
            
            <div className="mb-6 pr-8">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Información del turno
              </p>
              <h2 className="mt-1 font-display text-2xl uppercase tracking-wider">
                Detalle y acciones
              </h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-stone-100 bg-cream/60 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-ink">
                      {turnoSeleccionado.cliente_nombre}
                    </p>
                    <p className="text-sm text-stone-700">
                      {turnoSeleccionado.servicio?.nombre}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${STATUS_CLASS[turnoSeleccionado.estado]}`}
                  >
                    {STATUS_LABEL[turnoSeleccionado.estado]}
                  </span>
                </div>
                <div className="mt-5 space-y-2.5 text-sm text-stone-700">
                  <p className="flex items-center gap-2 font-medium">
                    <Clock3 className="h-4 w-4 text-sage-700" />
                    {turnoSeleccionado.fecha_turno} · {turnoSeleccionado.hora}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Profesional:</span> {turnoSeleccionado.profesional?.empleado.nombre}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Duración:</span> {turnoSeleccionado.duracion_min} minutos
                  </p>
                  <p>
                    <span className="text-muted-foreground">Teléfono:</span> {turnoSeleccionado.cliente_telefono}
                  </p>
                  {turnoSeleccionado.observacion ? (
                    <p><span className="text-muted-foreground">Obs:</span> {turnoSeleccionado.observacion}</p>
                  ) : null}
                </div>
              </div>

              {canManage ? (
                <>
                  <form action={submitUpdateTurnoEstadoAction} className="space-y-2 mt-2">
                    <input type="hidden" name="turno_id" value={turnoSeleccionado.id} />
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                      Cambiar estado
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <button
                          key={value}
                          type="submit"
                          name="estado"
                          value={value}
                          className={`rounded-xl border px-2 py-2 text-xs transition ${
                            turnoSeleccionado.estado === value
                              ? "border-sage-300 bg-sage-100 font-semibold"
                              : "border-border hover:border-sage-200 hover:bg-sage-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </form>

                  <form action={submitReprogramTurnoAction} className="space-y-3 mt-4 rounded-2xl border border-stone-100 p-4 bg-white">
                    <input type="hidden" name="turno_id" value={turnoSeleccionado.id} />
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                      Reprogramar
                    </p>
                    <label className="block space-y-1 text-sm">
                      <span className="text-stone-700">Profesional</span>
                      <select
                        name="profesional_id"
                        defaultValue={turnoSeleccionado.profesional_id}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2.5"
                      >
                        {agenda.profesionales.map((item) => (
                          <option key={item.id} value={item.empleado_id}>
                            {item.empleado.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1 text-sm">
                        <span className="text-stone-700">Fecha</span>
                        <input
                          name="fecha_turno"
                          type="date"
                          defaultValue={turnoSeleccionado.fecha_turno}
                          className="w-full rounded-xl border border-border bg-card px-3 py-2.5"
                        />
                      </label>
                      <label className="block space-y-1 text-sm">
                        <span className="text-stone-700">Hora</span>
                        <input
                          name="hora"
                          type="time"
                          defaultValue={turnoSeleccionado.hora}
                          className="w-full rounded-xl border border-border bg-card px-3 py-2.5"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="w-full mt-2 rounded-xl bg-sage-900 px-4 py-3 text-sm font-medium uppercase tracking-wider text-white transition hover:bg-sage-700"
                    >
                      Guardar reprogramación
                    </button>
                  </form>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "sage" | "warm";
}) {
  const extraClass =
    tone === "sage"
      ? "border-sage-200 bg-sage-50"
      : tone === "warm"
        ? "border-[#f1ddab] bg-[#fff8e9]"
        : "border-border bg-card";
  return (
    <div className={`rounded-[1.4rem] border p-5 ${extraClass}`}>
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function EmptyAgenda() {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-stone-200 bg-cream/60 px-5 py-10 text-center text-sm text-stone-700">
      No hay turnos para los filtros seleccionados.
    </div>
  );
}

function buildHref(
  searchParams: SearchParams,
  overrides: Partial<Record<keyof SearchParams, string | undefined>>,
) {
  const params = new URLSearchParams();
  const merged = { ...searchParams, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/turnos?${query}` : "/turnos";
}

function addDays(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function initials(value: string) {
  return value
    .split(" ")
    .map((chunk) => chunk[0])
    .slice(0, 2)
    .join("");
}


