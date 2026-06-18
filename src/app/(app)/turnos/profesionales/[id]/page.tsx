import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { isSucursalAllowed, buildAccessScope } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import {
  addProfesionalHorario,
  deleteProfesionalHorario,
  getProfesionalAgendaConfig,
  listProfesionalHorarios,
} from "@/lib/data/profesionales-horarios";

const DIAS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" },
];

const DIA_LABEL: Record<number, string> = Object.fromEntries(
  DIAS.map((d) => [d.value, d.label]),
);

export default async function ProfesionalAgendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "admin" && user.rol !== "encargada" && user.rol !== "superadmin") {
    redirect("/turnos");
  }

  const { id } = await params;
  const agenda = await getProfesionalAgendaConfig(id);
  if (!agenda) notFound();

  const scope = buildAccessScope(user);
  if (!isSucursalAllowed(scope, agenda.sucursal_id)) {
    redirect("/turnos");
  }

  const horarios = await listProfesionalHorarios(
    agenda.empleado_id,
    agenda.sucursal_id,
  );

  async function addHorario(formData: FormData) {
    "use server";
    await addProfesionalHorario(id, formData);
  }

  async function delHorario(formData: FormData) {
    "use server";
    await deleteProfesionalHorario(id, String(formData.get("id") ?? ""));
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-2">
        <Link
          href="/turnos"
          className="inline-flex text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Volver a turnos
        </Link>
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Disponibilidad publica
          </h1>
          <p className="text-sm text-muted-foreground">
            {agenda.empleado_nombre} · {agenda.sucursal_nombre}
          </p>
          <p className="text-xs text-muted-foreground">
            Si no cargas franjas, este profesional usa solo horario de sucursal y servicio.
          </p>
        </div>
      </header>

      <section className="rounded-md border border-border bg-card p-5">
        <dl className="grid gap-4 sm:grid-cols-2 text-sm">
          <Dato label="Profesional" value={agenda.empleado_nombre} />
          <Dato label="Sucursal" value={agenda.sucursal_nombre} />
          <Dato label="Especialidad" value={agenda.especialidad} />
          <Dato
            label="Reserva publica"
            value={agenda.activo_publico ? "Activa" : "Oculta"}
          />
        </dl>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="space-y-1">
          <h2 className="font-display text-xl tracking-[0.15em] uppercase">
            Franjas semanales
          </h2>
          <p className="text-xs text-muted-foreground">
            Se combinan por interseccion con la disponibilidad del servicio y el horario de la sucursal.
          </p>
        </div>

        {horarios.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
            Sin restriccion adicional para este profesional en esta sucursal.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
            {horarios.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span>
                  <span className="font-medium">{DIA_LABEL[h.dia_semana]}</span>
                  <span className="ml-2 tabular-nums text-muted-foreground">
                    {h.apertura} - {h.cierre}
                  </span>
                </span>
                <form action={delHorario}>
                  <input type="hidden" name="id" value={h.id} />
                  <button
                    type="submit"
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Quitar franja"
                  >
                    <Trash2 className="h-4 w-4 stroke-[1.5]" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addHorario}
          className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-4"
        >
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Dia
            </label>
            <select
              name="dia_semana"
              required
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              {DIAS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Desde
            </label>
            <input
              type="time"
              name="apertura"
              required
              defaultValue="10:00"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Hasta
            </label>
            <input
              type="time"
              name="cierre"
              required
              defaultValue="18:00"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700"
          >
            Agregar franja
          </button>
        </form>
      </section>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
