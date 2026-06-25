import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/forms/field";
import { requireUser } from "@/lib/auth/session";
import { buildAccessScope, esAdmin, isSucursalAllowed } from "@/lib/auth/access";
import { getSucursal } from "@/lib/data/sucursales";
import {
  addSucursalHorario,
  deleteSucursalHorario,
  listSucursalHorarios,
} from "@/lib/data/sucursales-horarios";

const DIAS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const DIA_LABEL: Record<number, string> = Object.fromEntries(
  DIAS.map((d) => [d.value, d.label]),
);

export default async function EditarHorariosSucursalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!esAdmin(user.rol) && user.rol !== "encargada") {
    redirect("/catalogos");
  }

  const { id } = await params;
  // Aislamiento por sucursal: no se puede abrir el editor de una sede ajena.
  const scope = buildAccessScope(user);
  if (!isSucursalAllowed(scope, id)) {
    redirect("/catalogos/sucursales");
  }

  const [sucursal, horarios] = await Promise.all([
    getSucursal(id),
    listSucursalHorarios(id),
  ]);
  if (!sucursal) notFound();

  async function addHorario(formData: FormData) {
    "use server";
    await addSucursalHorario(id, formData);
  }

  async function delHorario(formData: FormData) {
    "use server";
    await deleteSucursalHorario(String(formData.get("id") ?? ""));
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <Link
        href="/catalogos/sucursales"
        className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
        Sucursales
      </Link>

      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Horarios de atención
        </h1>
        <p className="text-sm text-muted-foreground">{sucursal.nombre}</p>
      </header>

      <section className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Días y franjas en que la sucursal atiende. Es lo que define qué fechas
          y horas se ofrecen al reservar online. Podés cargar más de una franja
          por día (por ejemplo, mañana y tarde con corte al mediodía).
        </p>

        {horarios.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Esta sucursal no tiene horarios cargados, por lo que no ofrece turnos
            online. Agregá al menos una franja para habilitar la reserva.
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
                    {h.apertura} – {h.cierre}
                  </span>
                </span>
                <form action={delHorario}>
                  <input type="hidden" name="id" value={h.id} />
                  <SubmitButton
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Quitar franja"
                  >
                    <Trash2 className="h-4 w-4 stroke-[1.5]" />
                  </SubmitButton>
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
              Día
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
              defaultValue="19:00"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <SubmitButton
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700"
            pendingLabel="Agregando..."
          >
            Agregar franja
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
