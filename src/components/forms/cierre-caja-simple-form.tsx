"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCierre } from "@/lib/data/caja";

interface Props {
  sucursalId: string;
  fecha: string;
}

export function CierreCajaSimpleForm({ sucursalId, fecha }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("sucursal_id", sucursalId);
    fd.set("fecha", fecha);
    fd.set("observacion", observacion);
    startTransition(async () => {
      const res = await createCierre(null, fd);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", ") || "Error");
        return;
      }
      router.push(`/caja/${res.cierreId}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-md p-5 space-y-4"
    >
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        Confirmar cierre
      </h2>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Observación (opcional)
        </label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Notas del día…"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Cerrando…" : "Cerrar caja"}
      </button>
    </form>
  );
}
