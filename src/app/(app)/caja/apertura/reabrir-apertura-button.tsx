"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reabrirApertura } from "@/lib/data/apertura-caja";

export function ReabrirAperturaButton({ aperturaId }: { aperturaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  function handleClick() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await reabrirApertura(aperturaId);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", ") || "Error");
        setConfirmando(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="px-4 py-2 rounded-md text-sm font-medium border border-amber-400 text-amber-800 hover:bg-amber-50 disabled:opacity-50 transition-colors"
      >
        {pending
          ? "Reabriendo…"
          : confirmando
            ? "Confirmar: deshacer apertura"
            : "Reabrir / corregir"}
      </button>
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
