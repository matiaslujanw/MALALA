"use client";

import { useTransition } from "react";
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
      className="text-xs uppercase tracking-wider px-2 py-1 rounded border border-border hover:bg-cream transition-colors disabled:opacity-50"
    >
      {pending ? "…" : pagado ? "Marcar pendiente" : "Marcar pagado"}
    </button>
  );
}
