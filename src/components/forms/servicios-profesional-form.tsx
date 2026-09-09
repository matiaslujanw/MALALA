"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "@/components/forms/field";
import type { ActionResult } from "@/lib/data/_helpers";

interface ServicioElegible {
  id: string;
  nombre: string;
  rubro: string;
}

interface Props {
  agendaId: string;
  servicios: ServicioElegible[];
  /** Ids ya asignados a este profesional en esta sucursal. */
  asignados: string[];
  guardar: (agendaId: string, formData: FormData) => Promise<ActionResult>;
}

/**
 * Asignación de servicios a un profesional.
 *
 * LA SELECCIÓN VIVE EN ESTADO, NO EN LOS CHECKBOXES, y eso es lo que hace que el
 * filtro sea seguro. Antes eran checkboxes no controlados y el guardado hacía
 * "borrar todo e insertar lo que vino en el FormData": al filtrar, los servicios
 * tildados que quedaban fuera del filtro no se enviaban y se borraban sin que
 * nadie se enterara. Con la selección en estado, filtrar sólo cambia lo que se
 * ve.
 *
 * Y el guardado ahora avisa: antes la página tiraba a la basura el ActionResult
 * y el botón era un <button> pelado, así que se guardaba —o fallaba— sin ninguna
 * señal en pantalla.
 */
export function ServiciosProfesionalForm({
  agendaId,
  servicios,
  asignados,
  guardar,
}: Props) {
  const { pending, run } = useTransitionFeedback();
  const [seleccion, setSeleccion] = useState<Set<string>>(
    () => new Set(asignados),
  );
  const [rubro, setRubro] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rubros = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of servicios) m.set(s.rubro, (m.get(s.rubro) ?? 0) + 1);
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [servicios]);

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return servicios.filter(
      (s) =>
        (!rubro || s.rubro === rubro) &&
        (!texto || s.nombre.toLowerCase().includes(texto)),
    );
  }, [servicios, rubro, q]);

  const sinGuardar =
    seleccion.size !== asignados.length ||
    asignados.some((id) => !seleccion.has(id));

  function toggle(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function marcarVisibles(valor: boolean) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      for (const s of visibles) {
        if (valor) next.add(s.id);
        else next.delete(s.id);
      }
      return next;
    });
  }

  function handleGuardar() {
    setError(null);
    const fd = new FormData();
    // Se manda TODA la selección, no sólo lo visible.
    for (const id of seleccion) fd.append("servicio_id", id);
    run(
      async () => {
        const res = await guardar(agendaId, fd);
        if (!res.ok) setError(Object.values(res.errors).flat().join(", "));
        return res;
      },
      {
        refreshOnSuccess: true,
        successMessage: `${seleccion.size} servicio${seleccion.size !== 1 ? "s" : ""} guardado${seleccion.size !== 1 ? "s" : ""}`,
      },
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-cream/20 p-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Servicios que realiza
        </p>
        <p className="text-xs text-muted-foreground">
          Si no marcás ninguno, este profesional queda sin restricción adicional
          para esta sucursal.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          aria-label="Filtrar por rubro"
        >
          <option value="">Todos los rubros ({servicios.length})</option>
          {rubros.map(([r, n]) => (
            <option key={r} value={r}>
              {r} ({n})
            </option>
          ))}
        </select>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground stroke-[1.5]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar servicio…"
            aria-label="Buscar servicio"
            className="rounded-md border border-border bg-card py-1.5 pl-8 pr-3 text-sm outline-none focus:border-sage-700"
          />
        </div>

        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {seleccion.size} seleccionado{seleccion.size !== 1 ? "s" : ""}
        </span>
      </div>

      {(rubro || q) && visibles.length > 0 && (
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => marcarVisibles(true)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Marcar los {visibles.length} visibles
          </button>
          <button
            type="button"
            onClick={() => marcarVisibles(false)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Desmarcarlos
          </button>
          <span className="text-muted-foreground">
            Filtrar no desmarca nada: lo que elegiste en otro rubro se guarda igual.
          </span>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Ningún servicio coincide con el filtro.
        </p>
      ) : (
        <div className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
          {visibles.map((servicio) => (
            <label
              key={`${agendaId}-${servicio.id}`}
              className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={seleccion.has(servicio.id)}
                onChange={() => toggle(servicio.id)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-sage-500"
              />
              <span>
                <span className="block font-medium">{servicio.nombre}</span>
                <span className="block text-xs text-muted-foreground">
                  {servicio.rubro}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <LoadingButton
          type="button"
          onClick={handleGuardar}
          pending={pending}
          pendingLabel="Guardando..."
          disabled={!sinGuardar}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-brown-700 disabled:opacity-50"
        >
          Guardar servicios
        </LoadingButton>
        {sinGuardar ? (
          <span className="text-xs text-muted-foreground">Hay cambios sin guardar.</span>
        ) : (
          <span className="text-xs text-muted-foreground">Sin cambios.</span>
        )}
      </div>
    </div>
  );
}
