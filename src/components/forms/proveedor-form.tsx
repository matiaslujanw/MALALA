"use client";

import { CrudForm } from "./crud-form";
import { Field } from "./field";
import type { Proveedor } from "@/lib/types";
import type { ActionResult } from "@/lib/data/_helpers";

interface Props {
  proveedor?: Proveedor;
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  submitLabel: string;
}

export function ProveedorForm({ proveedor, action, submitLabel }: Props) {
  return (
    <CrudForm
      action={action}
      redirectTo="/catalogos/proveedores"
      submitLabel={submitLabel}
    >
      {(errors) => (
        <>
          <Field
            label="Nombre"
            name="nombre"
            defaultValue={proveedor?.nombre}
            error={errors.nombre}
            required
          />
          <Field
            label="Teléfono"
            name="telefono"
            defaultValue={proveedor?.telefono}
            error={errors.telefono}
          />
          <Field
            label="CUIT"
            name="cuit"
            defaultValue={proveedor?.cuit}
            error={errors.cuit}
          />
        </>
      )}
    </CrudForm>
  );
}
