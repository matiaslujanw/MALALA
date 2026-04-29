"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, AlertTriangle } from "lucide-react";
import { createIngreso } from "@/lib/data/ingresos";
import type {
  Cliente,
  Empleado,
  MedioPago,
  Servicio,
} from "@/lib/types";
import { formatARS } from "@/lib/utils";

interface LineaForm {
  tempId: string;
  servicio_id: string;
  empleado_id: string;
  precio: number;
  comision_pct: number;
}

interface Props {
  sucursalId: string;
  sucursalNombre: string;
  clientes: Cliente[];
  servicios: Servicio[];
  empleados: Empleado[];
  mediosPago: MedioPago[];
}

const newLinea = (): LineaForm => ({
  tempId: crypto.randomUUID(),
  servicio_id: "",
  empleado_id: "",
  precio: 0,
  comision_pct: 30,
});

export function NuevaVentaForm({
  sucursalId,
  sucursalNombre,
  clientes,
  servicios,
  empleados,
  mediosPago,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Header
  const [clienteId, setClienteId] = useState("");
  const [observacion, setObservacion] = useState("");

  // Líneas
  const [lineas, setLineas] = useState<LineaForm[]>([newLinea()]);

  // Descuento
  const [descTipo, setDescTipo] = useState<"pct" | "monto">("pct");
  const [descValor, setDescValor] = useState(0);

  // Pagos
  const efectivo = mediosPago.find((m) => m.codigo === "EF");
  const [mp1Id, setMp1Id] = useState(efectivo?.id ?? mediosPago[0]?.id ?? "");
  const [valor1, setValor1] = useState<number>(0);
  const [mp2Id, setMp2Id] = useState("");
  const [valor2, setValor2] = useState<number>(0);

  // Resultado server
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [warnings, setWarnings] = useState<string[]>([]);

  // ----- Cálculos derivados -----
  const subtotal = lineas.reduce((acc, l) => acc + (Number(l.precio) || 0), 0);
  const descMonto =
    descTipo === "pct"
      ? subtotal * (Number(descValor) / 100)
      : Number(descValor) || 0;
  const total = Math.max(0, subtotal - descMonto);
  const totalComisiones = lineas.reduce(
    (acc, l) => acc + (Number(l.precio) || 0) * (Number(l.comision_pct) || 0) / 100,
    0,
  );
  const paraElLocal = total - totalComisiones;
  const pagado = (Number(valor1) || 0) + (Number(valor2) || 0);
  const diff = total - pagado;
  const pagosOk = Math.abs(diff) < 0.01;

  // Comisiones por empleado en este ticket
  const comisionPorEmpleado = lineas.reduce<
    Map<string, { nombre: string; total: number; lineas: number }>
  >((acc, l) => {
    if (!l.empleado_id) return acc;
    const emp = empleados.find((e) => e.id === l.empleado_id);
    if (!emp) return acc;
    const com = (Number(l.precio) || 0) * (Number(l.comision_pct) || 0) / 100;
    const cur = acc.get(emp.id) ?? { nombre: emp.nombre, total: 0, lineas: 0 };
    cur.total += com;
    cur.lineas += 1;
    acc.set(emp.id, cur);
    return acc;
  }, new Map());
  const repartoEmpleados = Array.from(comisionPorEmpleado.values()).sort(
    (a, b) => b.total - a.total,
  );

  // Cuando no hay mp2, valor1 = total automáticamente
  useEffect(() => {
    if (!mp2Id) {
      setValor1(total);
      setValor2(0);
    } else {
      // Mantener valor2 = total - valor1 si valor1 cambió
      setValor2(Math.max(0, total - (Number(valor1) || 0)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, mp2Id]);

  // ----- Helpers de líneas -----
  function updateLinea(idx: number, patch: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function handleServicioChange(idx: number, servicioId: string) {
    const s = servicios.find((x) => x.id === servicioId);
    if (!s) {
      updateLinea(idx, { servicio_id: "" });
      return;
    }
    const empleado = empleados.find((e) => e.id === lineas[idx].empleado_id);
    updateLinea(idx, {
      servicio_id: servicioId,
      precio: s.precio_efectivo,
      comision_pct: empleado?.porcentaje_default ?? s.comision_default_pct,
    });
  }

  function handleEmpleadoChange(idx: number, empleadoId: string) {
    const e = empleados.find((x) => x.id === empleadoId);
    updateLinea(idx, {
      empleado_id: empleadoId,
      comision_pct: e?.porcentaje_default ?? lineas[idx].comision_pct,
    });
  }

  function addLinea() {
    setLineas((prev) => [...prev, newLinea()]);
  }

  function removeLinea(idx: number) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  // ----- Submit -----
  function handleSubmit(formData: FormData) {
    setErrors({});
    setWarnings([]);

    // Validación cliente-side mínima
    if (lineas.some((l) => !l.servicio_id || !l.empleado_id)) {
      setErrors({
        lineas: ["Todas las líneas deben tener servicio y empleado"],
      });
      return;
    }

    formData.set("sucursal_id", sucursalId);
    formData.set("cliente_id", clienteId);
    formData.set(
      "lineas",
      JSON.stringify(
        lineas.map((l) => ({
          servicio_id: l.servicio_id,
          empleado_id: l.empleado_id,
          precio_efectivo: Number(l.precio) || 0,
          comision_pct: Number(l.comision_pct) || 0,
        })),
      ),
    );
    formData.set("descuento_tipo", descTipo);
    formData.set("descuento_valor", String(Number(descValor) || 0));
    formData.set("mp1_id", mp1Id);
    formData.set("valor1", String(Number(valor1) || 0));
    if (mp2Id) {
      formData.set("mp2_id", mp2Id);
      formData.set("valor2", String(Number(valor2) || 0));
    }
    formData.set("observacion", observacion);

    startTransition(async () => {
      const result = await createIngreso(formData);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      if (result.warnings) {
        setWarnings(result.warnings);
        // Esperar un momento y redirigir
        setTimeout(() => {
          if (result.ingresoId) router.push(`/ventas/${result.ingresoId}`);
        }, 1500);
        return;
      }
      if (result.ingresoId) {
        router.push(`/ventas/${result.ingresoId}`);
      }
    });
  }

  const empleadosActivos = empleados.filter((e) => e.activo);
  const serviciosActivos = servicios.filter((s) => s.activo);

  return (
    <form action={handleSubmit} className="space-y-8">
      {/* Header: cliente + sucursal info */}
      <section className="bg-card border border-border rounded-md p-5 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Datos del ticket
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cliente
            </label>
            <div className="flex gap-2">
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Consumidor Final —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {c.telefono ? ` · ${c.telefono}` : ""}
                  </option>
                ))}
              </select>
              <Link
                href="/catalogos/clientes/nuevo"
                target="_blank"
                className="px-3 py-2 border border-border rounded-md text-xs uppercase tracking-wider hover:bg-cream transition-colors whitespace-nowrap"
              >
                + Nuevo
              </Link>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sucursal
            </label>
            <div className="px-3 py-2 border border-border rounded-md bg-cream/40 text-sm">
              {sucursalNombre}
            </div>
          </div>
        </div>
      </section>

      {/* Líneas */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Líneas del ticket
          </h2>
          <button
            type="button"
            onClick={addLinea}
            className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900 flex items-center gap-1"
          >
            <Plus className="h-3 w-3 stroke-[1.5]" />
            Agregar línea
          </button>
        </div>

        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Servicio</th>
                <th className="text-left font-medium px-3 py-2">Empleado</th>
                <th className="text-right font-medium px-3 py-2 w-32">Precio</th>
                <th className="text-right font-medium px-3 py-2 w-24">Com.%</th>
                <th className="text-right font-medium px-3 py-2 w-32">Comisión</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lineas.map((l, idx) => {
                const comision = (Number(l.precio) || 0) * (Number(l.comision_pct) || 0) / 100;
                return (
                  <tr key={l.tempId}>
                    <td className="px-3 py-2">
                      <select
                        value={l.servicio_id}
                        onChange={(e) =>
                          handleServicioChange(idx, e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">— Servicio —</option>
                        {serviciosActivos.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={l.empleado_id}
                        onChange={(e) =>
                          handleEmpleadoChange(idx, e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">— Empleado —</option>
                        {empleadosActivos.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.precio}
                        onChange={(e) =>
                          updateLinea(idx, { precio: Number(e.target.value) })
                        }
                        className="w-full px-2 py-1.5 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={l.comision_pct}
                        onChange={(e) =>
                          updateLinea(idx, {
                            comision_pct: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1.5 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span
                        style={{
                          color: comision > 0 ? "var(--sage-700)" : "var(--muted-foreground)",
                          fontWeight: comision > 0 ? 500 : 400,
                        }}
                      >
                        {formatARS(comision)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLinea(idx)}
                        disabled={lineas.length === 1}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                        title="Quitar línea"
                      >
                        <X className="h-4 w-4 stroke-[1.5]" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {errors.lineas && (
          <p className="text-xs text-destructive">{errors.lineas.join(", ")}</p>
        )}
      </section>

      {/* Resumen + descuento + pagos en grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Descuento */}
        <section className="bg-card border border-border rounded-md p-5 space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Descuento
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tipo
              </label>
              <select
                value={descTipo}
                onChange={(e) =>
                  setDescTipo(e.target.value as "pct" | "monto")
                }
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
              >
                <option value="pct">Porcentaje (%)</option>
                <option value="monto">Monto ($)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Valor
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={descValor}
                onChange={(e) => setDescValor(Number(e.target.value))}
                className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          {errors.descuento_valor && (
            <p className="text-xs text-destructive">
              {errors.descuento_valor.join(", ")}
            </p>
          )}
          {descMonto > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Descuento aplicado: {formatARS(descMonto)}
            </p>
          )}
        </section>

        {/* Resumen / totales con reparto */}
        <section className="bg-cream/40 border border-border rounded-md p-5 space-y-3 text-sm">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Resumen y reparto
          </h2>

          <div className="space-y-1.5">
            <div className="flex justify-between tabular-nums">
              <span>Subtotal</span>
              <span>{formatARS(subtotal)}</span>
            </div>
            {descMonto > 0 && (
              <div className="flex justify-between tabular-nums text-muted-foreground">
                <span>Descuento</span>
                <span>− {formatARS(descMonto)}</span>
              </div>
            )}
            <div className="flex justify-between font-display text-2xl pt-2 border-t border-border tabular-nums">
              <span>Total</span>
              <span>{formatARS(total)}</span>
            </div>
          </div>

          {/* Reparto: empleados + local */}
          <div className="pt-3 border-t border-border space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Reparto del ticket
            </p>

            {repartoEmpleados.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Asigná empleados a las líneas para ver el reparto.
              </p>
            ) : (
              repartoEmpleados.map((r) => (
                <div
                  key={r.nombre}
                  className="flex justify-between items-center tabular-nums text-sm"
                >
                  <span>
                    {r.nombre}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {r.lineas} línea{r.lineas !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <span style={{ color: "var(--sage-700)" }}>
                    {formatARS(r.total)}
                  </span>
                </div>
              ))
            )}

            <div
              className="flex justify-between items-center pt-2 mt-2 border-t border-border tabular-nums"
              style={{ borderTopStyle: "dashed" }}
            >
              <span className="text-xs uppercase tracking-wider font-medium">
                Para el local
              </span>
              <span
                className="font-display text-xl"
                style={{
                  color:
                    paraElLocal >= 0 ? "var(--ink)" : "var(--danger)",
                }}
              >
                {formatARS(paraElLocal)}
              </span>
            </div>

            {total > 0 && repartoEmpleados.length > 0 && (
              <p className="text-[10px] text-muted-foreground tabular-nums pt-1">
                Equipo {((totalComisiones / total) * 100).toFixed(0)}% · Local{" "}
                {((paraElLocal / total) * 100).toFixed(0)}%
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Pagos */}
      <section className="bg-card border border-border rounded-md p-5 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Medios de pago
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Medio 1
            </label>
            <select
              value={mp1Id}
              onChange={(e) => setMp1Id(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
              required
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
              Valor 1
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor1}
              onChange={(e) => {
                const v = Number(e.target.value);
                setValor1(v);
                if (mp2Id) setValor2(Math.max(0, total - v));
              }}
              className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Medio 2 (opcional)
            </label>
            <select
              value={mp2Id}
              onChange={(e) => {
                const v = e.target.value;
                setMp2Id(v);
                if (!v) {
                  setValor1(total);
                  setValor2(0);
                } else {
                  setValor2(Math.max(0, total - (Number(valor1) || 0)));
                }
              }}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
            >
              <option value="">— Ninguno —</option>
              {mediosPago
                .filter((m) => m.id !== mp1Id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo} — {m.nombre}
                  </option>
                ))}
            </select>
          </div>
          {mp2Id && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Valor 2
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valor2}
                onChange={(e) => setValor2(Number(e.target.value))}
                className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border text-sm tabular-nums">
          <span className="text-muted-foreground">Pagado · Total · Diferencia</span>
          <span>
            {formatARS(pagado)} · {formatARS(total)} ·{" "}
            <span
              style={{
                color: pagosOk
                  ? "var(--sage-700)"
                  : "var(--danger)",
              }}
            >
              {formatARS(diff)}
            </span>
          </span>
        </div>
        {errors.valor1 && (
          <p className="text-xs text-destructive">{errors.valor1.join(", ")}</p>
        )}
      </section>

      {/* Observación */}
      <section className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Observación
        </label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </section>

      {/* Warnings de stock */}
      {warnings.length > 0 && (
        <div
          className="border rounded-md p-4 flex items-start gap-3"
          style={{
            backgroundColor: "rgb(201 169 97 / 0.08)",
            borderColor: "var(--warning)",
          }}
        >
          <AlertTriangle
            className="h-5 w-5 stroke-[1.5] shrink-0"
            style={{ color: "var(--warning)" }}
          />
          <div className="space-y-1 text-sm">
            <p className="font-medium" style={{ color: "var(--warning)" }}>
              Venta guardada con advertencias de stock
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground pt-1">
              Redirigiendo al detalle…
            </p>
          </div>
        </div>
      )}

      {/* Errores globales */}
      {errors._ && (
        <div className="bg-destructive/10 border border-destructive rounded-md p-4 text-sm text-destructive">
          {errors._.join(", ")}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !pagosOk || lineas.length === 0}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Guardando…" : "Guardar venta"}
        </button>
        <Link
          href="/ventas"
          className="px-4 py-2.5 rounded-md text-sm font-medium border border-border hover:bg-cream transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
