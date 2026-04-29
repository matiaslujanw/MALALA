"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { reabrirCierre } from "@/lib/data/caja";

export function ReabrirCierreButton({ cierreId }: { cierreId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "¿Reabrir este cierre? Se va a borrar y vas a poder cargar más movimientos en ese día.",
          )
        )
          return;
        start(async () => {
          const res = await reabrirCierre(cierreId);
          if (res.ok) {
            router.push("/caja");
            router.refresh();
          } else {
            alert(res.errors._?.[0] ?? "No se pudo reabrir");
          }
        });
      }}
      className="px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider border transition-colors disabled:opacity-50"
      style={{
        borderColor: "var(--danger)",
        color: "var(--danger)",
      }}
    >
      {pending ? "Reabriendo…" : "Reabrir cierre"}
    </button>
  );
}
