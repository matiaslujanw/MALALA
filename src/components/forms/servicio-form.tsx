"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActionStateFeedback } from "@/components/feedback/action-feedback";
import { CurrencyField, LoadingButton } from "./field";
import type { Servicio } from "@/lib/types";
import type { ActionResult } from "@/lib/data/servicios";

interface Props {
  servicio?: Servicio;
  rubros?: string[];
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  submitLabel: string;
}

const NUEVO = "__nuevo__";

export function ServicioForm({
  servicio,
  rubros = [],
  action,
  submitLabel,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionStateFeedback(action, {
    redirectTo: "/catalogos/servicios",
    successMessage: servicio ? "Servicio actualizado" : "Servicio creado",
  });

  const errors = state && !state.ok ? state.errors : {};
  const opciones = Array.from(
    new Set([...rubros, ...(servicio?.rubro ? [servicio.rubro] : [])]),
  ).sort((a, b) => a.localeCompare(b));

  const sinRubros = opciones.length === 0;
  const [seleccion, setSeleccion] = useState(
    sinRubros ? NUEVO : (servicio?.rubro ?? ""),
  );
  const [nuevoRubro, setNuevoRubro] = useState("");
  const esNuevo = seleccion === NUEVO;
  const rubroFinal = esNuevo ? nuevoRubro : seleccion;

  return (
    <form action={formAction} className="max-w-xl space-y-6">
      <div className="space-y-1.5">
        <label
          htmlFor="rubro_select"
          className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Rubro
        </label>
        {!sinRubros && (
          <select
            id="rubro_select"
            value={seleccion}
            onChange={(e) => setSeleccion(e.currentTarget.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              Selecciona un rubro
            </option>
            {opciones.map((rubro) => (
              <option key={rubro} value={rubro}>
                {rubro}
              </option>
            ))}
            <option value={NUEVO}>+ Nuevo rubro...</option>
          </select>
        )}
        {esNuevo && (
          <input
            type="text"
            value={nuevoRubro}
            onChange={(e) => setNuevoRubro(e.currentTarget.value)}
            placeholder="Nombre del nuevo rubro"
            autoFocus={!sinRubros}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        )}
        <input type="hidden" name="rubro" value={rubroFinal} />
        {errors.rubro && (
          <p className="text-xs text-destructive">{errors.rubro.join(", ")}</p>
        )}
      </div>

      <Field
        label="Nombre"
        name="nombre"
        defaultValue={servicio?.nombre}
        error={errors.nombre}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <CurrencyField
          label="Precio lista"
          name="precio_lista"
          defaultValue={servicio?.precio_lista}
          error={errors.precio_lista}
          required
        />
        <CurrencyField
          label="Precio efectivo"
          name="precio_efectivo"
          defaultValue={servicio?.precio_efectivo}
          error={errors.precio_efectivo}
          required
        />
      </div>

      <Field
        label="Duración (minutos)"
        name="duracion_min"
        type="number"
        min={5}
        max={600}
        step={5}
        defaultValue={servicio?.duracion_min ?? 60}
        error={errors.duracion_min}
        required
      />
      <p className="-mt-3 text-xs text-muted-foreground">
        Cuánto ocupa el turno en la agenda: bloquea ese rango para que no se
        reserve otro turno encima.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={servicio?.activo ?? true}
          className="h-4 w-4 rounded border-border accent-sage-500"
        />
        <span>Activo</span>
      </label>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="visible_reserva"
            defaultChecked={servicio?.visible_reserva ?? true}
            className="h-4 w-4 rounded border-border accent-sage-500"
          />
          <span>Visible en la reserva online</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Destildá para que sea solo de caja: se puede cobrar en el mostrador
          pero no aparece en la web del cliente ni genera turnos. Se usa para los
          precios internos por largo de pelo (1/2/3/4), donde en la web se
          muestra un único servicio.
        </p>
      </div>

      {errors._ && <p className="text-sm text-destructive">{errors._.join(", ")}</p>}

      <div className="flex items-center gap-3 pt-4">
        <LoadingButton
          type="submit"
          pending={pending}
          pendingLabel="Guardando..."
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700"
        >
          {submitLabel}
        </LoadingButton>
        <button
          type="button"
          onClick={() => router.push("/catalogos/servicios")}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-cream"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string[];
}

function Field({ label, error, name, ...rest }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        {...rest}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error && <p className="text-xs text-destructive">{error.join(", ")}</p>}
    </div>
  );
}
