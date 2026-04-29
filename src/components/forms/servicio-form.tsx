"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import type { Servicio } from "@/lib/types";
import type { ActionResult } from "@/lib/data/servicios";

interface Props {
  servicio?: Servicio;
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}

export function ServicioForm({ servicio, action, submitLabel }: Props) {
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

  return (
    <form action={formAction} className="space-y-6 max-w-xl">
      <Field
        label="Rubro"
        name="rubro"
        defaultValue={servicio?.rubro}
        error={errors.rubro}
        required
      />
      <Field
        label="Nombre"
        name="nombre"
        defaultValue={servicio?.nombre}
        error={errors.nombre}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Precio lista"
          name="precio_lista"
          type="number"
          step="0.01"
          defaultValue={servicio?.precio_lista}
          error={errors.precio_lista}
          required
        />
        <Field
          label="Precio efectivo"
          name="precio_efectivo"
          type="number"
          step="0.01"
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
