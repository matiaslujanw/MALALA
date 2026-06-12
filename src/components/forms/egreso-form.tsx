"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CurrencyField, Field, FormButtons, GlobalError, SelectField } from "./field";
import type {
  Insumo,
  MedioPago,
  Proveedor,
  RubroGasto,
  Sucursal,
} from "@/lib/types";
import type { CreateEgresoResult } from "@/lib/data/egresos";

const UNIDAD_LABEL: Record<string, string> = {
  ud: "ud",
  ml: "ml",
  g: "g",
  aplicacion: "apl.",
};

interface Props {
  sucursales: Sucursal[];
  defaultSucursalId: string;
  rubros: RubroGasto[];
  proveedores: Proveedor[];
  mediosPago: MedioPago[];
  insumos: Insumo[];
  defaultFecha: string; // YYYY-MM-DD
  defaultProveedorId?: string;
  defaultEsCompraInsumo?: boolean;
  action: (
    state: CreateEgresoResult | null,
    formData: FormData,
  ) => Promise<CreateEgresoResult>;
  compraAction: (
    state: CreateEgresoResult | null,
    formData: FormData,
  ) => Promise<CreateEgresoResult>;
}

export function EgresoForm({
  sucursales,
  defaultSucursalId,
  rubros,
  proveedores,
  mediosPago,
  insumos,
  defaultFecha,
  defaultProveedorId,
  defaultEsCompraInsumo,
  action,
  compraAction,
}: Props) {
  const router = useRouter();

  const [pagado, setPagado] = useState(true);
  const [esCompraInsumo, setEsCompraInsumo] = useState(
    defaultEsCompraInsumo ?? false,
  );
  const [sucursalId, setSucursalId] = useState(defaultSucursalId);
  const [proveedorId, setProveedorId] = useState(defaultProveedorId ?? "");
  const [insumoId, setInsumoId] = useState("");

  const mediosVisibles = useMemo(
    () =>
      mediosPago.filter(
        (m) => m.sucursal_id === sucursalId && m.activo,
      ),
    [mediosPago, sucursalId],
  );

  // Si hay proveedor elegido, priorizamos sus insumos; si no, mostramos todos.
  const insumosVisibles = useMemo(() => {
    const activos = insumos.filter((i) => i.activo);
    if (!proveedorId) return activos;
    const delProveedor = activos.filter((i) => i.proveedor_id === proveedorId);
    return delProveedor.length > 0 ? delProveedor : activos;
  }, [insumos, proveedorId]);

  const insumoSel = useMemo(
    () => insumos.find((i) => i.id === insumoId) ?? null,
    [insumos, insumoId],
  );

  const [state, formAction, pending] = useActionState<
    CreateEgresoResult | null,
    FormData
  >(async (prev, fd) => {
    const result = esCompraInsumo
      ? await compraAction(prev, fd)
      : await action(prev, fd);
    if (result.ok) {
      router.push("/egresos");
      router.refresh();
    }
    return result;
  }, null);

  const errors = state && !state.ok ? state.errors : {};

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <label className="flex items-center gap-2 rounded-md border border-border bg-cream/30 px-3 py-2.5 text-sm">
        <input
          type="checkbox"
          name="es_compra_insumo"
          checked={esCompraInsumo}
          onChange={(e) => setEsCompraInsumo(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-sage-500"
        />
        <span className="font-medium">Es compra de insumo</span>
        <span className="text-xs text-muted-foreground">
          (suma stock y actualiza el precio del insumo)
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Fecha"
          name="fecha"
          type="date"
          defaultValue={defaultFecha}
          error={errors.fecha}
          required
        />
        <SelectField
          label="Sucursal"
          name="sucursal_id"
          value={sucursalId}
          onChange={(e) => setSucursalId(e.currentTarget.value)}
          error={errors.sucursal_id}
          options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          required
        />
      </div>

      {esCompraInsumo ? (
        // El rubro lo asigna automáticamente el backend (rubro "Insumos").
        <p className="text-xs text-muted-foreground">
          Se registra bajo el rubro <strong>Insumos</strong> automáticamente.
        </p>
      ) : (
        <>
          <SelectField
            label="Rubro"
            name="rubro_id"
            error={errors.rubro_id}
            options={rubros
              .filter((r) => r.activo)
              .map((r) => ({
                value: r.id,
                label: r.subrubro ? `${r.rubro} · ${r.subrubro}` : r.rubro,
              }))}
            placeholder="Seleccioná rubro"
            required
          />
          <input type="hidden" name="insumo_id" value="" />
        </>
      )}

      <SelectField
        label={esCompraInsumo ? "Proveedor" : "Proveedor (opcional)"}
        name="proveedor_id"
        value={proveedorId}
        onChange={(e) => setProveedorId(e.currentTarget.value)}
        error={errors.proveedor_id}
        options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
        placeholder="—"
      />

      {esCompraInsumo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border border-border bg-card p-4">
          <SelectField
            label="Insumo"
            name="insumo_id"
            value={insumoId}
            onChange={(e) => setInsumoId(e.currentTarget.value)}
            error={errors.insumo_id}
            options={insumosVisibles.map((i) => ({
              value: i.id,
              label: i.nombre,
            }))}
            placeholder={
              insumosVisibles.length === 0
                ? "No hay insumos cargados"
                : "Seleccioná insumo"
            }
            required
          />
          <div className="space-y-1.5">
            <label
              htmlFor="cantidad"
              className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Cantidad de envases
            </label>
            <input
              id="cantidad"
              type="number"
              name="cantidad"
              min="1"
              step="1"
              defaultValue={1}
              required={esCompraInsumo}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring tabular-nums text-right"
            />
            {insumoSel && (
              <p className="text-[10px] text-muted-foreground">
                Cada envase trae {insumoSel.tamano_envase}{" "}
                {UNIDAD_LABEL[insumoSel.unidad_medida] ?? insumoSel.unidad_medida}
              </p>
            )}
            {errors.cantidad && (
              <p className="text-xs text-destructive">
                {errors.cantidad.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyField
          label={esCompraInsumo ? "Monto total pagado" : "Monto"}
          name="valor"
          error={errors.valor}
          required
        />
        <SelectField
          label="Medio de pago"
          name="mp_id"
          error={errors.mp_id}
          options={mediosVisibles.map((m) => ({
            value: m.id,
            label: m.nombre,
          }))}
          placeholder={
            mediosVisibles.length === 0
              ? "Cargá un medio en esta sucursal"
              : "Seleccioná medio"
          }
          required
        />
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
          (si está sin tildar y hay proveedor, suma a la deuda)
        </span>
      </label>

      <div className="space-y-1.5">
        <label
          htmlFor="observacion"
          className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Observación
        </label>
        <textarea
          id="observacion"
          name="observacion"
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.observacion && (
          <p className="text-xs text-destructive">
            {errors.observacion.join(", ")}
          </p>
        )}
      </div>

      <GlobalError error={errors._} />

      <FormButtons
        cancelHref="/egresos"
        submitLabel={esCompraInsumo ? "Registrar compra" : "Registrar gasto"}
        pending={pending}
      />
    </form>
  );
}
