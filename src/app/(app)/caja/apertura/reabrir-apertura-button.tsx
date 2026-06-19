"use client";

import { useState } from "react";
import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "@/components/forms/field";
import { reabrirApertura } from "@/lib/data/apertura-caja";

export function ReabrirAperturaButton({ aperturaId }: { aperturaId: string }) {
  const { pending, run } = useTransitionFeedback();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  function handleClick() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setError(null);
    run(
      async () => {
        const res = await reabrirApertura(aperturaId);
        if (!res.ok) {
          setError(Object.values(res.errors).flat().join(", ") || "Error");
          setConfirmando(false);
        }
        return res;
      },
      {
        refreshOnSuccess: true,
        successMessage: "Apertura reabierta",
      },
    );
  }

  return (
    <div className="flex items-center gap-2">
      <LoadingButton
        type="button"
        onClick={handleClick}
        pending={pending}
        pendingLabel="Reabriendo..."
        className="rounded-md border border-amber-400 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-50"
      >
        {confirmando ? "Confirmar: deshacer apertura" : "Reabrir / corregir"}
      </LoadingButton>
      {confirmando && !pending && (
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
