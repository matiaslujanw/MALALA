"use client";

import { useState } from "react";
import Link from "next/link";
import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "./field";
import { upsertRecetaItem } from "@/lib/data/recetas";
import type { Insumo, Servicio } from "@/lib/types";
import type { ServicioDeInsumo } from "@/lib/data/recetas";
import { formatARS } from "@/lib/utils";

const UNIDAD_LABEL: Record<string, string> = {
  ud: "ud",
  ml: "ml",
  g: "g",
  aplicacion: "apl.",
};

interface Props {
  insumo: Insumo;
  serviciosUsando: ServicioDeInsumo[];
  serviciosDisponibles: Servicio[];
}

export function InsumoServiciosCard({
  insumo,
  serviciosUsando,
  serviciosDisponibles,
}: Props) {
  const { pending, run } = useTransitionFeedback();
  const [servicioId, setServicioId] = useState("");
  const [cantidad, setCantidad] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const unidad = UNIDAD_LABEL[insumo.unidad_medida] ?? insumo.unidad_medida;

  function asignar() {
    setError(null);
    if (!servicioId) {
      setError("Elegi un servicio");
      return;
    }
    if (!(cantidad > 0)) {
      setError("La cantidad debe ser mayor a 0");
      return;
    }
    const fd = new FormData();
    fd.set("servicio_id", servicioId);
    fd.set("insumo_id", insumo.id);
    fd.set("cantidad", String(cantidad));

    run(
      async () => {
        const res = await upsertRecetaItem(fd);
        if (!res.ok) {
          setError(Object.values(res.errors).flat().join(", "));
        }
        return res;
      },
      {
        refreshOnSuccess: true,
        successMessage: "Receta actualizada",
        onSuccess: () => {
          setServicioId("");
          setCantidad(0);
        },
      },
    );
  }

  return (
    <div className="space-y-4 border-t border-border pt-6">
      <div className="space-y-1">
        <h2 className="font-display text-lg tracking-[0.15em] uppercase">
          Se usa en estos servicios
        </h2>
        <p className="text-xs text-muted-foreground">
          Cantidad consumida por cada servicio (receta), expresada en {unidad}.
        </p>
      </div>

      {serviciosUsando.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este insumo todavia no esta en ninguna receta.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {serviciosUsando.map((item) => (
            <li
              key={item.receta_id}
              className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
            >
              <Link
                href={`/catalogos/recetas/${item.servicio.id}`}
                className="text-sage-700 hover:text-sage-900 hover:underline"
              >
                <span className="text-muted-foreground">
                  {item.servicio.rubro} ·{" "}
                </span>
                {item.servicio.nombre}
              </Link>
              <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                {item.cantidad.toLocaleString("es-AR")} {unidad}
                {item.costo > 0 && <> · {formatARS(item.costo)}</>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-md border border-border bg-cream/40 p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Asignar a un servicio
        </p>
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Servicio
            </label>
            <select
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="">
                {serviciosDisponibles.length === 0
                  ? "Ya está en todos los servicios"
                  : "Selecciona"}
              </option>
              {serviciosDisponibles.map((servicio) => (
                <option key={servicio.id} value={servicio.id}>
                  {servicio.rubro} · {servicio.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cantidad ({unidad})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cantidad || ""}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="w-28 rounded-md border border-border bg-card px-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <LoadingButton
            type="button"
            onClick={asignar}
            disabled={serviciosDisponibles.length === 0}
            pending={pending}
            pendingLabel="Guardando..."
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-brown-700"
          >
            Asignar
          </LoadingButton>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
