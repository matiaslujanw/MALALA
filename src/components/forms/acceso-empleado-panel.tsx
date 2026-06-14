"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Field, SelectField } from "./field";
import type { ActionResult } from "@/lib/data/_helpers";

const ROL_LABEL: Record<string, string> = {
  empleado: "Empleado",
  encargada: "Encargada",
  admin: "Admin",
  superadmin: "Superadmin",
};

interface Props {
  acceso: { email: string; rol: string; activo: boolean } | null;
  rolesDisponibles: { value: string; label: string }[];
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export function AccesoEmpleadoPanel({ acceso, rolesDisponibles, action }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, fd) => {
    const result = await action(prev, fd);
    if (result.ok) router.refresh();
    return result;
  }, null);

  const errors = state && !state.ok ? state.errors : {};

  return (
    <section className="space-y-3 border-t border-border pt-6">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        Acceso al sistema
      </h2>

      {acceso ? (
        <div className="rounded-md border border-border bg-card p-4 text-sm">
          <p>
            <span className="text-muted-foreground">Email:</span> {acceso.email}
          </p>
          <p className="mt-1">
            <span className="text-muted-foreground">Rol:</span>{" "}
            {ROL_LABEL[acceso.rol] ?? acceso.rol}
          </p>
          <p className="mt-1">
            <span className="text-muted-foreground">Estado:</span>{" "}
            {acceso.activo ? "Activo" : "Inactivo"}
          </p>
        </div>
      ) : (
        <form action={formAction} className="space-y-3 rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            Este empleado todavía no tiene acceso. Creá su login con email,
            contraseña y rol. La puede cambiar después.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Email de acceso"
              name="email"
              type="email"
              error={errors.email}
              required
            />
            <SelectField
              label="Rol"
              name="rol"
              error={errors.rol}
              options={rolesDisponibles}
              placeholder="Seleccioná rol"
              required
            />
          </div>
          <Field
            label="Contraseña"
            name="password"
            type="password"
            error={errors.password}
            hint="Mínimo 8 caracteres."
            required
          />
          {errors._ && (
            <p className="text-xs text-destructive">{errors._.join(", ")}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700 disabled:opacity-50"
          >
            {pending ? "Creando…" : "Crear acceso"}
          </button>
        </form>
      )}
    </section>
  );
}
