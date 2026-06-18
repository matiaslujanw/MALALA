"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [servicioId, setServicioId] = useState("");
  const [cantidad, setCantidad] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const unidad = UNIDAD_LABEL[insumo.unidad_medida] ?? insumo.unidad_medida;

  function asignar() {
    setError(null);
    if (!servicioId) {
      setError("Elegí un servicio");
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
    startTransition(async () => {
      const res = await upsertRecetaItem(fd);
      if (res.ok) {
        setServicioId("");
        setCantidad(0);
        router.refresh();
      } else {
        setError(Object.values(res.errors).flat().join(", "));
      }
    });
  }

  return (
    <div className="border-t border-border pt-6 space-y-4">
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
          Este insumo todavía no está en ninguna receta.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-md">
          {serviciosUsando.map((item) => (
            <li
              key={item.receta_id}
              className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
            >
              <Link
                href={`/catalogos/recetas/${item.servicio.id}`}
                className="text-sage-700 hover:text-sage-900 hover:underline"
              >
                <span className="text-muted-foreground">{item.servicio.rubro} · </span>
                {item.servicio.nombre}
              </Link>
              <span className="tabular-nums text-muted-foreground whitespace-nowrap">
                {item.cantidad.toLocaleString("es-AR")} {unidad}
                {item.costo > 0 && (
                  <> · {formatARS(item.costo)}</>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="bg-cream/40 border border-border rounded-md p-4 space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Asignar a un servicio
        </p>
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Servicio
            </label>
            <select
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
            >
              <option value="">
                {serviciosDisponibles.length === 0
                  ? "Ya está en todos los servicios"
                  : "Seleccioná"}
              </option>
              {serviciosDisponibles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.rubro} · {s.nombre}
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
              className="w-28 px-3 py-2 border border-border rounded-md bg-card text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="button"
            onClick={asignar}
            disabled={pending || serviciosDisponibles.length === 0}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
          >
            {pending ? "Guardando…" : "Asignar"}
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
