"use client";

import { useState } from "react";
import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "./field";
import { anularLiquidacion } from "@/lib/data/liquidaciones";

interface Props {
  liquidacionId: string;
}

export function AnularLiquidacionForm({ liquidacionId }: Props) {
  const { pending, run } = useTransitionFeedback();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAnular() {
    setError(null);
    run(
      async () => {
        const res = await anularLiquidacion(liquidacionId);
        if (!res.ok) {
          setError(Object.values(res.errors).flat().join(", ") || "Error");
        }
        return res;
      },
      {
        redirectTo: "/liquidaciones",
        successMessage: "Liquidacion anulada",
      },
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-5">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        Zona de riesgo
      </h2>
      <p className="text-xs text-muted-foreground">
        Anular elimina la liquidacion, revierte el egreso o pago asociado y
        libera las lineas para que puedan volver a liquidarse.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="w-full rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/5"
        >
          Anular liquidacion
        </button>
      ) : (
        <div className="flex gap-2">
          <LoadingButton
            type="button"
            onClick={handleAnular}
            pending={pending}
            pendingLabel="Anulando..."
            className="flex-1 rounded-md bg-destructive px-4 py-2 text-sm font-medium uppercase tracking-wider text-destructive-foreground transition-opacity hover:opacity-90"
          >
            Confirmar anulacion
          </LoadingButton>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            disabled={pending}
            className="rounded-md border border-border px-4 py-2 text-sm uppercase tracking-wider transition-colors hover:bg-cream"
          >
            Cancelar
          </button>
        </div>
      )}
    </section>
  );
}
