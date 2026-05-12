import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getEfectivoEsperadoPeriodo,
  getLiquidacion,
} from "@/lib/data/liquidaciones";
import { listMediosPago } from "@/lib/data/medios-pago";
import { formatARS } from "@/lib/utils";
import { MarcarPagadaForm } from "@/components/forms/marcar-pagada-form";

function formatYMD(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  anulada: "Anulada",
};

export default async function LiquidacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const data = await getLiquidacion(id);
  if (!data) notFound();

  const { liquidacion, empleado, sucursal, medioPago, lineas } = data;
  const efectivo = await getEfectivoEsperadoPeriodo({
    sucursalId: liquidacion.sucursal_id,
    desde: liquidacion.periodo_desde,
    hasta: liquidacion.periodo_hasta,
  });
  const mediosPagoActivos = (await listMediosPago()).filter((m) => m.activo);

  const diferencia = efectivo.neto_ef - liquidacion.total_comision;

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="space-y-2">
        <Link
          href="/liquidaciones"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3 stroke-[1.5]" />
          Volver a liquidaciones
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
              {empleado.nombre}
            </h1>
            <p className="text-sm text-muted-foreground">
              {sucursal.nombre} · {formatYMD(liquidacion.periodo_desde)} –{" "}
              {formatYMD(liquidacion.periodo_hasta)}
            </p>
          </div>
          <span
            className="inline-block rounded-full px-3 py-1 text-xs uppercase tracking-wider"
            style={{
              backgroundColor:
                liquidacion.estado === "pagada"
                  ? "rgb(82 116 79 / 0.12)"
                  : liquidacion.estado === "pendiente"
                    ? "rgb(201 169 97 / 0.15)"
                    : "rgb(180 0 0 / 0.08)",
              color:
                liquidacion.estado === "pagada"
                  ? "var(--sage-700)"
                  : liquidacion.estado === "pendiente"
                    ? "var(--warning)"
                    : "var(--danger)",
            }}
          >
            {ESTADO_LABEL[liquidacion.estado]}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-card border border-border rounded-md overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-cream/40">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              Detalle del período
            </h2>
          </div>
          {lineas.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground italic">
              No hay líneas registradas.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-cream/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium">Servicio</th>
                  <th className="px-4 py-2 text-right font-medium">Precio</th>
                  <th className="px-4 py-2 text-right font-medium">%</th>
                  <th className="px-4 py-2 text-right font-medium">Comisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineas.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">
                      {formatYMD(l.fecha)}
                    </td>
                    <td className="px-4 py-2">{l.servicio_nombre}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatARS(l.precio)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {l.comision_pct}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {formatARS(l.comision_monto)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-cream/40 font-medium">
                  <td colSpan={4} className="px-4 py-3 text-right">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatARS(liquidacion.total_comision)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        <aside className="space-y-4">
          <section className="bg-card border border-border rounded-md p-5 space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              Resumen
            </h2>
            <KV label="Servicios" value={String(liquidacion.total_servicios)} />
            <KV label="Días trabajados" value={String(liquidacion.dias_trabajados)} />
            <KV
              label="Comisión"
              value={formatARS(liquidacion.total_comision)}
              strong
            />
          </section>

          <section className="bg-cream/40 border border-border rounded-md p-5 space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              Efectivo del período
            </h2>
            <KV label="Ingresos EF" value={formatARS(efectivo.ingresos_ef)} />
            <KV label="Egresos EF" value={formatARS(efectivo.egresos_ef)} />
            <KV label="Esperado en caja" value={formatARS(efectivo.neto_ef)} strong />
            <div className="pt-2 border-t border-border">
              <KV
                label="Después del pago"
                value={formatARS(diferencia)}
                color={diferencia >= 0 ? "var(--sage-700)" : "var(--danger)"}
                strong
              />
              <p className="text-[10px] text-muted-foreground pt-1">
                Si pagás en efectivo, este sería el efectivo restante esperado.
              </p>
            </div>
          </section>

          {liquidacion.estado === "pendiente" ? (
            <MarcarPagadaForm
              liquidacionId={liquidacion.id}
              mediosPago={mediosPagoActivos}
            />
          ) : (
            <section className="bg-card border border-border rounded-md p-5 space-y-2 text-sm">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
                Pago registrado
              </h2>
              {medioPago && (
                <p>
                  <span className="text-muted-foreground">Medio:</span>{" "}
                  {medioPago.nombre} ({medioPago.codigo})
                </p>
              )}
              {liquidacion.fecha_pago && (
                <p>
                  <span className="text-muted-foreground">Fecha:</span>{" "}
                  {new Date(liquidacion.fecha_pago).toLocaleString("es-AR")}
                </p>
              )}
              {liquidacion.observacion && (
                <p className="text-muted-foreground italic pt-1">
                  {liquidacion.observacion}
                </p>
              )}
              {liquidacion.egreso_id && (
                <p className="pt-2 border-t border-border">
                  <span className="text-muted-foreground">Egreso:</span>{" "}
                  <Link
                    href={`/egresos`}
                    className="text-sage-700 hover:text-sage-900 underline"
                  >
                    registrado en caja
                  </Link>
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  strong,
  color,
}: {
  label: string;
  value: string;
  strong?: boolean;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-baseline text-sm tabular-nums">
      <span className="text-muted-foreground">{label}</span>
      <span
        style={{
          fontWeight: strong ? 600 : 400,
          color: color,
        }}
      >
        {value}
      </span>
    </div>
  );
}
