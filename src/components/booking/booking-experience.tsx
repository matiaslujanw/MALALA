"use client";
import { useActionState, useDeferredValue, useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, Phone, Search, Sparkles, Star, X } from "lucide-react";
import { createPublicTurnoAction } from "@/lib/data/turnos";
import { buildAvailableSlots, listOpenDatesForSucursal, type ProfesionalReserva } from "@/lib/turnos-helpers";
import { cn, formatARS } from "@/lib/utils";
import type { HorarioSucursal, Servicio, Sucursal, Turno } from "@/lib/types";

interface Props {
  snapshot: {
    sucursales: Sucursal[];
    servicios: Servicio[];
    horarios: HorarioSucursal[];
    profesionales: ProfesionalReserva[];
    turnos: Turno[];
  };
  loggedInLabel?: string;
}

type ActionState =
  | { ok: true; turnoId: string; message: string }
  | { ok: false; errors: Record<string, string[]> }
  | null;

const initialActionState: ActionState = null;

export function BookingExperience({ snapshot, loggedInLabel }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createPublicTurnoAction,
    initialActionState,
  );
  const [sucursalId, setSucursalId] = useState(snapshot.sucursales[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("TODOS");
  const [servicioId, setServicioId] = useState("");
  const [profesionalId, setProfesionalId] = useState("any");
  const [fechaTurno, setFechaTurno] = useState("");
  const [slotKey, setSlotKey] = useState("");
  const deferredSearch = useDeferredValue(search);

  const servicios = useMemo(
    () =>
      snapshot.servicios.filter((item) => {
        const byCategory = categoria === "TODOS" || item.rubro === categoria;
        const byText =
          deferredSearch.trim().length === 0 ||
          item.nombre.toLowerCase().includes(deferredSearch.toLowerCase()) ||
          item.descripcion_corta?.toLowerCase().includes(deferredSearch.toLowerCase());
        return byCategory && byText;
      }),
    [categoria, deferredSearch, snapshot.servicios],
  );

  const categorias = useMemo(
    () => ["TODOS", ...new Set(snapshot.servicios.map((item) => item.rubro))],
    [snapshot.servicios],
  );

  const profesionales = useMemo(
    () =>
      snapshot.profesionales.filter((item) => item.sucursal_id === sucursalId),
    [snapshot.profesionales, sucursalId],
  );

  const servicioSeleccionado = useMemo(
    () => snapshot.servicios.find((item) => item.id === servicioId) ?? null,
    [servicioId, snapshot.servicios],
  );

  const fechasDisponibles = useMemo(
    () => listOpenDatesForSucursal(snapshot.horarios, sucursalId, 6),
    [snapshot.horarios, sucursalId],
  );

  const slots = useMemo(() => {
    if (!servicioSeleccionado || !fechaTurno) return [];
    return buildAvailableSlots({
      fecha: fechaTurno,
      sucursalId,
      servicioId: servicioSeleccionado.id,
      profesionalId: profesionalId === "any" ? undefined : profesionalId,
      horarios: snapshot.horarios,
      profesionales: snapshot.profesionales,
      servicios: snapshot.servicios,
      turnos: snapshot.turnos,
    });
  }, [
    fechaTurno,
    profesionalId,
    servicioSeleccionado,
    snapshot.horarios,
    snapshot.profesionales,
    snapshot.servicios,
    snapshot.turnos,
    sucursalId,
  ]);

  const sucursal = snapshot.sucursales.find((item) => item.id === sucursalId) ?? null;

  const panelOpen = Boolean(servicioSeleccionado);
  const selectedSlot =
    slots.find((item) => `${item.profesional_id}-${item.hora}` === slotKey) ?? null;

  function handleSucursalChange(nextSucursalId: string) {
    setSucursalId(nextSucursalId);
    setServicioId("");
    setProfesionalId("any");
    setFechaTurno("");
    setSlotKey("");
  }

  function handleServicioChange(nextServicioId: string) {
    setServicioId(nextServicioId);
    setProfesionalId("any");
    setFechaTurno("");
    setSlotKey("");
  }

  function handleProfesionalChange(nextProfesionalId: string) {
    setProfesionalId(nextProfesionalId);
    setFechaTurno("");
    setSlotKey("");
  }

  function handleFechaChange(nextFecha: string) {
    setFechaTurno(nextFecha);
    setSlotKey("");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f7f5ef,transparent_42%),linear-gradient(180deg,#f8f7f3_0%,#fafaf9_42%,#f4f1eb_100%)] text-foreground">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(40,52,41,0.08)] backdrop-blur">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.35fr_0.95fr] lg:px-10 lg:py-10">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-sage-100 bg-sage-50 p-2.5">
                    <Sparkles className="h-5 w-5 text-sage-700" />
                  </div>
                  <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                    Reserva de turnos online
                  </p>
                </div>
                {loggedInLabel ? (
                  <a
                    href="/dashboard"
                    className="rounded-full border border-sage-200 bg-sage-50 px-4 py-2 text-sm font-medium text-sage-900 transition hover:bg-sage-100"
                  >
                    Ir al back office
                  </a>
                ) : (
                  <a
                    href="/dev/login"
                    className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-sage-200 hover:text-foreground"
                  >
                    Acceso interno
                  </a>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
                    MALALA CLUB DE BELLEZA
                  </p>
                  <h1 className="font-display text-5xl uppercase tracking-[0.28em] text-ink sm:text-6xl lg:text-7xl">
                    MALALA
                  </h1>
                </div>
                <p className="max-w-2xl text-base leading-7 text-stone-700 sm:text-lg">
                  Reserva tu visita en cualquiera de nuestras dos sucursales.
                  Elegi servicio, profesional y horario con una experiencia
                  simple, visual y lista para crecer sobre datos reales.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="#servicios"
                  className="rounded-full bg-sage-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-sage-900"
                >
                  Reservar ahora
                </a>
                <a
                  href="#sucursales"
                  className="rounded-full border border-border bg-white px-5 py-3 text-sm font-medium text-foreground transition hover:border-sage-200 hover:bg-sage-50"
                >
                  Ver sucursales
                </a>
              </div>

              <div
                id="sucursales"
                className="grid gap-3 rounded-[1.5rem] border border-stone-100 bg-cream/75 p-4 sm:grid-cols-2"
              >
                {snapshot.sucursales.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSucursalChange(item.id)}
                    className={cn(
                      "rounded-[1.3rem] border px-4 py-4 text-left transition",
                      sucursalId === item.id
                        ? "border-sage-300 bg-white shadow-sm"
                        : "border-transparent bg-white/60 hover:border-sage-100 hover:bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-ink">{item.nombre}</p>
                        <p className="text-sm text-stone-700">{item.descripcion_corta}</p>
                      </div>
                      <div className="rounded-full bg-sage-50 px-3 py-1 text-sm font-medium text-sage-800">
                        {item.rating?.toFixed(1)} <Star className="ml-1 inline h-3.5 w-3.5 fill-current" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-stone-700">
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-sage-700" />
                        {item.direccion}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-sage-700" />
                        {item.telefono}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[1.75rem] border border-stone-100 bg-[linear-gradient(145deg,#f6f4ed_0%,#ffffff_50%,#eef3ec_100%)] p-6">
              <div className="absolute inset-x-10 top-0 h-28 rounded-full bg-sage-100/50 blur-3xl" />
              <div className="relative space-y-5">
                <div className="flex items-center gap-4">
                  <img
                    src="/logo-malala.png"
                    alt="Logo MALALA"
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-full border border-stone-100 object-cover shadow-sm"
                  />
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                      Sucursal activa
                    </p>
                    <h2 className="mt-1 text-3xl font-semibold text-ink">
                      {sucursal?.nombre}
                    </h2>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/70 bg-white/85 p-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                      Valoracion
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-ink">
                      {sucursal?.rating?.toFixed(1)}
                    </p>
                    <p className="mt-1 text-sm text-stone-700">
                      Basado en {sucursal?.reviews} opiniones
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-sage-900 p-4 text-white">
                    <p className="text-xs uppercase tracking-[0.28em] text-white/70">
                      Horarios
                    </p>
                    <p className="mt-2 text-lg font-medium">{sucursal?.horario_resumen}</p>
                    <p className="mt-1 text-sm text-white/70">
                      Slots sugeridos cada 45 minutos
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                    Profesionales destacadas
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4">
                    {profesionales.map((prof) => (
                      <div key={prof.id} className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
                          style={{ backgroundColor: prof.color }}
                        >
                          {prof.empleado.nombre
                            .split(" ")
                            .map((chunk) => chunk[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-ink">{prof.empleado.nombre}</p>
                          <p className="text-xs text-stone-700">{prof.especialidad}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div id="servicios" className="space-y-8">
            <section className="space-y-4 rounded-[1.75rem] border border-white/70 bg-white/75 p-5 shadow-[0_18px_60px_rgba(40,52,41,0.06)] backdrop-blur lg:p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Profesionales
                </p>
                <h2 className="text-2xl font-semibold text-ink">
                  Quien te acompana en {sucursal?.nombre}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {profesionales.map((prof) => (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => handleProfesionalChange(prof.empleado_id)}
                    className={cn(
                      "rounded-[1.35rem] border px-4 py-4 text-left transition",
                      profesionalId === prof.empleado_id
                        ? "border-sage-300 bg-sage-50"
                        : "border-stone-100 bg-white hover:border-sage-100 hover:bg-sage-50/60",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
                        style={{ backgroundColor: prof.color }}
                      >
                        {prof.empleado.nombre
                          .split(" ")
                          .map((chunk) => chunk[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{prof.empleado.nombre}</p>
                        <p className="text-sm text-stone-700">{prof.especialidad}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-stone-700">{prof.bio}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-5 rounded-[1.75rem] border border-white/70 bg-white/75 p-5 shadow-[0_18px_60px_rgba(40,52,41,0.06)] backdrop-blur lg:p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Servicios
                </p>
                <h2 className="text-2xl font-semibold text-ink">
                  Elegi lo que queres reservar
                </h2>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar servicios..."
                  className="w-full rounded-full border border-stone-200 bg-white px-11 py-3 text-sm outline-none transition focus:border-sage-300"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {categorias.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategoria(item)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition",
                      categoria === item
                        ? "border-sage-700 bg-sage-700 text-white"
                        : "border-stone-200 bg-white text-foreground hover:border-sage-200 hover:bg-sage-50",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {servicios.map((item) => {
                  const active = item.id === servicioId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleServicioChange(item.id)}
                      className={cn(
                        "relative overflow-hidden rounded-[1.5rem] border p-5 text-left transition",
                        active
                          ? "border-sage-300 bg-sage-50 shadow-sm"
                          : "border-stone-100 bg-white hover:border-sage-100 hover:bg-sage-50/40",
                      )}
                    >
                      {item.destacado_pct ? (
                        <span className="absolute right-0 top-0 rounded-bl-2xl bg-[#e53b2d] px-3 py-1 text-xs font-semibold tracking-wide text-white">
                          {item.destacado_pct}% OFF
                        </span>
                      ) : null}
                      <div className="space-y-3">
                        <div>
                          <p className="text-xl font-medium text-ink">{item.nombre}</p>
                          <p className="mt-1 text-sm text-stone-700">{item.descripcion_corta}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
                          <span className="font-semibold text-ink">
                            Desde {formatARS(item.precio_efectivo)}
                          </span>
                          <span className="text-stone-400 line-through">
                            {formatARS(item.precio_lista)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-4 w-4 text-sage-700" />
                            {item.duracion_min} min
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-700">
                            {active ? "Seleccionado" : "Reservar"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="hidden lg:block">
            <DesktopBookingPanel
              sucursal={sucursal}
              servicio={servicioSeleccionado}
              profesionales={profesionales}
              profesionalId={profesionalId}
              setProfesionalId={handleProfesionalChange}
              fechasDisponibles={fechasDisponibles}
              fechaTurno={fechaTurno}
              setFechaTurno={handleFechaChange}
              slotKey={slotKey}
              setSlotKey={setSlotKey}
              slots={slots}
              selectedSlot={selectedSlot}
              pending={pending}
              formAction={formAction}
              state={state}
            />
          </aside>
        </section>
      </main>

      {panelOpen ? (
        <MobileBookingDrawer
          sucursal={sucursal}
          servicio={servicioSeleccionado}
          profesionales={profesionales}
          profesionalId={profesionalId}
          setProfesionalId={handleProfesionalChange}
          fechasDisponibles={fechasDisponibles}
          fechaTurno={fechaTurno}
          setFechaTurno={handleFechaChange}
          slotKey={slotKey}
          setSlotKey={setSlotKey}
          slots={slots}
          selectedSlot={selectedSlot}
          pending={pending}
          formAction={formAction}
          state={state}
          onClose={() => {
            setServicioId("");
              setProfesionalId("any");
              setFechaTurno("");
              setSlotKey("");
          }}
        />
      ) : null}

      {!panelOpen ? (
        <a
          href="#servicios"
          className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-center rounded-full bg-sage-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(44,53,37,0.28)] transition hover:bg-sage-700 lg:hidden"
        >
          Reservar turno
        </a>
      ) : null}
    </div>
  );
}

function DesktopBookingPanel(
  props: BookingPanelProps,
) {
  return (
    <div className="sticky top-6 h-[calc(100vh-3rem)]">
      <div className="h-full overflow-y-auto overscroll-contain pr-1">
        <BookingPanelContent {...props} />
      </div>
    </div>
  );
}

function MobileBookingDrawer(
  props: BookingPanelProps & { onClose: () => void },
) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 lg:hidden">
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[1.75rem] bg-white p-4 shadow-2xl">
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-stone-100 bg-white/96 px-4 py-4 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
            Completa tu reserva
          </p>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full border border-border bg-white p-2 text-muted-foreground shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <BookingPanelContent {...props} />
      </div>
    </div>
  );
}

interface BookingPanelProps {
  sucursal: Sucursal | null;
  servicio: Servicio | null;
  profesionales: ProfesionalReserva[];
  profesionalId: string;
  setProfesionalId: (value: string) => void;
  fechasDisponibles: string[];
  fechaTurno: string;
  setFechaTurno: (value: string) => void;
  slotKey: string;
  setSlotKey: (value: string) => void;
  slots: ReturnType<typeof buildAvailableSlots>;
  selectedSlot: ReturnType<typeof buildAvailableSlots>[number] | null;
  pending: boolean;
  formAction: (payload: FormData) => void;
  state: ActionState;
}

function BookingPanelContent({
  sucursal,
  servicio,
  profesionales,
  profesionalId,
  setProfesionalId,
  fechasDisponibles,
  fechaTurno,
  setFechaTurno,
  slotKey,
  setSlotKey,
  slots,
  selectedSlot,
  pending,
  formAction,
  state,
}: BookingPanelProps) {
  return (
    <div className="rounded-[1.75rem] border border-stone-100 bg-white p-5 shadow-[0_18px_60px_rgba(40,52,41,0.08)]">
      {!servicio ? (
        <div className="space-y-3 text-sm text-stone-700">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Paso a paso
          </p>
          <h3 className="text-2xl font-semibold text-ink">
            Selecciona un servicio
          </h3>
          <p>
            Cuando elijas un servicio vas a poder definir profesional, fecha y
            horario disponible.
          </p>
        </div>
      ) : (
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="sucursal_id" value={sucursal?.id ?? ""} />
          <input type="hidden" name="servicio_id" value={servicio.id} />
          <input type="hidden" name="profesional_id" value={selectedSlot?.profesional_id ?? (profesionalId === "any" ? "" : profesionalId)} />
          <input type="hidden" name="fecha_turno" value={fechaTurno} />
          <input type="hidden" name="hora" value={selectedSlot?.hora ?? ""} />
          <input type="hidden" name="sin_preferencia" value={String(profesionalId === "any")} />
          <input type="hidden" name="canal" value="web" />
          <input type="hidden" name="origen" value="publico" />

          <div className="space-y-2 border-b border-stone-100 pb-4">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Reserva activa
            </p>
            <h3 className="text-2xl font-semibold text-ink">{servicio.nombre}</h3>
            <p className="text-sm text-stone-700">
              {servicio.duracion_min} min · desde {formatARS(servicio.precio_efectivo)}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-ink">Profesional</p>
            <button
              type="button"
              onClick={() => setProfesionalId("any")}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition",
                profesionalId === "any"
                  ? "border-sage-300 bg-sage-50"
                  : "border-stone-100 hover:border-sage-100",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sage-700" />
                No tengo preferencia
              </span>
              <span className="text-xs text-stone-500">maxima disponibilidad</span>
            </button>

            <div className="grid gap-2">
              {profesionales.map((prof) => (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => setProfesionalId(prof.empleado_id)}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                    profesionalId === prof.empleado_id
                      ? "border-sage-300 bg-sage-50"
                      : "border-stone-100 hover:border-sage-100",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: prof.color }}
                    >
                      {prof.empleado.nombre
                        .split(" ")
                        .map((chunk) => chunk[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-ink">
                        {prof.empleado.nombre}
                      </span>
                      <span className="block text-xs text-stone-600">{prof.especialidad}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-ink">Fecha</p>
            <div className="grid grid-cols-2 gap-2">
              {fechasDisponibles.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFechaTurno(item)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    fechaTurno === item
                      ? "border-sage-300 bg-sage-50"
                      : "border-stone-100 hover:border-sage-100",
                  )}
                >
                  <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                    <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                    disponible
                  </span>
                  <span className="mt-1 block text-sm font-medium text-ink">
                    {new Date(`${item}T12:00:00`).toLocaleDateString("es-AR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-ink">Horario</p>
            {slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-cream/70 px-4 py-5 text-sm text-stone-700">
                Selecciona una fecha para ver horarios disponibles.
              </div>
            ) : (
              <div className="grid gap-2">
                {slots.map((slot) => (
                  <button
                    key={`${slot.profesional_id}-${slot.hora}`}
                    type="button"
                    onClick={() => setSlotKey(`${slot.profesional_id}-${slot.hora}`)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition",
                      slotKey === `${slot.profesional_id}-${slot.hora}`
                        ? "border-sage-300 bg-sage-50"
                        : "border-stone-100 hover:border-sage-100",
                    )}
                  >
                    <span className="block text-base font-medium text-ink">
                      {slot.hora} con {slot.profesional_nombre}
                    </span>
                    <span className="text-xs text-stone-600">
                      {profesionalId === "any"
                        ? "sin preferencia, sugerido por disponibilidad"
                        : "turno sugerido para tu seleccion"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-[1.5rem] border border-stone-100 bg-cream/60 p-4">
            <p className="text-sm font-medium text-ink">Tus datos</p>
            <div className="grid gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-stone-700">Nombre y apellido</span>
                <input
                  name="cliente_nombre"
                  required
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 outline-none focus:border-sage-300"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-stone-700">Telefono</span>
                <input
                  name="cliente_telefono"
                  required
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 outline-none focus:border-sage-300"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-stone-700">Email (opcional)</span>
                <input
                  name="cliente_email"
                  type="email"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 outline-none focus:border-sage-300"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-stone-700">Observaciones (opcional)</span>
                <textarea
                  name="observacion"
                  rows={3}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 outline-none focus:border-sage-300"
                />
              </label>
            </div>
          </div>

          {state && !state.ok ? (
            <div className="rounded-2xl border border-[#f2c4bd] bg-[#fff1ef] px-4 py-3 text-sm text-[#8a3b31]">
              {Object.values(state.errors).flat()[0]}
            </div>
          ) : null}
          {state?.ok ? (
            <div className="rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-900">
              {state.message}
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border border-sage-100 bg-sage-900 px-4 py-4 text-white">
            <p className="text-xs uppercase tracking-[0.28em] text-white/70">
              Resumen
            </p>
            <p className="mt-2 text-sm">
              {sucursal?.nombre} · {selectedSlot ? `${selectedSlot.hora} con ${selectedSlot.profesional_nombre}` : "Elegi horario"}
            </p>
            <button
              type="submit"
              disabled={!selectedSlot || pending}
              className="mt-4 flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-sage-900 transition hover:bg-sage-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Reservando..." : "Confirmar turno"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
