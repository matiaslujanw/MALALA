"use client";

import { CrudForm } from "./crud-form";
import { CheckboxField, Field, SelectField } from "./field";
import type { Insumo, Proveedor } from "@/lib/types";
import type { ActionResult } from "@/lib/data/_helpers";

interface Props {
  insumo?: Insumo;
  proveedores: Proveedor[];
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  submitLabel: string;
}

const UNIDADES = [
  { value: "ud", label: "Unidad" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "g", label: "Gramos (g)" },
  { value: "aplicacion", label: "Aplicación" },
];

export function InsumoForm({
  insumo,
  proveedores,
  action,
  submitLabel,
}: Props) {
  return (
    <CrudForm
      action={action}
      redirectTo="/catalogos/insumos"
      submitLabel={submitLabel}
    >
      {(errors) => (
        <>
          <Field
            label="Nombre"
            name="nombre"
            defaultValue={insumo?.nombre}
            error={errors.nombre}
            required
          />
          <SelectField
            label="Proveedor"
            name="proveedor_id"
            defaultValue={insumo?.proveedor_id ?? ""}
            error={errors.proveedor_id}
            options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
            placeholder="— sin proveedor —"
          />
          <SelectField
            label="Unidad de medida"
            name="unidad_medida"
            defaultValue={insumo?.unidad_medida ?? "ml"}
            error={errors.unidad_medida}
            options={UNIDADES}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Tamaño envase"
              name="tamano_envase"
              type="number"
              step="0.01"
              defaultValue={insumo?.tamano_envase}
              error={errors.tamano_envase}
              hint="En la unidad seleccionada"
              required
            />
            <Field
              label="Precio envase"
              name="precio_envase"
              type="number"
              step="0.01"
              defaultValue={insumo?.precio_envase}
              error={errors.precio_envase}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Rinde (opcional)"
              name="rinde"
              type="number"
              step="0.01"
              defaultValue={insumo?.rinde}
              error={errors.rinde}
            />
            <Field
              label="Umbral stock bajo"
              name="umbral_stock_bajo"
              type="number"
              step="0.01"
              defaultValue={insumo?.umbral_stock_bajo ?? 0}
              error={errors.umbral_stock_bajo}
              required
            />
          </div>
          <CheckboxField
            label="Activo"
            name="activo"
            defaultChecked={insumo?.activo ?? true}
          />
        </>
      )}
    </CrudForm>
  );
}
