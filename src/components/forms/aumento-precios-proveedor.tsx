"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import {
  aumentarPreciosProveedor,
  type AumentoPreciosResult,
} from "@/lib/data/insumos";

interface Props {
  proveedorId: string;
  proveedorNombre: string;
  cantidadInsumos: number;
}

export function AumentoPreciosProveedorForm({
  proveedorId,
  proveedorNombre,
  cantidadInsumos,
}: Props) {
  const router = useRouter();
  const [pct, setPct] = useState("");

  const [state, formAction, pending] = useActionState<
    AumentoPreciosResult | null,
    FormData
  >(async (prev, fd) => {
    const result = await aumentarPreciosProveedor(prev, fd);
    if (result.ok) {
      router.refresh();
      setPct("");
    }
    return result;
  }, null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const n = Number(pct);
    const signo = n > 0 ? "+" : "";
    const ok = window.confirm(
      `¿Aplicar ${signo}${pct}% al costo de los ${cantidadInsumos} insumos de ${proveedorNombre}?\n\nActualiza el costo de reposición (no el precio de venta).`,
    );
    if (!ok) e.preventDefault();
  }

  const error = state && !state.ok ? (state.errors.pct?.[0] ?? state.errors._?.[0]) : null;

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-sage-700 stroke-[1.5]" />
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Aumento masivo de precios
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Aplica un % al <strong>costo</strong> de todos los insumos de este
        proveedor de una vez. Usá un valor negativo para una baja. No modifica el
        precio de venta.
      </p>

      <form
        action={formAction}
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="proveedor_id" value={proveedorId} />
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Porcentaje
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              name="pct"
              step="0.1"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="15"
              required
              className="w-28 rounded-md border border-border bg-card px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={pending || cantidadInsumos === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700 disabled:opacity-50"
        >
          {pending ? "Aplicando…" : "Aplicar aumento"}
        </button>
      </form>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {state?.ok && (
        <p className="text-xs text-sage-700">
          Listo: {state.actualizados} insumo
          {state.actualizados !== 1 ? "s" : ""} actualizado
          {state.actualizados !== 1 ? "s" : ""}.
        </p>
      )}
    </section>
  );
}
