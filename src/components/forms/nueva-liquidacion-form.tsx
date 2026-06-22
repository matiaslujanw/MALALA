"use client";

import { useMemo, useState, useTransition } from "react";
import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "@/components/forms/field";
import {
  createLiquidacion,
  previewLiquidacion,
  type LiquidacionPreview,
} from "@/lib/data/liquidaciones";
import type { Empleado, Sucursal } from "@/lib/types";
import { formatARS } from "@/lib/utils";

interface Props {
  sucursalId: string;
  sucursales: Sucursal[];
  empleados: Empleado[];
  permiteCambiarSucursal: boolean;
}

function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstHalfOfThisMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return { desde: `${y}-${m}-01`, hasta: `${y}-${m}-15` };
}

function secondHalfOfThisMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const mm = String(m + 1).padStart(2, "0");
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    desde: `${y}-${mm}-16`,
    hasta: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function thisMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const mm = String(m + 1).padStart(2, "0");
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    desde: `${y}-${mm}-01`,
    hasta: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function quincenaActual() {
  const day = new Date().getDate();
  return day <= 15 ? firstHalfOfThisMonth() : secondHalfOfThisMonth();
}

/** No tiene sentido liquidar a futuro: topamos cualquier fecha a hoy. */
function clampToToday(ymd: string): string {
  const hoy = todayYMD();
  return ymd > hoy ? hoy : ymd;
}

function clampRange(r: { desde: string; hasta: string }) {
  return { desde: clampToToday(r.desde), hasta: clampToToday(r.hasta) };
}

