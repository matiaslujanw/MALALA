"use client";

import { useTransition } from "react";
import { Check, Undo2 } from "lucide-react";
import { togglePagadoEgreso } from "@/lib/data/egresos-actions";
import { useRouter } from "next/navigation";

export function TogglePagadoButton({
  egresoId,
  pagado,
}: {
  egresoId: string;
  pagado: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  // Pendiente → CTA verde llamativo para saldarlo.
  // Pagado → botón sutil para revertir.
  const className = pagado
    ? "inline-flex items-center gap-1.5 text-xs uppercase tracking-wider px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-cream transition-colors disabled:opacity-50"
    : "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-md bg-sage-700 text-white hover:bg-sage-900 transition-colors disabled:opacity-50";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await togglePagadoEgreso(egresoId);
          router.refresh();
        })
      }
      className={className}
    >
      {pending ? (
        "…"
      ) : pagado ? (
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
    </button>
  );
}
