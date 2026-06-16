"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CurrencyField } from "./field";
import type { Promocion, Servicio } from "@/lib/types";
import { formatARS } from "@/lib/utils";
import type { ActionResult } from "@/lib/data/promociones";

interface Props {
  promocion?: Promocion;
  servicios: Servicio[];
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}

export function PromocionForm({ promocion, servicios, action, submitLabel }: Props) {
  const router = useRouter();
  const [seleccionados, setSeleccionados] = useState<string[]>(
    promocion?.componentes.map((c) => c.servicio_id) ?? [],
  );

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      // Reflejar la selección actual en el FormData (los checkboxes nativos ya lo
      // hacen, pero garantizamos el orden de "componentes" según la selección).
      const result = await action(prev, fd);
      if (result.ok) router.push("/catalogos/promociones");
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? state.errors : {};

  const sumaLista = useMemo(() => {
    const byId = new Map(servicios.map((s) => [s.id, s]));
    return seleccionados.reduce(
      (acc, id) => acc + (byId.get(id)?.precio_lista ?? 0),
      0,
    );
  }, [seleccionados, servicios]);

  function toggle(id: string) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <form action={formAction} className="space-y-6 max-w-xl">
      <Field
        label="Nombre"
        name="nombre"
        defaultValue={promocion?.nombre}
        error={errors.nombre}
        required
      />

      <div className="space-y-2">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Servicios combinados
        </label>
        <p className="text-xs text-muted-foreground">
          Elegí al menos 2 servicios. Cada uno mantiene su trazabilidad al vender.
        </p>
        <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-card divide-y divide-border">
          {servicios.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              No hay servicios cargados.
            </p>
          ) : (
            servicios.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-cream/30 cursor-pointer"
              >
                <input
                  type="checkbox"
                  name="componentes"
                  value={s.id}
                  checked={seleccionados.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 rounded border-border accent-sage-500"
                />
                <span className="flex-1">{s.nombre}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatARS(s.precio_lista)}
                </span>
              </label>
            ))
          )}
        </div>
        {seleccionados.length > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {seleccionados.length} servicios · suma de precios de lista:{" "}
            {formatARS(sumaLista)}
          </p>
        )}
        {errors.componentes && (
          <p className="text-xs text-destructive">{errors.componentes.join(", ")}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CurrencyField
          label="Precio combo (lista)"
          name="precio_lista"
          defaultValue={promocion?.precio_lista}
          error={errors.precio_lista}
          required
        />
        <CurrencyField
          label="Precio combo (efectivo)"
          name="precio_efectivo"
          defaultValue={promocion?.precio_efectivo}
          error={errors.precio_efectivo}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Comisión default %"
          name="comision_default_pct"
          type="number"
          step="0.01"
          defaultValue={promocion?.comision_default_pct ?? 30}
          error={errors.comision_default_pct}
          required
        />
        <Field
          label="Duración (min, opcional)"
          name="duracion_min"
          type="number"
          step="1"
          defaultValue={promocion?.duracion_min}
          error={errors.duracion_min}
        />
      </div>

      <Field
        label="Vencimiento (opcional)"
        name="vence_el"
        type="date"
        defaultValue={promocion?.vence_el}
        error={errors.vence_el}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={promocion?.activo ?? true}
          className="h-4 w-4 rounded border-border accent-sage-500"
        />
        <span>Activa</span>
      </label>

      {errors._ && <p className="text-sm text-destructive">{errors._.join(", ")}</p>}

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
          onClick={() => router.push("/catalogos/promociones")}
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
      {error && <p className="text-xs text-destructive">{error.join(", ")}</p>}
    </div>
  );
}
