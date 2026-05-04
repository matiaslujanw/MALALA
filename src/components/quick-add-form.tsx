"use client";

import { useActionState, useRef } from "react";
import { Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { createAdminTurnoAction } from "@/lib/data/turnos-actions";

export function QuickAddForm({
  sucursalId,
  fecha,
  servicios,
  profesionales,
}: {
  sucursalId: string;
  fecha: string;
  servicios: { id: string; nombre: string }[];
  profesionales: { id: string; empleado_id: string; empleado: { nombre: string } }[];
}) {
  const [state, formAction, isPending] = useActionState(createAdminTurnoAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  if (state?.ok && formRef.current) {
    formRef.current.reset();
  }

  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-full bg-sage-50 p-2 text-sage-900">
          <Plus className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Alta rapida
          </p>
          <p className="text-sm text-muted-foreground">
            Cargar turno manual desde el back office.
          </p>
        </div>
      </div>

      {state && !state.ok && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-900 border border-red-200 flex gap-2">
           <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
           <div>
             {state.errors?._form?.map((e: string) => <p key={e}>{e}</p>)}
             {Object.entries(state.errors ?? {}).map(([k, v]) => 
               k !== "_form" && <p key={k}>{v.join(", ")}</p>
             )}
           </div>
        </div>
      )}

      {state?.ok && (
        <div className="mb-4 rounded-xl bg-sage-50 p-3 text-sm text-sage-900 border border-sage-200 flex items-center gap-2">
           <CheckCircle2 className="h-4 w-4 shrink-0" />
           <p>{state.message}</p>
        </div>
      )}

      <form action={formAction} ref={formRef} className="space-y-3">
        <input type="hidden" name="sucursal_id" value={sucursalId} />
        <input type="hidden" name="canal" value="recepcion" />
        <input type="hidden" name="origen" value="interno" />
        <input type="hidden" name="sin_preferencia" value="false" />
        <label className="block space-y-1 text-sm">
          <span className="text-stone-700">Cliente</span>
          <input name="cliente_nombre" required className="w-full rounded-xl border border-border bg-card px-3 py-2.5" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-stone-700">Telefono</span>
          <input name="cliente_telefono" required className="w-full rounded-xl border border-border bg-card px-3 py-2.5" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-stone-700">Servicio</span>
          <select name="servicio_id" required className="w-full rounded-xl border border-border bg-card px-3 py-2.5">
            {servicios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-stone-700">Profesional</span>
          <select name="profesional_id" required className="w-full rounded-xl border border-border bg-card px-3 py-2.5">
            {profesionales.map((item) => (
              <option key={item.id} value={item.empleado_id}>
                {item.empleado.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="text-stone-700">Fecha</span>
            <input name="fecha_turno" type="date" defaultValue={fecha} required className="w-full rounded-xl border border-border bg-card px-3 py-2.5" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-stone-700">Hora</span>
            <input name="hora" type="time" required className="w-full rounded-xl border border-border bg-card px-3 py-2.5" />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-stone-700">Observacion</span>
          <textarea name="observacion" rows={3} className="w-full rounded-xl border border-border bg-card px-3 py-2.5" />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium uppercase tracking-wider text-primary-foreground transition hover:bg-sage-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {isPending ? "Creando..." : "Crear turno"}
        </button>
      </form>
    </section>
  );
}
