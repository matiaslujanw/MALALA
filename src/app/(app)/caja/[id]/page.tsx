import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getCierre, getResumenDelDia } from "@/lib/data/caja";
import { requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";
import { DENOMINACIONES_ARS } from "@/lib/validations/caja";
import { ReabrirCierreButton } from "./reabrir-button";

const DENOM_LABELS: Record<number, string> = {
  20000: "$ 20.000",
  10000: "$ 10.000",
  2000: "$ 2.000",
  1000: "$ 1.000",
  500: "$ 500",
  200: "$ 200",
  100: "$ 100",
  50: "$ 50",
  20: "$ 20",
  10: "$ 10",
};

export default async function CierreDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getCierre(id);
  if (!data) notFound();

  const { cierre, sucursal_nombre, cerrado_por_nombre, efectivoContado, efectivoEsperado, diferenciaEf } = data;

  // Recompongo el detalle del día para mostrar tickets + reparto por empleado
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
              {cierre.fecha} · {sucursal_nombre} · cerrado por{" "}
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

      {/* Resumen efectivo */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryBox label="Esperado en caja" value={formatARS(efectivoEsperado)} />
        <SummaryBox label="Contado" value={formatARS(efectivoContado)} />
        <SummaryBox
          label="Diferencia"
          value={formatARS(diferenciaEf)}
          color={
            diferenciaEf === 0 ? "sage-700" : diferenciaEf > 0 ? "ink" : "danger"
          }
          hint={
            diferenciaEf === 0
              ? "Cuadra"
              : diferenciaEf > 0
                ? "Sobrante"
                : "Faltante"
          }
        />
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
                      <Link
                        href={`/ventas/${t.id}`}
                        className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900"
                      >
                        Ver
                      </Link>
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

      {/* Reparto del día por empleado */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Reparto del día
        </h2>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          {resumen.comisionesPorEmpleado.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No hubo comisiones devengadas.
            </div>
          ) : (
            resumen.comisionesPorEmpleado.map((row) => (
              <div
                key={row.empleado.id}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{row.empleado.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.lineas} línea{row.lineas !== 1 ? "s" : ""} ·{" "}
                    {row.pctDelTotal.toFixed(0)}% del total cobrado
                  </p>
                </div>
                <p
                  className="font-display text-xl tabular-nums"
                  style={{ color: "var(--sage-700)" }}
                >
                  {formatARS(row.total)}
                </p>
              </div>
            ))
          )}

          <div
            className="flex items-center justify-between px-4 py-3 bg-cream/40 border-t border-border"
            style={{ borderTopStyle: "dashed" }}
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-xs">
                Para el local
              </p>
              <p className="text-xs text-muted-foreground">
                Total cobrado − comisiones del equipo
              </p>
            </div>
            <p
              className="font-display text-xl tabular-nums"
              style={{
                color:
                  resumen.paraElLocal >= 0
                    ? "var(--ink)"
                    : "var(--danger)",
              }}
            >
              {formatARS(resumen.paraElLocal)}
            </p>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-cream/30 border-t border-border">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-xs">
                Neto del negocio
              </p>
              <p className="text-xs text-muted-foreground">
                Para el local − costo de insumos ({formatARS(resumen.costoInsumos)})
              </p>
            </div>
            <p
              className="font-display text-xl tabular-nums"
              style={{
                color:
                  resumen.netoNegocio >= 0
                    ? "var(--sage-700)"
                    : "var(--danger)",
              }}
            >
              {formatARS(resumen.netoNegocio)}
            </p>
          </div>
        </div>
      </section>

      {/* Movimientos por medio */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Movimientos del día
        </h2>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <FlowRow label="Saldo inicial efectivo" value={cierre.saldo_inicial_ef} />
          <FlowRow label="Ingresos efectivo" value={cierre.ingresos_ef} tone="positive" />
          <FlowRow label="Egresos efectivo" value={-cierre.egresos_ef} tone="negative" />
          <FlowRow label="Ingresos transferencia" value={cierre.ingresos_banc} />
          <FlowRow label="Egresos transferencia" value={-cierre.egresos_banc} tone="negative" />
          <FlowRow label="Cobros tarjeta crédito" value={cierre.cobros_tc} />
          <FlowRow label="Cobros tarjeta débito" value={cierre.cobros_td} />
        </div>
      </section>

      {/* Otros valores cargados manualmente */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Otros valores
        </h2>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <FlowRow label="Saldo banco contado" value={cierre.saldo_banco} />
          <FlowRow label="Vouchers" value={cierre.vouchers} />
          <FlowRow label="Giftcards" value={cierre.giftcards} />
          <FlowRow label="Autoconsumos" value={cierre.autoconsumos} />
          <FlowRow label="Cheques" value={cierre.cheques} />
          <FlowRow label="Aportes" value={cierre.aportes} />
          <FlowRow label="Ingresos en CC" value={cierre.ingresos_cc} />
          <FlowRow label="Anticipos" value={cierre.anticipos} />
        </div>
      </section>

      {/* Conteo de billetes */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Conteo por denominación
        </h2>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Denominación</th>
                <th className="text-right font-medium px-4 py-3">Cantidad</th>
                <th className="text-right font-medium px-4 py-3">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {DENOMINACIONES_ARS.map((d) => {
                const cant = cierre.billetes[String(d)] ?? 0;
                if (cant === 0) return null;
                return (
                  <tr key={d}>
                    <td className="px-4 py-3 font-medium">{DENOM_LABELS[d]}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{cant}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatARS(d * cant)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-cream/40 font-medium">
                <td className="px-4 py-3">Total contado</td>
                <td></td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatARS(efectivoContado)}
                </td>
              </tr>
            </tbody>
          </table>
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

function SummaryBox({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color?: "sage-700" | "ink" | "danger";
  hint?: string;
}) {
  const style =
    color === "sage-700"
      ? { color: "var(--sage-700)" }
      : color === "danger"
        ? { color: "var(--danger)" }
        : color === "ink"
          ? { color: "var(--ink)" }
          : undefined;
  return (
    <div className="bg-card border border-border rounded-md p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-2xl mt-2 tabular-nums" style={style}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
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
  tone?: "positive" | "negative";
}) {
  const valueClass =
    tone === "negative"
      ? "text-muted-foreground"
      : "";
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0">
      <p className="text-sm">{label}</p>
      <p className={`text-sm tabular-nums ${valueClass}`}>{formatARS(value)}</p>
    </div>
  );
}
