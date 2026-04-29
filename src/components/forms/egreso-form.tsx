"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormButtons, GlobalError, SelectField } from "./field";
import type {
  Insumo,
  MedioPago,
  Proveedor,
  RubroGasto,
  Sucursal,
} from "@/lib/types";
import type { CreateEgresoResult } from "@/lib/data/egresos";

interface Props {
  sucursales: Sucursal[];
  defaultSucursalId: string;
  rubros: RubroGasto[];
  insumos: Insumo[];
  proveedores: Proveedor[];
  mediosPago: MedioPago[];
  defaultFecha: string; // YYYY-MM-DD
  action: (
    state: CreateEgresoResult | null,
    formData: FormData,
  ) => Promise<CreateEgresoResult>;
}

export function EgresoForm({
  sucursales,
  defaultSucursalId,
  rubros,
  insumos,
  proveedores,
  mediosPago,
  defaultFecha,
  action,
}: Props) {
  const router = useRouter();

  const [rubroId, setRubroId] = useState("");
  const [insumoId, setInsumoId] = useState("");
  const [pagado, setPagado] = useState(true);

  const rubroSel = useMemo(
    () => rubros.find((r) => r.id === rubroId) ?? null,
    [rubros, rubroId],
  );
  const esInsumo =
    rubroSel?.rubro?.toLowerCase() === "insumos" ||
    rubroSel?.rubro?.toLowerCase().includes("insumo");

  const [state, formAction, pending] = useActionState<
    CreateEgresoResult | null,
    FormData
  >(async (prev, fd) => {
    const result = await action(prev, fd);
    if (result.ok) {
      router.push("/egresos");
      router.refresh();
    }
    return result;
  }, null);

  const errors = state && !state.ok ? state.errors : {};

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
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
          defaultValue={defaultSucursalId}
          error={errors.sucursal_id}
          options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          required
        />
      </div>

      <SelectField
        label="Rubro"
        name="rubro_id"
        value={rubroId}
        onChange={(e) => {
          setRubroId(e.target.value);
          setInsumoId("");
        }}
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

      {/* Bloque condicional: si rubro es Insumos, mostrar selector + cantidad */}
      {esInsumo && (
        <div className="bg-cream/40 border border-border rounded-md p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Compra de insumo (suma stock)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Insumo"
              name="insumo_id"
              value={insumoId}
              onChange={(e) => setInsumoId(e.target.value)}
              error={errors.insumo_id}
              options={insumos.map((i) => ({
                value: i.id,
                label: i.nombre,
              }))}
              placeholder="Sin vincular"
            />
            <Field
              label="Cantidad recibida"
              name="cantidad"
              type="number"
              step="0.01"
              min={0}
              error={errors.cantidad}
              hint="Se sumará al stock de la sucursal"
            />
          </div>
        </div>
      )}
      {/* Si no es insumo, mandar input vacío de cantidad para que no se cuele */}
      {!esInsumo && <input type="hidden" name="insumo_id" value="" />}

      <SelectField
        label="Proveedor (opcional)"
        name="proveedor_id"
        error={errors.proveedor_id}
        options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
        placeholder="—"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Monto"
          name="valor"
          type="number"
          step="0.01"
          min={0}
          error={errors.valor}
          required
        />
        <SelectField
          label="Medio de pago"
          name="mp_id"
          error={errors.mp_id}
          options={mediosPago.map((m) => ({
            value: m.id,
            label: m.nombre,
          }))}
          placeholder="Seleccioná medio"
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
        submitLabel="Registrar egreso"
        pending={pending}
      />
    </form>
  );
}
