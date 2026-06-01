"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { CurrencyInput } from "./currency-input";
import type {
  Insumo,
  MedioPago,
  Proveedor,
  Sucursal,
} from "@/lib/types";
import { registrarCompraInsumo } from "@/lib/data/insumos";
import type { CreateEgresoResult } from "@/lib/data/egresos";
import { formatARS } from "@/lib/utils";

interface Props {
  insumo: Insumo;
  proveedor: Proveedor | null;
  sucursales: Sucursal[];
  mediosPago: MedioPago[];
  defaultSucursalId: string;
  triggerLabel?: string;
}

const UNIDAD_LABEL: Record<string, string> = {
  ud: "ud",
  ml: "ml",
  g: "g",
  aplicacion: "apl.",
};

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RegistrarCompraInsumoModal({
  insumo,
  proveedor,
  sucursales,
  mediosPago,
  defaultSucursalId,
  triggerLabel = "Registrar compra",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sucursalId, setSucursalId] = useState(defaultSucursalId);
  const [cantidad, setCantidad] = useState<number>(1);
  const [valor, setValor] = useState<number>(0);
  const [pagado, setPagado] = useState(true);

  const mediosVisibles = useMemo(
    () => mediosPago.filter((m) => m.sucursal_id === sucursalId && m.activo),
    [mediosPago, sucursalId],
  );

  const [state, formAction, pending] = useActionState<
    CreateEgresoResult | null,
    FormData
  >(async (prev, fd) => {
    const result = await registrarCompraInsumo(prev, fd);
    if (result.ok) {
      router.refresh();
      setOpen(false);
      setCantidad(1);
      setValor(0);
    }
    return result;
  }, null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, pending]);

  const errors = state && !state.ok ? state.errors : {};
  const precioUnitarioCalc =
    cantidad > 0 && valor > 0 ? valor / cantidad : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-md shadow-lg w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg tracking-[0.15em] uppercase">
                  Registrar compra
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {insumo.nombre}
                  {proveedor ? ` · ${proveedor.nombre}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 stroke-[1.5]" />
              </button>
            </div>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="insumo_id" value={insumo.id} />
              {insumo.proveedor_id && (
                <input
                  type="hidden"
                  name="proveedor_id"
                  value={insumo.proveedor_id}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Fecha
                  </label>
                  <input
                    type="date"
                    name="fecha"
                    defaultValue={todayYMD()}
                    required
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Sucursal
                  </label>
                  <select
                    name="sucursal_id"
                    value={sucursalId}
                    onChange={(e) => setSucursalId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
                  >
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cantidad de envases
                  </label>
                  <input
                    type="number"
                    name="cantidad"
                    min="1"
                    step="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring tabular-nums text-right"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Cada envase trae {insumo.tamano_envase}{" "}
                    {UNIDAD_LABEL[insumo.unidad_medida] ?? insumo.unidad_medida}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Monto total pagado
                  </label>
                  <CurrencyInput
                    value={valor}
                    onChange={setValor}
                    min={0}
                    className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input type="hidden" name="valor" value={valor} />
                  {precioUnitarioCalc != null && (
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      Precio por envase: {formatARS(precioUnitarioCalc)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Medio de pago
                </label>
                <select
                  name="mp_id"
                  required
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
                >
                  <option value="">
                    {mediosVisibles.length === 0
                      ? "Cargá un medio en esta sucursal"
                      : "Seleccioná"}
                  </option>
                  {mediosVisibles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codigo} — {m.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="pagado"
                  checked={pagado}
                  onChange={(e) => setPagado(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-sage-500"
                />
                <span>Pagado</span>
                <span className="text-xs text-muted-foreground">
                  (sin tildar, suma a la deuda del proveedor)
                </span>
              </label>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Observación
                </label>
                <textarea
                  name="observacion"
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {Object.entries(errors).map(([k, v]) => (
                <p key={k} className="text-xs text-destructive">
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </p>
              ))}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-cream transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending || cantidad <= 0 || valor <= 0}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
                >
                  {pending ? "Guardando…" : "Registrar compra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
