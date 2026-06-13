"use client";

import { CrudForm } from "./crud-form";
import { CheckboxField, CurrencyField, Field, SelectField } from "./field";
import type { Empleado, Sucursal } from "@/lib/types";
import type { ActionResult } from "@/lib/data/_helpers";

interface Props {
  empleado?: Empleado;
  sucursales: Sucursal[];
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  submitLabel: string;
}

const TIPOS = [
  { value: "porcentaje", label: "Porcentaje" },
  { value: "mixto", label: "Mixto (%+ asegurado)" },
  { value: "sueldo_fijo", label: "Sueldo fijo" },
];

export function EmpleadoForm({
  empleado,
  sucursales,
  action,
  submitLabel,
}: Props) {
  return (
    <CrudForm
      action={action}
      redirectTo="/catalogos/empleados"
      submitLabel={submitLabel}
    >
      {(errors) => (
        <>
          <Field
            label="Nombre"
            name="nombre"
            defaultValue={empleado?.nombre}
            error={errors.nombre}
            required
          />
          <SelectField
            label="Sucursal principal"
            name="sucursal_principal_id"
            defaultValue={empleado?.sucursal_principal_id}
            error={errors.sucursal_principal_id}
            options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
            required
          />
          <SelectField
            label="Tipo de comisión"
            name="tipo_comision"
            defaultValue={empleado?.tipo_comision ?? "porcentaje"}
            error={errors.tipo_comision}
            options={TIPOS}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Porcentaje default"
              name="porcentaje_default"
              type="number"
              step="0.01"
              defaultValue={empleado?.porcentaje_default ?? 30}
              error={errors.porcentaje_default}
              required
            />
            <CurrencyField
              label="Valor por hora"
              name="valor_hora"
              defaultValue={empleado?.valor_hora ?? 0}
              error={errors.valor_hora}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Horas por día"
              name="horas_por_dia"
              type="number"
              step="0.5"
              min="0"
              defaultValue={empleado?.horas_por_dia ?? 0}
              error={errors.horas_por_dia}
              hint="Para proponer las horas al liquidar"
            />
          </div>
          <DiasTrabajoField dias={empleado?.dias_trabajo ?? []} />
          <Field
            label="Observación"
            name="observacion"
            defaultValue={empleado?.observacion}
            error={errors.observacion}
          />
          <CheckboxField
            label="Activo"
            name="activo"
            defaultChecked={empleado?.activo ?? true}
          />
        </>
      )}
    </CrudForm>
  );
}

const DIAS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

function DiasTrabajoField({ dias }: { dias: number[] }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Días que trabaja
      </label>
      <div className="flex flex-wrap gap-2">
        {DIAS.map((d) => (
          <label
            key={d.value}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm cursor-pointer hover:bg-cream has-[:checked]:border-sage-700 has-[:checked]:bg-sage-50"
          >
            <input
              type="checkbox"
              name="dias_trabajo"
              value={d.value}
              defaultChecked={dias.includes(d.value)}
              className="h-3.5 w-3.5 rounded border-border accent-sage-500"
            />
            <span>{d.label}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Se usan para calcular las horas del período al liquidar.
      </p>
    </div>
  );
}
