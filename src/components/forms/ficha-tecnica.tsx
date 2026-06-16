"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2, FileText, Plus } from "lucide-react";
import type { Cliente, FichaRegistro } from "@/lib/types";
import type { ActionResult } from "@/lib/data/_helpers";

type Accion = (
  state: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

interface Props {
  perfil: Pick<
    Cliente,
    | "tipo_cabello"
    | "salud_cabello"
    | "alergias"
    | "color_actual"
    | "observaciones_tecnicas"
  >;
  registros: FichaRegistro[];
  servicios: { id: string; nombre: string }[];
  empleados: { id: string; nombre: string }[];
  puedeEliminar: boolean;
  updatePerfil: Accion;
  addRegistro: Accion;
  deleteRegistro: (formData: FormData) => void;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function FichaTecnica({
  perfil,
  registros,
  servicios,
  empleados,
  puedeEliminar,
  updatePerfil,
  addRegistro,
  deleteRegistro,
}: Props) {
  const router = useRouter();

  const [perfilState, perfilAction, perfilPending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, fd) => {
    const r = await updatePerfil(prev, fd);
    if (r.ok) router.refresh();
    return r;
  }, null);

  const addFormRef = useRef<HTMLFormElement>(null);
  const [regState, regAction, regPending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, fd) => {
    const r = await addRegistro(prev, fd);
    if (r.ok) {
      addFormRef.current?.reset();
      router.refresh();
    }
    return r;
  }, null);

  const perfilErr = perfilState && !perfilState.ok ? perfilState.errors : {};
  const regErr = regState && !regState.ok ? regState.errors : {};
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <section className="space-y-6 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 stroke-[1.5] text-sage-700" />
        <h2 className="font-display text-xl tracking-[0.15em] uppercase">
          Ficha técnica
        </h2>
      </div>

      {/* Perfil técnico */}
      <form action={perfilAction} className="space-y-4 rounded-md border border-border bg-card p-5">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
          Perfil del cliente
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Tipo de cabello" name="tipo_cabello" defaultValue={perfil.tipo_cabello} placeholder="Liso, fino, teñido…" />
          <Campo label="Salud del cabello" name="salud_cabello" defaultValue={perfil.salud_cabello} placeholder="Sano, dañado, decolorado…" />
          <Campo label="Color actual / base" name="color_actual" defaultValue={perfil.color_actual} placeholder="Ej. 6.0 base natural" />
          <Campo label="Alergias / sensibilidades" name="alergias" defaultValue={perfil.alergias} placeholder="Amoníaco, PPD…" />
        </div>
        <Textarea
          label="Observaciones técnicas"
          name="observaciones_tecnicas"
          defaultValue={perfil.observaciones_tecnicas}
          placeholder="Notas generales del cabello / piel del cliente"
        />
        {perfilErr._ && <p className="text-xs text-destructive">{perfilErr._.join(", ")}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={perfilPending}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
          >
            {perfilPending ? "Guardando…" : "Guardar perfil"}
          </button>
          {perfilState?.ok && (
            <span className="text-xs text-sage-700">Perfil guardado.</span>
          )}
        </div>
      </form>

      {/* Registros fechados */}
      <div className="space-y-3">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
          Registros técnicos
        </h3>

        {/* Alta de registro */}
        <form
          ref={addFormRef}
          action={regAction}
          className="space-y-3 rounded-md border border-border bg-card p-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Campo label="Fecha" name="fecha" type="date" defaultValue={hoy} />
            <Select label="Servicio" name="servicio_id" placeholder="— Opcional —" options={servicios} />
            <Select label="Empleado" name="empleado_id" placeholder="— Opcional —" options={empleados} />
          </div>
          <Campo label="Fórmula de color" name="formula" placeholder="Ej. 7.1 + 6.0 + 20 vol · 35 min" />
          <Textarea label="Técnica / notas" name="notas" placeholder="Mechas, técnica, tiempos, resultado…" />
          {regErr.formula && <p className="text-xs text-destructive">{regErr.formula.join(", ")}</p>}
          {regErr._ && <p className="text-xs text-destructive">{regErr._.join(", ")}</p>}
          <button
            type="submit"
            disabled={regPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-sage-700 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white hover:bg-sage-900 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 stroke-[1.5]" />
            {regPending ? "Agregando…" : "Agregar registro"}
          </button>
        </form>

        {registros.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Todavía no hay registros técnicos para este cliente.
          </div>
        ) : (
          <ol className="space-y-2">
            {registros.map((r) => (
              <li key={r.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium tabular-nums">
                    {fmtFecha(r.fecha)}
                    {r.servicio_nombre && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        · {r.servicio_nombre}
                      </span>
                    )}
                    {r.empleado_nombre && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        · {r.empleado_nombre}
                      </span>
                    )}
                  </p>
                  {puedeEliminar && (
                    <form action={deleteRegistro}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Eliminar registro"
                      >
                        <Trash2 className="h-4 w-4 stroke-[1.5]" />
                      </button>
                    </form>
                  )}
                </div>
                {r.formula && (
                  <p className="mt-1.5 text-sm">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      Fórmula:{" "}
                    </span>
                    {r.formula}
                  </p>
                )}
                {r.notas && (
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {r.notas}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Campo({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />
    </div>
  );
}

function Textarea({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={2}
        className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />
    </div>
  );
}

function Select({
  label,
  name,
  placeholder,
  options,
}: {
  label: string;
  name: string;
  placeholder: string;
  options: { id: string; nombre: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue=""
        className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
