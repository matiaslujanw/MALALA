"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarLiquidacionPagada } from "@/lib/data/liquidaciones";
import type { MedioPago } from "@/lib/types";

interface Props {
  liquidacionId: string;
  mediosPago: MedioPago[];
}

export function MarcarPagadaForm({ liquidacionId, mediosPago }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const efectivo = mediosPago.find((m) => m.codigo === "EF");
  const [mpId, setMpId] = useState(efectivo?.id ?? mediosPago[0]?.id ?? "");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("mp_id", mpId);
    fd.set("observacion", observacion);
    startTransition(async () => {
      const res = await marcarLiquidacionPagada(liquidacionId, fd);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", ") || "Error");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-md p-5 space-y-3"
    >
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        Registrar pago
      </h2>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Medio de pago
        </label>
        <select
          value={mpId}
          onChange={(e) => setMpId(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
        >
          {mediosPago.map((m) => (
            <option key={m.id} value={m.id}>
              {m.codigo} — {m.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Observación
        </label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Guardando…" : "Marcar pagada"}
      </button>
    </form>
  );
}
