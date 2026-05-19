import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTurnoPorToken } from "@/lib/data/turnos-publico";
import { TurnoAcciones } from "./turno-acciones";

export const metadata: Metadata = {
  title: "MALALA — Tu turno",
  description: "Gestioná tu reserva en MALALA.",
};

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

const formatFecha = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const estadoLabel: Record<string, string> = {
  pendiente: "Pendiente de confirmación",
  confirmado: "Confirmado",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
  ausente: "No asististe",
};

export default async function TurnoPublicPage({ params }: Props) {
  const { token } = await params;
  const result = await getTurnoPorToken(token);

  if (result.status === "no_encontrado") {
    notFound();
  }

  const { detalle } = result;
  const bloqueado = result.status === "ok_bloqueado";

  return (
    <main className="min-h-full bg-background px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-8 text-center">
          <p className="font-display text-xs tracking-[0.3em] text-muted-foreground">
            MALALA
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Tu turno</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {detalle.sucursal?.nombre ?? "Sucursal"}
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <dl className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="font-medium text-ink">{detalle.cliente_nombre}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Servicio</dt>
              <dd className="font-medium text-ink">
                {detalle.servicio?.nombre ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Profesional</dt>
              <dd className="font-medium text-ink">
                {detalle.profesional?.empleado.nombre ?? "Sin asignar"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="font-medium text-ink">
                {formatFecha(detalle.fecha_turno)} · {detalle.hora}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Duración</dt>
              <dd className="font-medium text-ink">{detalle.duracion_min} min</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Estado</dt>
              <dd className="font-medium text-ink">
                {estadoLabel[detalle.estado] ?? detalle.estado}
              </dd>
            </div>
          </dl>
        </section>

        {bloqueado ? (
          <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
            {result.motivo === "expirado"
              ? "Este link ya expiró. Si necesitás cambiar tu turno comunicate con la sucursal."
              : "Este turno ya no se puede modificar desde el link. Si necesitás algo, comunicate con la sucursal."}
          </div>
        ) : (
          <TurnoAcciones
            token={token}
            turnoId={detalle.id}
            sucursalId={detalle.sucursal_id}
            servicioId={detalle.servicio_id}
            profesionalActualId={detalle.profesional_id}
            profesionalActualNombre={
              detalle.profesional?.empleado.nombre ?? "Sin asignar"
            }
          />
        )}

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          ¿Dudas? Escribinos al WhatsApp de la sucursal.
        </footer>
      </div>
    </main>
  );
}
