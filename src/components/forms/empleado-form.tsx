"use client";

import { CrudForm } from "./crud-form";
import { CheckboxField, Field, SelectField } from "./field";
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
            <Field
              label="Sueldo asegurado"
              name="sueldo_asegurado"
              type="number"
              step="1"
              defaultValue={empleado?.sueldo_asegurado ?? 0}
              error={errors.sueldo_asegurado}
              required
            />
          </div>
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
