"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [sucursalId, setSucursalId] = useState(initialSucursal);
  const [empleadoId, setEmpleadoId] = useState("");

  const q = quincenaActual();
  const [desde, setDesde] = useState(q.desde);
  const [hasta, setHasta] = useState(q.hasta);

  const [preview, setPreview] = useState<LiquidacionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [saving, startSaving] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function applyRange(r: { desde: string; hasta: string }) {
    setDesde(r.desde);
    setHasta(r.hasta);
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
    });
  }

  function doSave() {
    setErrors({});
    if (!preview || preview.lineas.length === 0) {
      setErrors({ _: ["Primero calculá el período"] });
      return;
    }
    const fd = new FormData();
    fd.set("sucursal_id", sucursalId);
    fd.set("empleado_id", empleadoId);
    fd.set("periodo_desde", desde);
    fd.set("periodo_hasta", hasta);
    startSaving(async () => {
      const res = await createLiquidacion(fd);
      if (!res.ok) {
        setErrors(res.errors);
        return;
      }
      router.push(`/liquidaciones/${res.liquidacionId}`);
    });
  }

  // Refrescar preview cuando cambian inputs significativos
  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
  }, [sucursalId, empleadoId, desde, hasta]);

  const empleadosActivos = useMemo(
    () => empleados.filter((e) => e.activo),
    [empleados],
  );

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
              onChange={(e) => setSucursalId(e.target.value)}
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
              onChange={(e) => setEmpleadoId(e.target.value)}
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
              onChange={(e) => setDesde(e.target.value)}
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
              onChange={(e) => setHasta(e.target.value)}
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
          <button
            type="button"
            onClick={doPreview}
            disabled={previewing}
            className="bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
          >
            {previewing ? "Calculando…" : "Calcular comisiones"}
          </button>
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
            <Kpi
              label="Total a pagar"
              value={formatARS(preview.total_comision)}
              highlight
            />
            <Kpi
              label="Líneas ya liquidadas"
              value="—"
              hint="Las líneas que ya fueron liquidadas antes no se incluyen"
            />
          </div>

          {preview.lineas.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No hay líneas pendientes para este empleado en el período.
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

          {preview.lineas.length > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={doSave}
                disabled={saving}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Guardando…" : "Guardar liquidación"}
              </button>
              <p className="text-xs text-muted-foreground">
                Se generará una liquidación pendiente. Luego registrás el pago al
                empleado.
              </p>
            </div>
          )}

          {errors._ && (
            <p className="text-sm text-destructive">{errors._.join(", ")}</p>
          )}
        </section>
      )}
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
