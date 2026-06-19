"use client";

import { Check, Undo2 } from "lucide-react";
import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "@/components/forms/field";
import { togglePagadoEgreso } from "@/lib/data/egresos-actions";

export function TogglePagadoButton({
  egresoId,
  pagado,
}: {
  egresoId: string;
  pagado: boolean;
}) {
  const { pending, run } = useTransitionFeedback();

  const className = pagado
    ? "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:bg-cream disabled:opacity-50"
    : "inline-flex items-center gap-1.5 rounded-md bg-sage-700 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-sage-900 disabled:opacity-50";

  return (
    <LoadingButton
      type="button"
      pending={pending}
      pendingLabel={pagado ? "Actualizando..." : "Guardando..."}
      onClick={() =>
        run(() => togglePagadoEgreso(egresoId), {
          refreshOnSuccess: true,
          successMessage: pagado
            ? "Egreso marcado como pendiente"
            : "Egreso marcado como pagado",
        })
      }
      className={className}
    >
      {pagado ? (
        <>
          <Undo2 className="h-3.5 w-3.5 stroke-[2]" />
          Marcar pendiente
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
          Marcar pagado
        </>
      )}
    </LoadingButton>
  );
}
