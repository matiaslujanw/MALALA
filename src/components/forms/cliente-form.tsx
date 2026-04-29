"use client";

import { CrudForm } from "./crud-form";
import { CheckboxField, Field } from "./field";
import type { Cliente } from "@/lib/types";
import type { ActionResult } from "@/lib/data/_helpers";

interface Props {
  cliente?: Cliente;
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  submitLabel: string;
}

export function ClienteForm({ cliente, action, submitLabel }: Props) {
  return (
    <CrudForm
      action={action}
      redirectTo="/catalogos/clientes"
      submitLabel={submitLabel}
    >
      {(errors) => (
        <>
          <Field
            label="Nombre"
            name="nombre"
            defaultValue={cliente?.nombre}
            error={errors.nombre}
            required
          />
          <Field
            label="Teléfono"
            name="telefono"
            defaultValue={cliente?.telefono}
            error={errors.telefono}
            hint="Se normaliza a formato internacional"
          />
          <Field
            label="Observación"
            name="observacion"
            defaultValue={cliente?.observacion}
            error={errors.observacion}
          />
          <CheckboxField
            label="Activo"
            name="activo"
            defaultChecked={cliente?.activo ?? true}
          />
        </>
      )}
    </CrudForm>
  );
}
