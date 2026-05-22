"use client";

import { useState } from "react";
import { CrudForm } from "./crud-form";
import { CurrencyInput } from "./currency-input";
import { CheckboxField, Field, SelectField } from "./field";
import type { Insumo, MedioPago, Proveedor, Sucursal } from "@/lib/types";
import type { ActionResult } from "@/lib/data/_helpers";

interface Props {
  insumo?: Insumo;
  proveedores: Proveedor[];
  /**
   * Cuando se pasa junto a mediosPago, se muestra la sección opcional
   * "Cargar primera compra" para crear un egreso inicial al guardar.
   */
  sucursales?: Sucursal[];
  mediosPago?: MedioPago[];
  defaultSucursalId?: string;
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  submitLabel: string;
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const UNIDADES = [
  { value: "ud", label: "Unidad" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "g", label: "Gramos (g)" },
  { value: "aplicacion", label: "Aplicación" },
];

function CurrencyField({
  label,
  name,
  defaultValue,
  error,
  hint,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: number;
  error?: string[];
  hint?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState<number>(defaultValue ?? 0);
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <CurrencyInput
        id={name}
        value={value}
        onChange={setValue}
        min={0}
        className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <input type="hidden" name={name} value={value} />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error.join(", ")}</p>}
      {required && <input type="hidden" data-required="true" />}
    </div>
  );
}

export function InsumoForm({
  insumo,
  proveedores,
  sucursales,
  mediosPago,
  defaultSucursalId,
  action,
  submitLabel,
}: Props) {
  const [vendible, setVendible] = useState<boolean>(insumo?.vendible ?? false);
  const mostrarCompraInicial =
    !insumo &&
    sucursales !== undefined &&
    sucursales.length > 0 &&
    mediosPago !== undefined;
  const [cargarCompra, setCargarCompra] = useState(false);
  const [compraSucursalId, setCompraSucursalId] = useState(
    defaultSucursalId ?? sucursales?.[0]?.id ?? "",
  );
  const [compraCantidad, setCompraCantidad] = useState<number>(1);
  const [compraValor, setCompraValor] = useState<number>(0);
  const [compraPagado, setCompraPagado] = useState(true);
  const mediosDeCompra =
    mediosPago?.filter(
      (m) => m.sucursal_id === compraSucursalId && m.activo,
    ) ?? [];

  return (
    <CrudForm
      action={action}
      redirectTo="/catalogos/insumos"
      submitLabel={submitLabel}
    >
      {(errors) => (
        <>
          <Field
            label="Nombre"
            name="nombre"
            defaultValue={insumo?.nombre}
            error={errors.nombre}
            required
          />
          <SelectField
            label="Proveedor"
            name="proveedor_id"
            defaultValue={insumo?.proveedor_id ?? ""}
            error={errors.proveedor_id}
            options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
            placeholder="— sin proveedor —"
          />
          <SelectField
            label="Unidad de medida"
            name="unidad_medida"
            defaultValue={insumo?.unidad_medida ?? "ml"}
            error={errors.unidad_medida}
            options={UNIDADES}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Tamaño envase"
              name="tamano_envase"
              type="number"
              step="0.01"
              defaultValue={insumo?.tamano_envase}
              error={errors.tamano_envase}
              hint="En la unidad seleccionada"
              required
            />
            <CurrencyField
              label="Precio envase"
              name="precio_envase"
              defaultValue={insumo?.precio_envase}
              error={errors.precio_envase}
              required
            />
          </div>
          <Field
            label="Umbral stock bajo"
            name="umbral_stock_bajo"
            type="number"
            step="0.01"
            defaultValue={insumo?.umbral_stock_bajo ?? 0}
            error={errors.umbral_stock_bajo}
            hint="Si el stock baja de este valor, se marca como bajo en la pantalla de stock"
            required
          />
          <CheckboxField
            label="Activo"
            name="activo"
            defaultChecked={insumo?.activo ?? true}
          />

          <div className="pt-2 border-t border-border space-y-3">
            <CheckboxField
              label="También se vende al público"
              name="vendible"
              defaultChecked={vendible}
              onChange={(e) => setVendible(e.currentTarget.checked)}
            />
            {vendible && (
              <CurrencyField
                label="Precio de venta"
                name="precio_venta"
                defaultValue={insumo?.precio_venta}
                error={errors.precio_venta}
                hint="Precio sugerido para vender este producto en una venta"
              />
            )}
          </div>

          {mostrarCompraInicial && (
            <div className="pt-2 border-t border-border space-y-3">
              <CheckboxField
                label="Cargar primera compra ahora"
                name="cargar_compra"
                defaultChecked={cargarCompra}
                onChange={(e) => setCargarCompra(e.currentTarget.checked)}
              />
              {cargarCompra && (
                <div className="bg-cream/40 border border-border rounded-md p-4 space-y-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Genera un gasto y suma stock a la sucursal seleccionada.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Fecha
                      </label>
                      <input
                        type="date"
                        name="compra_fecha"
                        defaultValue={todayYMD()}
                        className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Sucursal
                      </label>
                      <select
                        name="compra_sucursal_id"
                        value={compraSucursalId}
                        onChange={(e) => setCompraSucursalId(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
                      >
                        {sucursales!.map((s) => (
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
                        name="compra_cantidad"
                        min="1"
                        step="1"
                        value={compraCantidad}
                        onChange={(e) =>
                          setCompraCantidad(Number(e.target.value))
                        }
                        className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring tabular-nums text-right"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Monto total pagado
                      </label>
                      <CurrencyInput
                        name="compra_valor"
                        value={compraValor}
                        onChange={setCompraValor}
                        min={0}
                        className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Medio de pago
                    </label>
                    <select
                      name="compra_mp_id"
                      className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
                    >
                      <option value="">
                        {mediosDeCompra.length === 0
                          ? "Cargá un medio en esta sucursal"
                          : "Seleccioná"}
                      </option>
                      {mediosDeCompra.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.codigo} — {m.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="compra_pagado"
                      checked={compraPagado}
                      onChange={(e) => setCompraPagado(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-sage-500"
                    />
                    <span>Pagado</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </CrudForm>
  );
}
