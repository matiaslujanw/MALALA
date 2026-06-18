"use client";

import { useState } from "react";
import type { Insumo } from "@/lib/types";

const UNIDAD_LABEL: Record<string, string> = {
  ud: "ud",
  ml: "ml",
  g: "g",
  aplicacion: "apl.",
};

const UNIDAD_NOMBRE: Record<string, string> = {
  ud: "unidades",
  ml: "mililitros",
  g: "gramos",
  aplicacion: "aplicaciones",
};

interface Props {
  insumosDisponibles: Insumo[];
  action: (formData: FormData) => void | Promise<void>;
}

export function AgregarInsumoReceta({ insumosDisponibles, action }: Props) {
  const [insumoId, setInsumoId] = useState(insumosDisponibles[0]?.id ?? "");
  const insumo = insumosDisponibles.find((i) => i.id === insumoId) ?? null;
  const unidad = insumo
    ? UNIDAD_LABEL[insumo.unidad_medida] ?? insumo.unidad_medida
    : "";

  return (
    <form
      action={action}
      className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-end"
    >
      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Insumo
        </label>
        <select
          name="insumo_id"
          value={insumoId}
          onChange={(e) => setInsumoId(e.currentTarget.value)}
          required
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {insumosDisponibles.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre} ({UNIDAD_LABEL[i.unidad_medida] ?? i.unidad_medida})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Cantidad {unidad && `(${unidad})`}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="cantidad"
            step="0.01"
            min="0.01"
            required
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {unidad && (
            <span className="text-sm text-muted-foreground shrink-0">
              {unidad}
            </span>
          )}
        </div>
        {insumo && (
          <p className="text-[11px] text-muted-foreground">
            En {UNIDAD_NOMBRE[insumo.unidad_medida] ?? insumo.unidad_medida} que
            consume 1 servicio.
          </p>
        )}
      </div>
      <button
        type="submit"
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors"
      >
        Agregar
      </button>
    </form>
  );
}
