"use client";

import { CrudForm } from "./crud-form";
import { Field, SelectField } from "./field";
import type { Insumo, Sucursal } from "@/lib/types";
import type { ActionResult } from "@/lib/data/_helpers";

interface Props {
  insumos: Insumo[];
  sucursales: Sucursal[];
  defaultOrigenId: string;
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export function TransferenciaForm({
  insumos,
  sucursales,
  defaultOrigenId,
  action,
}: Props) {
  const otrasSucursales = sucursales.filter((s) => s.id !== defaultOrigenId);
  return (
    <CrudForm
      action={action}
      redirectTo="/stock"
      submitLabel="Transferir"
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
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Origen"
              name="sucursal_origen_id"
              defaultValue={defaultOrigenId}
              error={errors.sucursal_origen_id}
              options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
              required
            />
            <SelectField
              label="Destino"
              name="sucursal_destino_id"
              defaultValue={otrasSucursales[0]?.id ?? ""}
              error={errors.sucursal_destino_id}
              options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
              required
            />
          </div>
          <Field
            label="Cantidad"
            name="cantidad"
            type="number"
            step="0.01"
            min="0.01"
            error={errors.cantidad}
            required
          />
          <Field
            label="Motivo (opcional)"
            name="motivo"
            error={errors.motivo}
          />
        </>
      )}
    </CrudForm>
  );
}
