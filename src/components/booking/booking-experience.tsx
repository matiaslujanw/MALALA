"use client";

import Image from "next/image";
import { useActionState, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  Star,
  WandSparkles,
  X,
} from "lucide-react";
import { createPublicTurnoAction } from "@/lib/data/turnos-actions";
import {
  buildAvailableSlots,
  listOpenDatesForSucursal,
  type ProfesionalReserva,
} from "@/lib/turnos-helpers";
import { HeroVideoShowcase } from "@/components/booking/hero-video-showcase";
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
const storeUrl = "https://malala.ar/";
const whatsappUrl =
  "https://api.whatsapp.com/send/?phone=5493812393260&text&type=phone_number&app_absent=0";
const mapEmbedUrl =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3560.6623312336574!2d-65.2204963!3d-26.8188784!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94225df9c2bdc3f9%3A0x4f503c4c1aeea6f6!2sMalala%20club%20de%20belleza!5e0!3m2!1ses-419!2sar!4v1777588681376!5m2!1ses-419!2sar";

const TOTAL_STEPS = 7;

export function BookingExperience({ snapshot, loggedInLabel }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createPublicTurnoAction,
    initialActionState,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [featuredSucursalId, setFeaturedSucursalId] = useState(
    snapshot.sucursales[0]?.id ?? "",
  );
  const [bookingSucursalId, setBookingSucursalId] = useState("");
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("TODOS");
  const [servicioId, setServicioId] = useState("");
  const [profesionalId, setProfesionalId] = useState("");
  const [fechaTurno, setFechaTurno] = useState("");
  const [slotKey, setSlotKey] = useState("");
  const deferredSearch = useDeferredValue(search);

  const featuredSucursal =
    snapshot.sucursales.find((item) => item.id === featuredSucursalId) ??
    snapshot.sucursales[0] ??
    null;

  const bookingSucursal =
    snapshot.sucursales.find((item) => item.id === bookingSucursalId) ?? null;

  const categorias = useMemo(
    () => ["TODOS", ...new Set(snapshot.servicios.map((item) => item.rubro))],
    [snapshot.servicios],
  );

  const servicios = useMemo(
    () =>
      snapshot.servicios.filter((item) => {
        const matchesCategory = categoria === "TODOS" || item.rubro === categoria;
        const term = deferredSearch.trim().toLowerCase();
        const matchesText =
          term.length === 0 ||
          item.nombre.toLowerCase().includes(term) ||
          item.rubro.toLowerCase().includes(term) ||
          item.descripcion_corta?.toLowerCase().includes(term);
        return matchesCategory && matchesText;
      }),
    [categoria, deferredSearch, snapshot.servicios],
  );

  const destacados = useMemo(
    () => snapshot.servicios.filter((item) => item.destacado_pct).slice(0, 3),
    [snapshot.servicios],
  );

  const profesionales = useMemo(
    () => snapshot.profesionales.filter((item) => item.sucursal_id === bookingSucursalId),
    [bookingSucursalId, snapshot.profesionales],
  );

  const servicioSeleccionado = useMemo(
    () => snapshot.servicios.find((item) => item.id === servicioId) ?? null,
    [servicioId, snapshot.servicios],
  );

  const profesionalSeleccionado =
    profesionales.find((item) => item.empleado_id === profesionalId) ?? null;

  const fechasDisponibles = useMemo(
    () =>
      bookingSucursalId
        ? listOpenDatesForSucursal(snapshot.horarios, bookingSucursalId, 6)
        : [],
    [bookingSucursalId, snapshot.horarios],
  );

  const slots = useMemo(() => {
    if (!servicioSeleccionado || !fechaTurno || !profesionalId || !bookingSucursalId) {
      return [];
    }

    return buildAvailableSlots({
      fecha: fechaTurno,
      sucursalId: bookingSucursalId,
      servicioId: servicioSeleccionado.id,
      profesionalId: profesionalId === "any" ? undefined : profesionalId,
      horarios: snapshot.horarios,
      profesionales: snapshot.profesionales,
      servicios: snapshot.servicios,
      turnos: snapshot.turnos,
    });
  }, [
    bookingSucursalId,
    fechaTurno,
    profesionalId,
    servicioSeleccionado,
    snapshot.horarios,
    snapshot.profesionales,
    snapshot.servicios,
    snapshot.turnos,
  ]);

  const selectedSlot =
    slots.find((item) => `${item.profesional_id}-${item.hora}` === slotKey) ?? null;

  const currentStep = state?.ok
    ? 7
    : !bookingSucursalId
      ? 1
      : !servicioId
        ? 2
        : !profesionalId
          ? 3
          : !fechaTurno
            ? 4
            : !selectedSlot
              ? 5
              : 6;

  const currentStepMeta = getStepMeta(currentStep);

  function resetBooking(keepSucursal = false) {
    setSearch("");
    setCategoria("TODOS");
    setServicioId("");
    setProfesionalId("");
    setFechaTurno("");
    setSlotKey("");
    if (!keepSucursal) {
      setBookingSucursalId("");
    }
  }

  function openBooking(nextSucursalId?: string, nextServicioId?: string) {
    if (nextSucursalId) {
      setBookingSucursalId(nextSucursalId);
      setFeaturedSucursalId(nextSucursalId);
      resetBooking(true);
      setBookingSucursalId(nextSucursalId);
    }
    if (nextServicioId) {
      setServicioId(nextServicioId);
      setProfesionalId("");
      setFechaTurno("");
      setSlotKey("");
    }
    setModalOpen(true);
  }

  function closeBooking() {
    setModalOpen(false);
  }

  function handleSucursalChange(nextSucursalId: string) {
    setBookingSucursalId(nextSucursalId);
    setFeaturedSucursalId(nextSucursalId);
    setServicioId("");
    setProfesionalId("");
    setFechaTurno("");
    setSlotKey("");
  }

  function handleServicioChange(nextServicioId: string) {
    setServicioId(nextServicioId);
    setProfesionalId("");
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

  function goBack() {
    if (state?.ok) return;
    if (currentStep === 6) {
      setSlotKey("");
      return;
    }
    if (currentStep === 5) {
      setFechaTurno("");
      return;
    }
    if (currentStep === 4) {
      setProfesionalId("");
      return;
    }
    if (currentStep === 3) {
      setServicioId("");
      return;
    }
    if (currentStep === 2) {
      setBookingSucursalId("");
    }
  }

  const heroStats = [
    { value: "4.9", label: "valoracion promedio" },
    { value: "2", label: "sucursales" },
    { value: "+10", label: "servicios destacados" },
  ];

  const beneficios = [
    {
      title: "Atencion personalizada",
      text: "Cada visita se piensa con tiempo, detalle y una propuesta que se adapta a tu estilo.",
    },
    {
      title: "Equipo de confianza",
      text: "Profesionales con especialidades claras para ayudarte a elegir con tranquilidad.",
    },
    {
      title: "Reserva simple",
      text: "Elegi sucursal, servicio y horario desde una experiencia clara y comoda.",
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f4ece4_0%,transparent_28%),radial-gradient(circle_at_top_right,#eef4eb_0%,transparent_20%),linear-gradient(180deg,#faf8f4_0%,#ffffff_48%,#f4f1ea_100%)] text-foreground">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-40">
          <div className="rounded-full border border-white/70 bg-white/88 px-4 py-3 shadow-[0_14px_40px_rgba(44,53,37,0.08)] backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo-malala.png"
                  alt="Logo MALALA"
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full border border-stone-100 object-cover"
                />
                <div>
                  <p className="font-display text-xl uppercase tracking-[0.28em] text-ink">MALALA</p>
                  <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">
                    Club de belleza
                  </p>
                </div>
              </div>

              <nav className="hidden items-center gap-6 text-sm text-stone-700 lg:flex">
                <a href="#servicios" className="transition hover:text-ink">Servicios</a>
                <a href="#sucursales" className="transition hover:text-ink">Sucursales</a>
                <a href="#contacto" className="transition hover:text-ink">Contacto</a>
                <a href={storeUrl} target="_blank" rel="noreferrer" className="transition hover:text-ink">
                  Tienda online
                </a>
              </nav>

              <div className="flex items-center gap-2">
                {loggedInLabel ? (
                  <a
                    href="/dashboard"
                    className="hidden rounded-full border border-sage-200 bg-sage-50 px-4 py-2 text-sm font-medium text-sage-900 transition hover:bg-sage-100 sm:inline-flex"
                  >
                    {loggedInLabel}
                  </a>
                ) : (
                  <a
                    href="/dev/login"
                    className="hidden rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-sage-200 hover:text-foreground sm:inline-flex"
                  >
                    Acceso interno
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => openBooking()}
                  className="inline-flex items-center gap-2 rounded-full bg-sage-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sage-700"
                >
                  Reserva tu turno
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <HeroVideoShowcase
          onReserve={() => openBooking()}
          whatsappUrl={whatsappUrl}
          storeUrl={storeUrl}
          heroStats={heroStats}
        />

        <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[2rem] border border-white/70 bg-[#f6efe8] p-6 shadow-[0_20px_60px_rgba(44,53,37,0.05)]">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Nuestra experiencia</p>
            <h2 className="mt-3 text-3xl font-semibold text-ink">Un lugar pensado para disfrutar tu momento</h2>
            <p className="mt-4 text-sm leading-7 text-stone-700 sm:text-base">
              En MALALA queremos que cada visita se sienta cuidada desde el primer momento. Por eso unimos atencion personalizada, servicios elegidos con detalle y una forma comoda de reservar.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openBooking()}
                className="inline-flex items-center gap-2 rounded-full bg-sage-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sage-700"
              >
                Reserva tu turno
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-sage-200"
              >
                Hablar por WhatsApp
                <Phone className="h-4 w-4 text-sage-700" />
              </a>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {beneficios.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.75rem] border border-white/70 bg-white/88 p-5 shadow-[0_16px_50px_rgba(44,53,37,0.05)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sage-50 text-sage-900">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="servicios" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Servicios destacados</p>
              <h2 className="text-3xl font-semibold text-ink">Elige la experiencia que mejor acompana tu momento</h2>
            </div>
            <button
              type="button"
              onClick={() => openBooking()}
              className="inline-flex items-center gap-2 rounded-full border border-sage-200 bg-sage-50 px-5 py-3 text-sm font-semibold text-sage-900 transition hover:bg-sage-100"
            >
              Reserva tu turno
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {destacados.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openBooking(undefined, item.id)}
                className="relative overflow-hidden rounded-[1.8rem] border border-stone-100 bg-white p-5 text-left shadow-[0_14px_45px_rgba(44,53,37,0.04)] transition hover:border-sage-200 hover:bg-sage-50/40"
              >
                <span className="absolute right-0 top-0 rounded-bl-2xl bg-[#e53b2d] px-3 py-1 text-xs font-semibold text-white">
                  {item.destacado_pct}% OFF
                </span>
                <div className="space-y-3">
                  <p className="text-lg font-semibold text-ink">{item.nombre}</p>
                  <p className="text-sm leading-6 text-stone-700">{item.descripcion_corta}</p>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
                    <span className="font-semibold text-ink">Desde {formatARS(item.precio_efectivo)}</span>
                    <span className="line-through text-stone-400">{formatARS(item.precio_lista)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-4 w-4 text-sage-700" />
                      {item.duracion_min} min
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section
          id="sucursales"
          className="space-y-6 rounded-[2.2rem] border border-white/70 bg-white/88 p-6 shadow-[0_20px_60px_rgba(44,53,37,0.06)]"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Nuestras sucursales</p>
              <h2 className="text-3xl font-semibold text-ink">Elige el espacio que te resulte mas comodo</h2>
            </div>
            <button
              type="button"
              onClick={() => openBooking()}
              className="inline-flex items-center gap-2 rounded-full bg-sage-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sage-700"
            >
              Quiero mi cita
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {snapshot.sucursales.map((item, index) => {
              const active = item.id === featuredSucursalId;
              return (
                <article
                  key={item.id}
                  className={cn(
                    "overflow-hidden rounded-[1.8rem] border transition",
                    active
                      ? "border-sage-300 bg-sage-50/70 shadow-[0_16px_50px_rgba(44,53,37,0.08)]"
                      : "border-stone-100 bg-white",
                  )}
                >
                  <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="border-b border-stone-100 bg-[linear-gradient(155deg,#f8f3ea_0%,#fff_42%,#edf2e9_100%)] p-5 lg:border-b-0 lg:border-r">
                      <div className="space-y-4">
                        <span className="inline-flex rounded-full border border-stone-200 bg-white/90 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                          Sucursal {index + 1}
                        </span>
                        <div>
                          <h3 className="text-2xl font-semibold text-ink">{item.nombre}</h3>
                          <p className="mt-2 text-sm leading-6 text-stone-700">{item.descripcion_corta}</p>
                        </div>
                        <div className="space-y-3 text-sm text-stone-700">
                          <p className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 text-sage-700" />
                            <span>{item.direccion}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-sage-700" />
                            <span>{item.telefono}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Star className="h-4 w-4 fill-current text-[#c69b4e]" />
                            <span>{item.rating?.toFixed(1)} · {item.reviews} reseñas</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-4 p-5">
                      <div className="overflow-hidden rounded-[1.35rem] border border-stone-100">
                        <Image
                          src={index % 2 === 0 ? "/landing-service-editorial.svg" : "/landing-shop-editorial.svg"}
                          alt={`Visual de ${item.nombre}`}
                          width={920}
                          height={1100}
                          className="h-56 w-full object-cover"
                        />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setFeaturedSucursalId(item.id);
                            openBooking(item.id);
                          }}
                          className="inline-flex items-center gap-2 rounded-full bg-sage-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sage-700"
                        >
                          Reserva aqui
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeaturedSucursalId(item.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:border-sage-200 hover:bg-sage-50"
                        >
                          Ver destacada
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="contacto" className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 shadow-[0_20px_60px_rgba(44,53,37,0.06)]">
            <iframe
              src={mapEmbedUrl}
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: 420 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Mapa de MALALA"
            />
          </div>

          <div className="space-y-4 rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_20px_60px_rgba(44,53,37,0.06)]">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Contacto y ubicacion</p>
            <h2 className="text-3xl font-semibold text-ink">Estamos cerca para acompanarte</h2>
            <p className="text-sm leading-7 text-stone-700 sm:text-base">
              Puedes encontrarnos, escribirnos o reservar desde aqui. Queremos que llegar a MALALA sea tan simple como disfrutarlo.
            </p>

            <div className="space-y-3 rounded-[1.5rem] border border-stone-100 bg-cream/55 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-4 w-4 text-sage-700" />
                <div>
                  <p className="font-medium text-ink">Corrientes 1677, San Miguel de Tucuman</p>
                  <p className="text-sm text-stone-700">Ubicacion principal de referencia de MALALA.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-stone-700">
                <Phone className="h-4 w-4 text-sage-700" />
                <span>+54 9 381 239-3260</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-stone-700">
                <Clock3 className="h-4 w-4 text-sage-700" />
                <span>{featuredSucursal?.horario_resumen}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-sage-200 bg-sage-50 px-5 py-3 text-sm font-semibold text-sage-900 transition hover:bg-sage-100"
              >
                WhatsApp
                <MessageCircle className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => openBooking()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sage-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sage-700"
              >
                Reserva tu turno
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {modalOpen ? (
        <BookingModal
          currentStep={currentStep}
          currentStepMeta={currentStepMeta}
          state={state}
          pending={pending}
          formAction={formAction}
          sucursales={snapshot.sucursales}
          sucursalId={bookingSucursalId}
          onSucursalChange={handleSucursalChange}
          categorias={categorias}
          categoria={categoria}
          onCategoriaChange={setCategoria}
          search={search}
          onSearchChange={setSearch}
          servicios={servicios}
          servicioId={servicioId}
          onServicioChange={handleServicioChange}
          profesionales={profesionales}
          profesionalId={profesionalId}
          onProfesionalChange={handleProfesionalChange}
          fechasDisponibles={fechasDisponibles}
          fechaTurno={fechaTurno}
          onFechaChange={handleFechaChange}
          slotKey={slotKey}
          onSlotChange={setSlotKey}
          slots={slots}
          selectedSlot={selectedSlot}
          sucursal={bookingSucursal}
          servicio={servicioSeleccionado}
          profesional={profesionalSeleccionado}
          onClose={closeBooking}
          onBack={goBack}
          onResetStep={(step) => {
            if (step <= 1) {
              setBookingSucursalId("");
              resetBooking();
              return;
            }
            if (step === 2) {
              setServicioId("");
              setProfesionalId("");
              setFechaTurno("");
              setSlotKey("");
              return;
            }
            if (step === 3) {
              setProfesionalId("");
              setFechaTurno("");
              setSlotKey("");
              return;
            }
            if (step === 4) {
              setFechaTurno("");
              setSlotKey("");
              return;
            }
            if (step === 5) {
              setSlotKey("");
            }
          }}
        />
      ) : null}

      {!modalOpen ? (
        <button
          type="button"
          onClick={() => openBooking()}
          className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-center rounded-full bg-sage-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(44,53,37,0.28)] transition hover:bg-sage-700 lg:hidden"
        >
          Reserva tu turno
        </button>
      ) : null}
    </div>
  );
}
interface BookingModalProps {
  currentStep: number;
  currentStepMeta: { title: string; text: string };
  state: ActionState;
  pending: boolean;
  formAction: (payload: FormData) => void;
  sucursales: Sucursal[];
  sucursalId: string;
  onSucursalChange: (value: string) => void;
  categorias: string[];
  categoria: string;
  onCategoriaChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  servicios: Servicio[];
  servicioId: string;
  onServicioChange: (value: string) => void;
  profesionales: ProfesionalReserva[];
  profesionalId: string;
  onProfesionalChange: (value: string) => void;
  fechasDisponibles: string[];
  fechaTurno: string;
  onFechaChange: (value: string) => void;
  slotKey: string;
  onSlotChange: (value: string) => void;
  slots: ReturnType<typeof buildAvailableSlots>;
  selectedSlot: ReturnType<typeof buildAvailableSlots>[number] | null;
  sucursal: Sucursal | null;
  servicio: Servicio | null;
  profesional: ProfesionalReserva | null;
  onClose: () => void;
  onBack: () => void;
  onResetStep: (step: number) => void;
}

function BookingModal({
  currentStep,
  currentStepMeta,
  state,
  pending,
  formAction,
  sucursales,
  sucursalId,
  onSucursalChange,
  categorias,
  categoria,
  onCategoriaChange,
  search,
  onSearchChange,
  servicios,
  servicioId,
  onServicioChange,
  profesionales,
  profesionalId,
  onProfesionalChange,
  fechasDisponibles,
  fechaTurno,
  onFechaChange,
  slotKey,
  onSlotChange,
  slots,
  selectedSlot,
  sucursal,
  servicio,
  profesional,
  onClose,
  onBack,
  onResetStep,
}: BookingModalProps) {
  const progress = Math.min((currentStep / TOTAL_STEPS) * 100, 100);
  const canGoBack = currentStep > 1 && !state?.ok;
  const canSubmit = Boolean(selectedSlot);
  const showReview = currentStep >= 6 || Boolean(state?.ok);

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]">
      <div className="absolute inset-x-0 bottom-0 top-10 overflow-hidden rounded-t-[2rem] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.18)] lg:left-1/2 lg:top-1/2 lg:h-[min(920px,94vh)] lg:w-[min(920px,94vw)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[2rem]">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="sticky top-0 z-10 border-b border-stone-100 bg-white/96 px-5 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Reserva tu turno
                </p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {currentStepMeta.title}
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-sage-700 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canGoBack ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm text-stone-700 transition hover:border-sage-200 hover:bg-sage-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Volver
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-border bg-white p-2 text-muted-foreground shadow-sm transition hover:border-sage-200 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <form
            action={formAction}
            className="flex-1 overflow-y-auto"
          >
            <input type="hidden" name="sucursal_id" value={sucursalId} />
            <input type="hidden" name="servicio_id" value={servicioId} />
            <input
              type="hidden"
              name="profesional_id"
              value={
                selectedSlot?.profesional_id ??
                (profesionalId === "any" ? "" : profesionalId)
              }
            />
            <input type="hidden" name="fecha_turno" value={fechaTurno} />
            <input type="hidden" name="hora" value={selectedSlot?.hora ?? ""} />
            <input
              type="hidden"
              name="sin_preferencia"
              value={String(profesionalId === "any")}
            />
            <input type="hidden" name="canal" value="web" />
            <input type="hidden" name="origen" value="publico" />

            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-5 sm:p-6 lg:px-8 lg:py-7">
              {state?.ok ? (
                <ModalStep title={currentStepMeta.title} text={currentStepMeta.text}>
                  <div className="space-y-4">
                    <div className="rounded-[1.4rem] border border-sage-200 bg-sage-50 px-4 py-4 text-sm text-sage-900">
                      <p className="font-medium">{state.message}</p>
                      <p className="mt-2">
                        {sucursal?.nombre} · {servicio?.nombre} · {selectedSlot?.hora} con{" "}
                        {selectedSlot?.profesional_nombre}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <SummaryLine label="Sucursal" value={sucursal?.nombre ?? "-"} />
                      <SummaryLine label="Servicio" value={servicio?.nombre ?? "-"} />
                      <SummaryLine
                        label="Profesional"
                        value={
                          profesionalId === "any"
                            ? "Sin preferencia"
                            : profesional?.empleado.nombre ?? "-"
                        }
                      />
                      <SummaryLine
                        label="Fecha y hora"
                        value={
                          selectedSlot
                            ? `${new Date(`${fechaTurno}T12:00:00`).toLocaleDateString(
                                "es-AR",
                                {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                },
                              )} · ${selectedSlot.hora}`
                            : "-"
                        }
                      />
                    </div>
                  </div>
                </ModalStep>
              ) : (
                <ModalStep title={currentStepMeta.title} text={currentStepMeta.text}>
                  {renderStepContent({
                    currentStep,
                    sucursales,
                    sucursalId,
                    onSucursalChange,
                    categorias,
                    categoria,
                    onCategoriaChange,
                    search,
                    onSearchChange,
                    servicios,
                    servicioId,
                    onServicioChange,
                    profesionales,
                    profesionalId,
                    onProfesionalChange,
                    fechasDisponibles,
                    fechaTurno,
                    onFechaChange,
                    slots,
                    slotKey,
                    onSlotChange,
                  })}
                </ModalStep>
              )}

              {showReview && !state?.ok ? (
                <section className="space-y-4 rounded-[1.8rem] border border-stone-100 bg-[linear-gradient(160deg,#f7f4ee_0%,#fff_40%,#eef3ec_100%)] p-5 shadow-[0_14px_40px_rgba(44,53,37,0.05)]">
                  <div className="space-y-2 border-b border-stone-100 pb-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                      Revisa tu reserva
                    </p>
                    <h3 className="text-2xl font-semibold text-ink">
                      {servicio?.nombre ?? "Tu reserva"}
                    </h3>
                    <p className="text-sm text-stone-700">
                      {servicio
                        ? `${servicio.duracion_min} min · desde ${formatARS(servicio.precio_efectivo)}`
                        : "Estas a un paso de confirmar tu cita."}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <SummaryLine
                      label="Sucursal"
                      value={sucursal?.nombre ?? "Elige una sucursal"}
                      editable={Boolean(sucursalId)}
                      onEdit={() => onResetStep(1)}
                    />
                    <SummaryLine
                      label="Servicio"
                      value={servicio?.nombre ?? "Elige un servicio"}
                      editable={Boolean(servicioId)}
                      onEdit={() => onResetStep(2)}
                    />
                    <SummaryLine
                      label="Profesional"
                      value={
                        profesionalId === "any"
                          ? "Sin preferencia"
                          : profesional?.empleado.nombre ?? "Elige profesional"
                      }
                      editable={Boolean(profesionalId)}
                      onEdit={() => onResetStep(3)}
                    />
                    <SummaryLine
                      label="Fecha"
                      value={
                        fechaTurno
                          ? new Date(`${fechaTurno}T12:00:00`).toLocaleDateString(
                              "es-AR",
                              {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              },
                            )
                          : "Elige una fecha"
                      }
                      editable={Boolean(fechaTurno)}
                      onEdit={() => onResetStep(4)}
                    />
                    <SummaryLine
                      label="Horario"
                      value={
                        selectedSlot
                          ? `${selectedSlot.hora} · ${selectedSlot.profesional_nombre}`
                          : "Elige un horario"
                      }
                      editable={Boolean(selectedSlot)}
                      onEdit={() => onResetStep(5)}
                    />
                  </div>
                </section>
              ) : null}

              {state && !state.ok ? (
                <div className="rounded-[1.35rem] border border-[#f2c4bd] bg-[#fff1ef] px-4 py-3 text-sm text-[#8a3b31]">
                  {Object.values(state.errors).flat()[0]}
                </div>
              ) : null}

              {currentStep >= 6 && !state?.ok ? (
                <button
                  type="submit"
                  disabled={!canSubmit || pending}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-sage-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Reservando..." : "Confirmar turno"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function renderStepContent(args: {
  currentStep: number;
  sucursales: Sucursal[];
  sucursalId: string;
  onSucursalChange: (value: string) => void;
  categorias: string[];
  categoria: string;
  onCategoriaChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  servicios: Servicio[];
  servicioId: string;
  onServicioChange: (value: string) => void;
  profesionales: ProfesionalReserva[];
  profesionalId: string;
  onProfesionalChange: (value: string) => void;
  fechasDisponibles: string[];
  fechaTurno: string;
  onFechaChange: (value: string) => void;
  slots: ReturnType<typeof buildAvailableSlots>;
  slotKey: string;
  onSlotChange: (value: string) => void;
}) {
  if (args.currentStep === 1) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {args.sucursales.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => args.onSucursalChange(item.id)}
            className={cn(
              "rounded-[1.4rem] border px-4 py-4 text-left transition",
              args.sucursalId === item.id
                ? "border-sage-300 bg-sage-50"
                : "border-stone-100 bg-white hover:border-sage-100 hover:bg-sage-50/40",
            )}
          >
            <p className="text-lg font-semibold text-ink">{item.nombre}</p>
            <p className="mt-2 text-sm leading-6 text-stone-700">{item.direccion}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {item.horario_resumen}
            </p>
          </button>
        ))}
      </div>
    );
  }

  if (args.currentStep === 2) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={args.search}
            onChange={(event) => args.onSearchChange(event.target.value)}
            placeholder="Buscar servicio..."
            className="w-full rounded-full border border-stone-200 bg-white px-11 py-3 text-sm outline-none transition focus:border-sage-300"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {args.categorias.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => args.onCategoriaChange(item)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition",
                args.categoria === item
                  ? "border-sage-700 bg-sage-700 text-white"
                  : "border-stone-200 bg-white text-foreground hover:border-sage-200 hover:bg-sage-50",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {args.servicios.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => args.onServicioChange(item.id)}
              className={cn(
                "relative overflow-hidden rounded-[1.35rem] border p-4 text-left transition",
                args.servicioId === item.id
                  ? "border-sage-300 bg-sage-50 shadow-sm"
                  : "border-stone-100 bg-white hover:border-sage-100 hover:bg-sage-50/40",
              )}
            >
              {item.destacado_pct ? (
                <span className="absolute right-0 top-0 rounded-bl-2xl bg-[#e53b2d] px-3 py-1 text-xs font-semibold text-white">
                  {item.destacado_pct}% OFF
                </span>
              ) : null}
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-semibold text-ink">{item.nombre}</p>
                  <p className="mt-1 text-sm text-stone-700">
                    {item.descripcion_corta}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
                  <span className="font-semibold text-ink">
                    Desde {formatARS(item.precio_efectivo)}
                  </span>
                  <span className="line-through text-stone-400">
                    {formatARS(item.precio_lista)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-4 w-4 text-sage-700" />
                    {item.duracion_min} min
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (args.currentStep === 3) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => args.onProfesionalChange("any")}
          className={cn(
            "flex w-full items-center justify-between rounded-[1.35rem] border px-4 py-4 text-left transition",
            args.profesionalId === "any"
              ? "border-sage-300 bg-sage-50"
              : "border-stone-100 bg-white hover:border-sage-100 hover:bg-sage-50/40",
          )}
        >
          <span className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage-50 text-sage-900">
              <WandSparkles className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-medium text-ink">Sin preferencia</span>
              <span className="block text-sm text-stone-700">
                Te mostramos la mejor disponibilidad
              </span>
            </span>
          </span>
          {args.profesionalId === "any" ? (
            <Check className="h-4 w-4 text-sage-700" />
          ) : null}
        </button>

        <div className="grid gap-3 md:grid-cols-2">
          {args.profesionales.map((prof) => (
            <button
              key={prof.id}
              type="button"
              onClick={() => args.onProfesionalChange(prof.empleado_id)}
              className={cn(
                "rounded-[1.35rem] border px-4 py-4 text-left transition",
                args.profesionalId === prof.empleado_id
                  ? "border-sage-300 bg-sage-50"
                  : "border-stone-100 bg-white hover:border-sage-100 hover:bg-sage-50/40",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: prof.color }}
                >
                  {prof.empleado.nombre
                    .split(" ")
                    .map((item) => item[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>
                  <span className="block font-medium text-ink">
                    {prof.empleado.nombre}
                  </span>
                  <span className="block text-sm text-stone-700">
                    {prof.especialidad}
                  </span>
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-700">{prof.bio}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (args.currentStep === 4) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {args.fechasDisponibles.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => args.onFechaChange(item)}
            className={cn(
              "rounded-[1.35rem] border px-4 py-4 text-left transition",
              args.fechaTurno === item
                ? "border-sage-300 bg-sage-50"
                : "border-stone-100 bg-white hover:border-sage-100 hover:bg-sage-50/40",
            )}
          >
            <span className="block text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
              Disponible
            </span>
            <span className="mt-2 block text-sm font-medium capitalize text-ink">
              {new Date(`${item}T12:00:00`).toLocaleDateString("es-AR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (args.currentStep === 5) {
    if (args.slots.length === 0) {
      return (
        <div className="rounded-[1.35rem] border border-dashed border-stone-200 bg-cream/60 px-4 py-5 text-sm text-stone-700">
          No encontramos horarios para esa combinacion. Puedes volver y cambiar
          profesional o fecha.
        </div>
      );
    }

    return (
      <div className="grid gap-2">
        {args.slots.map((slot) => (
          <button
            key={`${slot.profesional_id}-${slot.hora}`}
            type="button"
            onClick={() => args.onSlotChange(`${slot.profesional_id}-${slot.hora}`)}
            className={cn(
              "rounded-[1.35rem] border px-4 py-3 text-left transition",
              args.slotKey === `${slot.profesional_id}-${slot.hora}`
                ? "border-sage-300 bg-sage-50"
                : "border-stone-100 bg-white hover:border-sage-100 hover:bg-sage-50/40",
            )}
          >
            <span className="block text-base font-medium text-ink">
              {slot.hora} con {slot.profesional_nombre}
            </span>
            <span className="text-xs text-stone-600">
              {args.profesionalId === "any"
                ? "Horario sugerido por disponibilidad"
                : "Horario disponible para tu seleccion"}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (args.currentStep === 6) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm md:col-span-2">
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
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-stone-700">Observaciones (opcional)</span>
          <textarea
            name="observacion"
            rows={3}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 outline-none focus:border-sage-300"
          />
        </label>
      </div>
    );
  }

  return null;
}

function ModalStep({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[1.8rem] border border-stone-100 bg-white p-5 shadow-[0_14px_40px_rgba(44,53,37,0.05)]">
      <div className="space-y-1">
        <h3 className="text-2xl font-semibold text-ink">{title}</h3>
        <p className="text-sm leading-6 text-stone-700">{text}</p>
      </div>
      {children}
    </section>
  );
}

function SummaryLine({
  label,
  value,
  editable,
  onEdit,
}: {
  label: string;
  value: string;
  editable?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="rounded-[1.25rem] border border-stone-100 bg-white/78 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          {label}
        </p>
        {editable && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium uppercase tracking-[0.2em] text-sage-900 transition hover:text-sage-700"
          >
            Cambiar
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function getStepMeta(step: number) {
  switch (step) {
    case 1:
      return {
        title: "Elige la sucursal",
        text: "Selecciona la sede que te resulte mas comoda para empezar tu reserva.",
      };
    case 2:
      return {
        title: "Tu servicio",
        text: "Recorre las categorias y elige el servicio que mejor acompane tu idea.",
      };
    case 3:
      return {
        title: "Elige profesional",
        text: "Puedes elegir alguien del equipo o dejar que te sugiramos la mejor disponibilidad.",
      };
    case 4:
      return {
        title: "Elige la fecha",
        text: "Te mostramos las proximas fechas abiertas para la sucursal seleccionada.",
      };
    case 5:
      return {
        title: "Elige el horario",
        text: "Los horarios cambian segun el servicio y la disponibilidad del equipo.",
      };
    case 6:
      return {
        title: "Completa tus datos",
        text: "Ya casi terminamos. Solo necesitamos tus datos para confirmar la reserva.",
      };
    default:
      return {
        title: "Reserva confirmada",
        text: "Tu turno ya quedo registrado en la maqueta.",
      };
  }
}
