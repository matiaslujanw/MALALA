"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useActionStateFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "@/components/forms/field";
import {
  aplicarAumentoServicios,
  previewAumentoServicios,
  type AumentoServiciosResult,
  type FilaAumento,
} from "@/lib/data/servicios-aumento";
import { formatARS } from "@/lib/utils";

interface Props {
  rubros: Array<{ rubro: string; cantidad: number }>;
}

export function AumentoForm({ rubros }: Props) {
  const [pct, setPct] = useState("");
  const [rubro, setRubro] = useState("");
  const [incluirPromos, setIncluirPromos] = useState(false);
  const [filas, setFilas] = useState<FilaAumento[] | null>(null);
  const [errPreview, setErrPreview] = useState<string | null>(null);
  const [calculando, startPreview] = useTransition();

  const [state, formAction, aplicando] = useActionStateFeedback<AumentoServiciosResult>(
    aplicarAumentoServicios,
    {
      redirectTo: "/catalogos/servicios",
      successMessage: "Precios actualizados",
    },
  );
  const errors = state && !state.ok ? state.errors : {};

  // Cualquier cambio en los filtros invalida el preview: nunca se aplica algo
  // distinto de lo que la persona vio en la tabla.
  function cambiar(fn: () => void) {
    fn();
    setFilas(null);
    setErrPreview(null);
  }

  function verPreview() {
    startPreview(async () => {
      const res = await previewAumentoServicios({
        pct: Number(pct),
        rubro: rubro || undefined,
        incluirPromos,
      });
      if (res.ok) {
        setFilas(res.filas);
        setErrPreview(null);
      } else {
        setFilas(null);
        setErrPreview(Object.values(res.errors).flat()[0] ?? "No se pudo calcular");
      }
    });
  }

  const totalAntes = filas?.reduce((a, f) => a + f.listaAntes, 0) ?? 0;
  const totalDespues = filas?.reduce((a, f) => a + f.listaDespues, 0) ?? 0;

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-md border border-border bg-card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label
              htmlFor="pct"
              className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Porcentaje
            </label>
            <input
              id="pct"
              type="number"
              step="0.5"
              value={pct}
              onChange={(e) => cambiar(() => setPct(e.target.value))}
              placeholder="15"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Negativo para bajar. Se aplica al precio de lista y al de efectivo.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="rubro"
              className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Rubro
            </label>
            <select
              id="rubro"
              value={rubro}
              onChange={(e) => cambiar(() => setRubro(e.target.value))}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos los rubros</option>
              {rubros.map((r) => (
                <option key={r.rubro} value={r.rubro}>
                  {r.rubro} ({r.cantidad})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={incluirPromos}
                onChange={(e) => cambiar(() => setIncluirPromos(e.target.checked))}
                className="h-4 w-4 rounded border-border accent-sage-500"
              />
              Incluir promociones
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LoadingButton
            type="button"
            onClick={verPreview}
            pending={calculando}
            pendingLabel="Calculando..."
            disabled={!pct}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium uppercase tracking-wider transition-colors hover:bg-cream disabled:opacity-50"
          >
            Ver qué cambia
          </LoadingButton>
          {errPreview && <span className="text-sm text-destructive">{errPreview}</span>}
        </div>
      </section>

      {filas && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              {filas.length} servicio{filas.length !== 1 ? "s" : ""} que cambian
            </h2>
            <p className="text-sm tabular-nums text-muted-foreground">
              Suma de la lista: {formatARS(totalAntes)} → {formatARS(totalDespues)}
            </p>
          </div>

          {filas.length === 0 ? (
            <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Ningún servicio entra en ese filtro.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-border bg-card">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Servicio</th>
                      <th className="px-4 py-3 text-left font-medium">Rubro</th>
                      <th className="px-4 py-3 text-right font-medium">Lista</th>
                      <th className="px-4 py-3 text-right font-medium">Efectivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filas.map((f) => (
                      <tr key={f.id} className="hover:bg-cream/30">
                        <td className="px-4 py-3 font-medium">
                          {f.codigo ? (
                            <span className="mr-2 text-xs tabular-nums text-muted-foreground">
                              {f.codigo}
                            </span>
                          ) : null}
                          {f.nombre}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{f.rubro}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className="text-muted-foreground">
                            {formatARS(f.listaAntes)}
                          </span>{" "}
                          → <strong>{formatARS(f.listaDespues)}</strong>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className="text-muted-foreground">
                            {formatARS(f.efectivoAntes)}
                          </span>{" "}
                          → <strong>{formatARS(f.efectivoDespues)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form action={formAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="pct" value={pct} />
                <input type="hidden" name="rubro" value={rubro} />
                {incluirPromos && (
                  <input type="hidden" name="incluir_promos" value="on" />
                )}
                <input type="hidden" name="confirmado" value="si" />
                <LoadingButton
                  type="submit"
                  pending={aplicando}
                  pendingLabel="Aplicando..."
                  className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-brown-700"
                >
                  Aplicar a {filas.length} servicio{filas.length !== 1 ? "s" : ""}
                </LoadingButton>
                <Link
                  href="/catalogos/servicios"
                  className="rounded-md border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-cream"
                >
                  Cancelar
                </Link>
                <span className="text-xs text-muted-foreground">
                  No se puede deshacer.
                </span>
                {errors._ && (
                  <span className="text-sm text-destructive">{errors._.join(", ")}</span>
                )}
              </form>
            </>
          )}
        </section>
      )}
    </div>
  );
}
