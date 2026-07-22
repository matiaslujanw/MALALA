"use client";

import { useState } from "react";
import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "./field";
import { marcarLiquidacionPagada } from "@/lib/data/liquidaciones";
import type { MedioPago } from "@/lib/types";

interface Props {
  liquidacionId: string;
  mediosPago: MedioPago[];
}

export function MarcarPagadaForm({ liquidacionId, mediosPago }: Props) {
  const { pending, run } = useTransitionFeedback();
  const efectivo = mediosPago.find((m) => m.codigo === "EF");
  const [mpId, setMpId] = useState(efectivo?.id ?? mediosPago[0]?.id ?? "");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("mp_id", mpId);
    fd.set("observacion", observacion);
    run(
      async () => {
        const res = await marcarLiquidacionPagada(liquidacionId, fd);
        if (!res.ok) {
          setError(Object.values(res.errors).flat().join(", ") || "Error");
        }
        return res;
      },
      {
        refreshOnSuccess: true,
        successMessage: "Liquidacion marcada como pagada",
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-border bg-card p-5"
    >
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        Registrar pago
      </h2>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Medio de pago
        </label>
        <select
          value={mpId}
          onChange={(e) => setMpId(e.target.value)}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          {mediosPago.map((medio) => (
            <option key={medio.id} value={medio.id}>
              {medio.codigo} - {medio.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Observacion
        </label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <LoadingButton
        type="submit"
        pending={pending}
        pendingLabel="Guardando..."
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-brown-700"
      >
        Marcar pagada
      </LoadingButton>
    </form>
  );
}
