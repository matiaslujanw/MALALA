import { TableActionLink } from "@/components/table-action-link";
import { formatARS } from "@/lib/utils";
import type { ResumenDelDia } from "@/lib/data/caja";

/**
 * Desglose de una jornada de caja, reutilizable para la caja EN CURSO (hoy) y
 * para cajas ANTIGUAS (cierres). Todo sale de getResumenDelDia, que recalcula
 * para cualquier fecha.
 *
 * `isAdmin` gatea los bloques sensibles (rentabilidad y comisiones por
 * empleada): lo operativo (por medio de pago, tickets) lo ve cualquiera con
 * acceso a la caja; los márgenes/costos, solo admin.
 */
export function DesgloseCaja({
  resumen,
  isAdmin,
}: {
  resumen: ResumenDelDia;
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-8">
      {isAdmin && <Rentabilidad resumen={resumen} />}
      <PorMedioDePago resumen={resumen} />
      {isAdmin && resumen.comisionesPorEmpleado.length > 0 && (
        <ComisionesPorEmpleada resumen={resumen} />
      )}
      {resumen.tickets.length > 0 && <Tickets resumen={resumen} />}
    </div>
  );
}

function Rentabilidad({ resumen }: { resumen: ResumenDelDia }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        Rentabilidad del negocio
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Facturado" value={formatARS(resumen.totalIngresos)} accent="sage" />
        <Kpi label="Comisiones" value={`−${formatARS(resumen.totalComisiones)}`} />
        <Kpi label="Costo insumos" value={`−${formatARS(resumen.costoInsumos)}`} />
        <Kpi label="Egresos" value={`−${formatARS(resumen.totalEgresos)}`} accent="warn" />
        <Kpi label="Para el local" value={formatARS(resumen.paraElLocal)} />
        <Kpi
          label="Neto del negocio"
          value={formatARS(resumen.netoNegocio)}
          accent={resumen.netoNegocio >= 0 ? "sage" : "danger"}
        />
      </div>
      {resumen.fiado.total > 0 && (
        <p className="text-xs text-muted-foreground">
          Además se fió {formatARS(resumen.fiado.total)} (cuenta corriente), que
          no entró a caja.
        </p>
      )}
    </section>
  );
}

function PorMedioDePago({ resumen }: { resumen: ResumenDelDia }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        Por medio de pago
      </h2>
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Medio</th>
              <th className="px-4 py-3 text-right font-medium">Ingresos</th>
              <th className="px-4 py-3 text-right font-medium">Egresos</th>
              <th className="px-4 py-3 text-right font-medium">Neto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {resumen.porMp.map((row) => (
              <tr key={row.mp.id}>
                <td className="px-4 py-3 font-medium">
                  {row.mp.nombre}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({row.mp.codigo})
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatARS(row.ingresos)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {formatARS(row.egresos)}
                </td>
                <td
                  className="px-4 py-3 text-right font-medium tabular-nums"
                  style={{ color: row.neto >= 0 ? "var(--ink)" : "var(--danger)" }}
                >
                  {formatARS(row.neto)}
                </td>
              </tr>
            ))}
            <tr className="bg-cream/40 font-medium">
              <td className="px-4 py-3">Totales</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatARS(resumen.totalIngresos)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatARS(resumen.totalEgresos)}
              </td>
              <td
                className="px-4 py-3 text-right tabular-nums"
                style={{
                  color:
                    resumen.totalNeto >= 0 ? "var(--sage-700)" : "var(--danger)",
                }}
              >
                {formatARS(resumen.totalNeto)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ComisionesPorEmpleada({ resumen }: { resumen: ResumenDelDia }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        Comisiones por empleada
      </h2>
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Empleada</th>
              <th className="px-4 py-3 text-right font-medium">Líneas</th>
              <th className="px-4 py-3 text-right font-medium">Comisión</th>
              <th className="px-4 py-3 text-right font-medium">% del total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {resumen.comisionesPorEmpleado.map((row) => (
              <tr key={row.empleado.id}>
                <td className="px-4 py-3 font-medium">{row.empleado.nombre}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {row.lineas}
                </td>
                <td
                  className="px-4 py-3 text-right font-medium tabular-nums"
                  style={{ color: "var(--sage-700)" }}
                >
                  {formatARS(row.total)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {row.pctDelTotal.toFixed(0)}%
                </td>
              </tr>
            ))}
            <tr className="bg-cream/40 font-medium">
              <td className="px-4 py-3">Total comisiones</td>
              <td className="px-4 py-3"></td>
              <td
                className="px-4 py-3 text-right tabular-nums"
                style={{ color: "var(--sage-700)" }}
              >
                {formatARS(resumen.totalComisiones)}
              </td>
              <td className="px-4 py-3"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Tickets({ resumen }: { resumen: ResumenDelDia }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        Tickets del día
      </h2>
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Hora</th>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="px-4 py-3 text-left font-medium">Equipo</th>
              <th className="px-4 py-3 text-right font-medium">Líneas</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Comisión</th>
              <th className="w-16 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {resumen.tickets.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
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
                <td className="px-4 py-3 text-right font-medium tabular-nums">
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
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "sage" | "danger" | "warn";
}) {
  const color =
    accent === "sage"
      ? "text-sage-700"
      : accent === "danger"
        ? "text-destructive"
        : accent === "warn"
          ? "text-warning"
          : "";
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-display text-xl tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
