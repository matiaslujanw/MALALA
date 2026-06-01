"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anularLiquidacion } from "@/lib/data/liquidaciones";

interface Props {
  liquidacionId: string;
}

export function AnularLiquidacionForm({ liquidacionId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAnular() {
    setError(null);
    startTransition(async () => {
      const res = await anularLiquidacion(liquidacionId);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", ") || "Error");
        return;
      }
      router.push("/liquidaciones");
    });
  }

  return (
    <section className="bg-card border border-border rounded-md p-5 space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        Zona de riesgo
      </h2>
      <p className="text-xs text-muted-foreground">
        Anular elimina la liquidación, revierte el egreso/pago asociado y libera
        las líneas para que puedan volver a liquidarse.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="w-full border border-destructive/40 text-destructive px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-destructive/5 transition-colors"
        >
          Anular liquidación
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAnular}
            disabled={pending}
            className="flex-1 bg-destructive text-destructive-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {pending ? "Anulando…" : "Confirmar anulación"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            disabled={pending}
            className="px-4 py-2 rounded-md border border-border text-sm uppercase tracking-wider hover:bg-cream transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </section>
  );
}