function formatYMD(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

export function NuevaLiquidacionForm({
  sucursalId: initialSucursal,
  sucursales,
  empleados,
  permiteCambiarSucursal,
}: Props) {
  const { pending: saving, run: runSave } = useTransitionFeedback();
  const [sucursalId, setSucursalId] = useState(initialSucursal);
  const [empleadoId, setEmpleadoId] = useState("");

  const q = clampRange(quincenaActual());
  const [desde, setDesde] = useState(q.desde);
  const [hasta, setHasta] = useState(q.hasta);

  const [preview, setPreview] = useState<LiquidacionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [horas, setHoras] = useState(0);
  const [diasViatico, setDiasViatico] = useState(0);

  function clearPreviewState() {
    setPreview(null);
    setPreviewError(null);
    setHoras(0);
    setDiasViatico(0);
  }

  function applyRange(r: { desde: string; hasta: string }) {
    clearPreviewState();
    const { desde: d, hasta: h } = clampRange(r);
    setDesde(d);
    setHasta(h);
  }

  function doPreview() {
    setPreviewError(null);
    setErrors({});
    if (!empleadoId) {
      setPreviewError("Elegí un empleado");
      return;
    }
    startPreview(async () => {
      const res = await previewLiquidacion({
        sucursalId,
        empleadoId,
        periodoDesde: desde,
        periodoHasta: hasta,
      });
      if (!res.ok) {
        setPreviewError(
          Object.values(res.errors).flat().join(", ") || "Error",
        );
        setPreview(null);
        return;
      }
      setPreview(res.preview);
      // Proponer las horas según la jornada del empleado (editable).
      setHoras(res.preview.horas_sugeridas);
      setDiasViatico(res.preview.dias_viatico_sugeridos);
    });
  }

  function doSave() {
    setErrors({});
    if (!preview) {
      setErrors({ _: ["Primero calculá el período"] });
      return;
    }
    if (preview.lineas.length === 0 && horas <= 0 && diasViatico <= 0) {
      setErrors({ _: ["No hay servicios, horas ni viatico para liquidar"] });
      return;
    }
    const fd = new FormData();
    fd.set("sucursal_id", sucursalId);
    fd.set("empleado_id", empleadoId);
    fd.set("periodo_desde", desde);
    fd.set("periodo_hasta", hasta);
    fd.set("horas_trabajadas", String(horas));
    fd.set("dias_viatico", String(diasViatico));
    runSave(
      async () => {
        const res = await createLiquidacion(fd);
        if (!res.ok) {
          setErrors(res.errors);
        }
        return res;
      },
      {
        redirectTo: (res) =>
          `/liquidaciones/${(res as unknown as { liquidacionId: string }).liquidacionId}`,
        successMessage: "Liquidacion creada",
      },
    );
  }

  const empleadosActivos = useMemo(
    () =>
      empleados.filter(
        (e) => e.activo && e.sucursal_principal_id === sucursalId,
      ),
    [empleados, sucursalId],
  );

  // Desglose en vivo (depende de las horas que carga el usuario).
  const sueldoHoras = horas * (preview?.valor_hora ?? 0);
  const totalViatico = diasViatico * (preview?.viatico_por_dia ?? 0);
  const totalPagar = preview
    ? preview.total_comision + sueldoHoras + totalViatico - preview.total_anticipos
    : 0;
  const puedeGuardar =
    !!preview && (preview.lineas.length > 0 || horas > 0 || diasViatico > 0);

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-md p-5 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Parámetros
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sucursal
            </label>
            <select
              value={sucursalId}
              onChange={(e) => {
                clearPreviewState();
                setSucursalId(e.target.value);
                setEmpleadoId("");
              }}
              disabled={!permiteCambiarSucursal}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm disabled:opacity-60"
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Empleado *
            </label>
            <select
              value={empleadoId}
              onChange={(e) => {
                clearPreviewState();
                setEmpleadoId(e.target.value);
              }}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
              required
            >
              <option value="">— Elegí —</option>
              {empleadosActivos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} · {e.porcentaje_default}%
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Desde
            </label>
            <input
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => {
                clearPreviewState();
                setDesde(e.target.value);
              }}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Hasta
            </label>
            <input
              type="date"
              value={hasta}
              min={desde}
              max={todayYMD()}
              onChange={(e) => {
                clearPreviewState();
                setHasta(e.target.value);
              }}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => applyRange(firstHalfOfThisMonth())}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-border rounded-md hover:bg-cream"
          >
            1ª quincena
          </button>
          <button
            type="button"
            onClick={() => applyRange(secondHalfOfThisMonth())}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-border rounded-md hover:bg-cream"
          >
            2ª quincena
          </button>
          <button
            type="button"
            onClick={() => applyRange(thisMonth())}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-border rounded-md hover:bg-cream"
          >
            Mes actual
          </button>
        </div>

        <div className="pt-2">
          <LoadingButton
            type="button"
            onClick={doPreview}
            pending={previewing}
            pendingLabel="Calculando..."
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700"
          >
            Calcular comisiones
          </LoadingButton>
          {previewError && (
            <p className="text-xs text-destructive mt-2">{previewError}</p>
          )}
        </div>
      </section>

      {preview && (
        <section className="bg-card border border-border rounded-md p-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              Comisiones del período
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatYMD(preview.periodo_desde)} – {formatYMD(preview.periodo_hasta)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Servicios" value={String(preview.total_servicios)} />
            <Kpi label="Días trabajados" value={String(preview.dias_trabajados)} />
            <Kpi label="Comisiones" value={formatARS(preview.total_comision)} />
            <Kpi
              label="Valor por hora"
              value={formatARS(preview.valor_hora)}
              hint="Configurado en la ficha del empleado"
            />
          </div>

          {preview.lineas.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No hay servicios con comisión para este empleado en el período. Podés
              liquidar solo horas, viatico o ambos.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium">Servicio</th>
                    <th className="px-3 py-2 text-right font-medium">Precio</th>
                    <th className="px-3 py-2 text-right font-medium">Com.%</th>
                    <th className="px-3 py-2 text-right font-medium">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.lineas.map((l) => (
                    <tr key={l.ingreso_linea_id}>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {formatYMD(l.fecha)}
                      </td>
                      <td className="px-3 py-2">{l.servicio_nombre}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatARS(l.precio)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {l.comision_pct}%
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatARS(l.comision_monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Horas trabajadas */}
          <div className="border-t border-border pt-4">
            <div className="sm:max-w-xs space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Horas trabajadas en el período
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={horas || ""}
                onChange={(e) => setHoras(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
                className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                {horas > 0
                  ? `${horas} h × ${formatARS(preview.valor_hora)} = ${formatARS(sueldoHoras)}`
                  : "Cargá las horas efectivamente trabajadas"}
              </p>
              {preview.horas_sugeridas > 0 && (
                <p className="text-xs text-muted-foreground">
                  Sugerido por la jornada: {preview.horas_sugeridas} h.
                  {horas !== preview.horas_sugeridas && (
                    <button
                      type="button"
                      onClick={() => setHoras(preview.horas_sugeridas)}
                      className="ml-1 underline hover:text-foreground"
                    >
                      Usar sugerido
                    </button>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:max-w-2xl">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Viatico por dia
                </label>
                <input
                  type="text"
                  value={formatARS(preview.viatico_por_dia)}
                  readOnly
                  className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-cream/40 text-sm text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Sale de la ficha del empleado y queda congelado en esta liquidacion.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Dias de viatico
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={diasViatico || ""}
                  onChange={(e) =>
                    setDiasViatico(Math.max(0, Number(e.target.value) || 0))
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  {diasViatico > 0
                    ? `${diasViatico} dias × ${formatARS(preview.viatico_por_dia)} = ${formatARS(totalViatico)}`
                    : "Ajustalo manualmente para descontar feriados o dias no trabajados"}
                </p>
                {preview.dias_viatico_sugeridos > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sugerido por dias con servicios: {preview.dias_viatico_sugeridos}.
                    {diasViatico !== preview.dias_viatico_sugeridos && (
                      <button
                        type="button"
                        onClick={() => setDiasViatico(preview.dias_viatico_sugeridos)}
                        className="ml-1 underline hover:text-foreground"
                      >
                        Usar sugerido
                      </button>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Anticipos del período */}
          {preview.anticipos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Anticipos del período (se descuentan)
              </p>
              <ul className="divide-y divide-border rounded-md border border-border bg-cream/30">
                {preview.anticipos.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {formatYMD(a.fecha)}
                      {a.observacion ? ` · ${a.observacion}` : ""}
                    </span>
                    <span className="tabular-nums text-amber-700">
                      − {formatARS(a.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Desglose total */}
          <div className="rounded-md border border-border bg-cream/40 p-4 space-y-1.5">
            <DesgloseRow
              label="Comisiones"
              value={formatARS(preview.total_comision)}
            />
            <DesgloseRow
              label="Sueldo por horas"
              value={formatARS(sueldoHoras)}
            />
            {totalViatico > 0 && (
              <DesgloseRow
                label="Viatico"
                value={formatARS(totalViatico)}
              />
            )}
            {preview.total_anticipos > 0 && (
              <DesgloseRow
                label="Anticipos"
                value={`− ${formatARS(preview.total_anticipos)}`}
                muted
              />
            )}
            <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Total a pagar
              </span>
              <span
                className="font-display text-xl tabular-nums"
                style={{ color: "var(--sage-700)" }}
              >
                {formatARS(totalPagar)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <LoadingButton
              type="button"
              onClick={doSave}
              pending={saving}
              pendingLabel="Guardando..."
              disabled={!puedeGuardar}
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700"
            >
              Guardar liquidación
            </LoadingButton>
            <p className="text-xs text-muted-foreground">
              Se generará una liquidación pendiente. Luego registrás el pago al
              empleado.
            </p>
          </div>

          {errors._ && (
            <p className="text-sm text-destructive">{errors._.join(", ")}</p>
          )}
        </section>
      )}
    </div>
  );
}

function DesgloseRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${muted ? "text-amber-700" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
  hint,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <div
      className="rounded-md border border-border p-4"
      style={{ backgroundColor: highlight ? "rgb(82 116 79 / 0.06)" : undefined }}
      title={hint}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 font-display text-xl tabular-nums"
        style={{ color: highlight ? "var(--sage-700)" : undefined }}
      >
        {value}
      </p>
    </div>
  );
}
