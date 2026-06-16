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
  cantidadVendibles: number;
}

type Target = "costo" | "venta";

export function AumentoPreciosProveedorForm({
  proveedorId,
  proveedorNombre,
  cantidadInsumos,
  cantidadVendibles,
}: Props) {
  const router = useRouter();
  const [pct, setPct] = useState("");
  const [target, setTarget] = useState<Target>("costo");

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

  const cantidad = target === "venta" ? cantidadVendibles : cantidadInsumos;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const n = Number(pct);
    const signo = n > 0 ? "+" : "";
    const detalle =
      target === "venta"
        ? `al precio de venta de los ${cantidad} productos vendibles de ${proveedorNombre}?\n\nActualiza el precio de venta (no el costo).`
        : `al costo de los ${cantidad} insumos de ${proveedorNombre}?\n\nActualiza el costo de reposición (no el precio de venta).`;
    const ok = window.confirm(`¿Aplicar ${signo}${pct}% ${detalle}`);
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
        Aplica un % a todos los items de este proveedor de una vez. Elegí si
        afecta el <strong>costo</strong> o el <strong>precio de venta</strong>.
        Usá un valor negativo para una baja.
      </p>

      <form
        action={formAction}
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="proveedor_id" value={proveedorId} />
        <input type="hidden" name="target" value={target} />

        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Aplicar a
          </label>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setTarget("costo")}
              className={`px-3 py-2 text-sm transition-colors ${
                target === "costo"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-cream/50"
              }`}
            >
              Costo
            </button>
            <button
              type="button"
              onClick={() => setTarget("venta")}
              className={`px-3 py-2 text-sm transition-colors border-l border-border ${
                target === "venta"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-cream/50"
              }`}
            >
              Precio de venta
            </button>
          </div>
        </div>

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
          disabled={pending || cantidad === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700 disabled:opacity-50"
        >
          {pending ? "Aplicando…" : "Aplicar aumento"}
        </button>
      </form>

      {target === "venta" && cantidadVendibles === 0 && (
        <p className="text-xs text-muted-foreground">
          Este proveedor no tiene productos vendibles con precio de venta
          cargado.
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {state?.ok && (
        <p className="text-xs text-sage-700">
          Listo: {state.actualizados} item
          {state.actualizados !== 1 ? "s" : ""} actualizado
          {state.actualizados !== 1 ? "s" : ""}.
        </p>
      )}
    </section>
  );
}
