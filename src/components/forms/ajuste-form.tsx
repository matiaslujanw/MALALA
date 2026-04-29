"use client";

import { CrudForm } from "./crud-form";
import { Field, SelectField } from "./field";
import type { Insumo, Sucursal } from "@/lib/types";
import type { ActionResult } from "@/lib/data/_helpers";

interface Props {
  insumos: Insumo[];
  sucursales: Sucursal[];
  defaultSucursalId: string;
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export function AjusteForm({
  insumos,
  sucursales,
  defaultSucursalId,
  action,
}: Props) {
  return (
    <CrudForm
      action={action}
      redirectTo="/stock"
      submitLabel="Aplicar ajuste"
    >
      {(errors) => (
        <>
          <SelectField
            label="Insumo"
            name="insumo_id"
            error={errors.insumo_id}
            options={insumos.map((i) => ({ value: i.id, label: i.nombre }))}
            placeholder="Seleccioná insumo"
            required
          />
          <SelectField
            label="Sucursal"
            name="sucursal_id"
            defaultValue={defaultSucursalId}
            error={errors.sucursal_id}
            options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
            required
          />
          <Field
            label="Cantidad (positiva suma, negativa resta)"
            name="cantidad"
            type="number"
            step="0.01"
            error={errors.cantidad}
            hint="Ej: 100 para sumar, -50 para restar"
            required
          />
          <Field
            label="Motivo"
            name="motivo"
            error={errors.motivo}
            hint="Conteo físico, error de carga, ruptura, etc."
            required
          />
        </>
      )}
    </CrudForm>
  );
}
