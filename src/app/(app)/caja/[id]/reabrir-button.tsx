"use client";

import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "@/components/forms/field";
import { reabrirCierre } from "@/lib/data/caja-actions";

export function ReabrirCierreButton({ cierreId }: { cierreId: string }) {
  const { pending, run } = useTransitionFeedback();

  return (
    <LoadingButton
      type="button"
      pending={pending}
      pendingLabel="Reabriendo..."
      onClick={() => {
        if (
          !confirm(
            "¿Reabrir este cierre? Se va a borrar y vas a poder cargar mas movimientos en ese dia.",
          )
        ) {
          return;
        }
        run(() => reabrirCierre(cierreId), {
          redirectTo: "/caja",
          successMessage: "Cierre reabierto",
        });
      }}
      className="rounded-md border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors disabled:opacity-50"
      style={{
        borderColor: "var(--danger)",
        color: "var(--danger)",
      }}
    >
      Reabrir cierre
    </LoadingButton>
  );
}
