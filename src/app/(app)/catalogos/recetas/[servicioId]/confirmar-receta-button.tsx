"use client";

import { Check } from "lucide-react";
import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "@/components/forms/field";
import { confirmarRecetaServicio } from "@/lib/data/recetas";

/**
 * Da por buenas de una sola vez todas las líneas que el sistema propuso desde
 * la planilla, para no tener que tocar cantidad por cantidad.
 */
export function ConfirmarRecetaButton({
  servicioId,
  sucursalId,
  pendientes,
}: {
  servicioId: string;
  sucursalId: string;
  pendientes: number;
}) {
  const { pending, run } = useTransitionFeedback();

  return (
    <LoadingButton
      type="button"
      pending={pending}
      pendingLabel="Confirmando..."
      onClick={() =>
        run(() => confirmarRecetaServicio(servicioId, sucursalId), {
          refreshOnSuccess: true,
          successMessage: `Receta confirmada · ${pendientes} ${
            pendientes === 1 ? "línea" : "líneas"
          }`,
        })
      }
      className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-brown-700 disabled:opacity-50"
    >
      <Check className="h-4 w-4 stroke-[2]" />
      Confirmar receta
    </LoadingButton>
  );
}
