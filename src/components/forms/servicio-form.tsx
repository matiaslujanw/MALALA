"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CurrencyField } from "./field";
import type { Servicio } from "@/lib/types";
import type { ActionResult } from "@/lib/data/servicios";

interface Props {
  servicio?: Servicio;
  /** Rubros ya existentes, para elegir en vez de tipear suelto. */
  rubros?: string[];
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}

const NUEVO = "__nuevo__";

export function ServicioForm({ servicio, rubros = [], action, submitLabel }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const result = await action(prev, fd);
      if (result.ok) {
        router.push("/catalogos/servicios");
      }
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? state.errors : {};

  // El rubro actual del servicio puede no estar en la lista (datos viejos): lo
  // sumamos para que quede seleccionable.
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
    <form action={formAction} className="space-y-6 max-w-xl">
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
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              Seleccioná un rubro
            </option>
            {opciones.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value={NUEVO}>+ Nuevo rubro…</option>
          </select>
        )}
        {esNuevo && (
          <input
            type="text"
            value={nuevoRubro}
            onChange={(e) => setNuevoRubro(e.currentTarget.value)}
            placeholder="Nombre del nuevo rubro"
            autoFocus={!sinRubros}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        )}
        {/* Valor real enviado al servidor. */}
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
        label="Comisión default %"
        name="comision_default_pct"
        type="number"
        step="0.01"
        defaultValue={servicio?.comision_default_pct ?? 30}
        error={errors.comision_default_pct}
        required
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={servicio?.activo ?? true}
          className="h-4 w-4 rounded border-border accent-sage-500"
        />
        <span>Activo</span>
      </label>

      {errors._ && (
        <p className="text-sm text-destructive">{errors._.join(", ")}</p>
      )}

      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push("/catalogos/servicios")}
          className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-cream transition-colors"
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
        className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />
      {error && (
        <p className="text-xs text-destructive">{error.join(", ")}</p>
      )}
    </div>
  );
}
