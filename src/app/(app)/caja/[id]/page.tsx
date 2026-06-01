import Link from "next/link";
import { TableActionLink } from "@/components/table-action-link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getCierre, getResumenDelDia } from "@/lib/data/caja";
import { requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";
import { ReabrirCierreButton } from "./reabrir-button";

function formatYMD(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

export default async function CierreDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getCierre(id);
  if (!data) notFound();

  const { cierre, sucursal_nombre, cerrado_por_nombre, efectivoEsperado } = data;

  const resumen = await getResumenDelDia(cierre.sucursal_id, cierre.fecha);

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="space-y-2">
        <Link
          href="/caja"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3 stroke-[1.5]" />
          Volver a caja
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
              Cierre de caja
            </h1>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatYMD(cierre.fecha)} · {sucursal_nombre} · cerrado por{" "}
              {cerrado_por_nombre} ·{" "}
              {new Date(cierre.fecha_cierre).toLocaleString("es-AR", {
                day: "2-digit",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          {user.rol === "admin" && (
            <ReabrirCierreButton cierreId={cierre.id} />
          )}
        </div>
      </header>

      {/* Esperado por medio */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryBox label="Efectivo esperado" value={formatARS(efectivoEsperado)} />
        <SummaryBox label="Transferencia" value={formatARS(resumen.tr.neto)} />
        <SummaryBox label="Tarjeta crédito" value={formatARS(resumen.tc.ingresos)} />
        <SummaryBox label="Tarjeta débito" value={formatARS(resumen.td.ingresos)} />
      </section>

      {/* Tickets del día */}
      {resumen.tickets.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Tickets del día
          </h2>
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Hora</th>
                  <th className="text-left font-medium px-4 py-3">Cliente</th>
                  <th className="text-left font-medium px-4 py-3">Equipo</th>
                  <th className="text-right font-medium px-4 py-3">Líneas</th>
                  <th className="text-right font-medium px-4 py-3">Total</th>
                  <th className="text-right font-medium px-4 py-3">Comisión</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resumen.tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {new Date(t.fecha).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {t.cliente?.nombre ?? "Consumidor Final"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {t.empleados.length > 0 ? t.empleados.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {t.cantLineas}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatARS(t.total)}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{ color: "var(--sage-700)" }}
                    >
                      {formatARS(t.comisiones)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TableActionLink href={`/ventas/${t.id}`} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-cream/40 font-medium">
                  <td className="px-4 py-3" colSpan={4}>
                    Totales
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatARS(resumen.totalIngresos)}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums"
                    style={{ color: "var(--sage-700)" }}
                  >
                    {formatARS(resumen.totalComisiones)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Movimientos por medio */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Movimientos del día
        </h2>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <FlowRow label="Ingresos efectivo" value={cierre.ingresos_ef} />
          <FlowRow label="Egresos efectivo" value={-cierre.egresos_ef} tone="negative" />
          <FlowRow label="Ingresos transferencia" value={cierre.ingresos_banc} />
          <FlowRow label="Egresos transferencia" value={-cierre.egresos_banc} tone="negative" />
          <FlowRow label="Cobros tarjeta crédito" value={cierre.cobros_tc} />
          <FlowRow label="Cobros tarjeta débito" value={cierre.cobros_td} />
        </div>
      </section>

      {cierre.observacion && (
        <section className="bg-cream/40 border border-border rounded-md p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Observación
          </p>
          <p className="text-sm whitespace-pre-wrap">{cierre.observacion}</p>
        </section>
      )}
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-md p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-2xl mt-2 tabular-nums">{value}</p>
    </div>
  );
}

function FlowRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "negative";
}) {
  const valueClass = tone === "negative" ? "text-muted-foreground" : "";
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0">
      <p className="text-sm">{label}</p>
      <p className={`text-sm tabular-nums ${valueClass}`}>{formatARS(value)}</p>
    </div>
  );
}
