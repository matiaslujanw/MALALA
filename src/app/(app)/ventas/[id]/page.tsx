import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getIngreso } from "@/lib/data/ingresos";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/mock/store";
import { formatARS } from "@/lib/utils";

export default async function VentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const row = await getIngreso(id);
  if (!row) notFound();

  const { ingreso, cliente, mp1, mp2, lineas, breakdown } = row;
  const sucursal = store.sucursales.find((s) => s.id === ingreso.sucursal_id);

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="space-y-2">
        <Link
          href="/ventas"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3 stroke-[1.5]" />
          Volver a ingresos
        </Link>
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Ticket
        </h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          {new Date(ingreso.fecha).toLocaleString("es-AR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {sucursal?.nombre ?? "—"}
        </p>
      </header>

      {/* Datos del ticket */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-md p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Cliente
          </p>
          <p className="text-base font-medium mt-1">
            {cliente?.nombre ?? "Consumidor Final"}
          </p>
          {cliente?.telefono && (
            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              {cliente.telefono}
            </p>
          )}
        </div>
        <div className="bg-card border border-border rounded-md p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Pago
          </p>
          <p className="text-sm mt-1 tabular-nums">
            {mp1?.nombre ?? "—"}: {formatARS(ingreso.valor1)}
          </p>
          {mp2 && ingreso.valor2 != null && (
            <p className="text-sm mt-0.5 tabular-nums">
              {mp2.nombre}: {formatARS(ingreso.valor2)}
            </p>
          )}
        </div>
        <div className="bg-card border border-border rounded-md p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Subtotal · Descuento · Total
          </p>
          <p className="text-sm mt-1 tabular-nums">
            {formatARS(ingreso.subtotal)}
            {ingreso.descuento_pct > 0 && (
              <span className="text-muted-foreground">
                {" "}
                − {ingreso.descuento_pct}% ({formatARS(ingreso.descuento_monto)})
              </span>
            )}
          </p>
          <p className="font-display text-xl mt-1 tabular-nums">
            {formatARS(ingreso.total)}
          </p>
        </div>
      </div>

      {/* Líneas */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Líneas del ticket
        </h2>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Servicio</th>
                <th className="text-left font-medium px-4 py-3">Empleado</th>
                <th className="text-right font-medium px-4 py-3">Precio</th>
                <th className="text-right font-medium px-4 py-3">Comisión</th>
                <th className="text-right font-medium px-4 py-3">Insumos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lineas.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-medium">
                    {l.servicio?.nombre ?? "—"}
                    {l.servicio && (
                      <p className="text-xs text-muted-foreground">
                        {l.servicio.rubro}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {l.empleado?.nombre ?? (
                      <span className="text-muted-foreground italic">
                        sin asignar
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatARS(l.subtotal)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatARS(l.comision_monto)}
                    <span className="text-xs"> ({l.comision_pct}%)</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatARS(l.costoInsumos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Reparto operativo: cuánto va a cada uno */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Reparto del ticket
        </h2>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          {(() => {
            // Agrupar comisiones por empleado
            const porEmpleado = new Map<
              string,
              { nombre: string; total: number; lineas: number }
            >();
            for (const l of lineas) {
              if (!l.empleado) continue;
              const cur = porEmpleado.get(l.empleado.id) ?? {
                nombre: l.empleado.nombre,
                total: 0,
                lineas: 0,
              };
              cur.total += l.comision_monto;
              cur.lineas += 1;
              porEmpleado.set(l.empleado.id, cur);
            }
            const empleadosArr = Array.from(porEmpleado.values()).sort(
              (a, b) => b.total - a.total,
            );
            const paraElLocal =
              breakdown.total - breakdown.comisiones;

            return (
              <>
                {empleadosArr.map((e) => (
                  <div
                    key={e.nombre}
                    className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{e.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.lineas} línea{e.lineas !== 1 ? "s" : ""} ·{" "}
                        {breakdown.total > 0
                          ? `${((e.total / breakdown.total) * 100).toFixed(0)}% del total`
                          : "—"}
                      </p>
                    </div>
                    <p
                      className="font-display text-xl tabular-nums"
                      style={{ color: "var(--sage-700)" }}
                    >
                      {formatARS(e.total)}
                    </p>
                  </div>
                ))}

                <div
                  className="flex items-center justify-between px-4 py-3 bg-cream/40 border-t border-border"
                  style={{ borderTopStyle: "dashed" }}
                >
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-xs">
                      Para el local
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total − comisiones del equipo
                    </p>
                  </div>
                  <p
                    className="font-display text-xl tabular-nums"
                    style={{
                      color:
                        paraElLocal >= 0 ? "var(--ink)" : "var(--danger)",
                    }}
                  >
                    {formatARS(paraElLocal)}
                  </p>
                </div>
              </>
            );
          })()}
        </div>
        <p className="text-xs text-muted-foreground">
          La liquidación efectiva por mes se calcula al cierre de caja.
        </p>
      </section>

      {/* Desglose financiero (analítico, descuenta también costo de insumos) */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Desglose financiero
        </h2>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <FlowRow
            label="Cobrado al cliente"
            value={breakdown.total}
            tone="bold"
          />
          <FlowRow
            label="− Comisiones del equipo"
            value={-breakdown.comisiones}
            tone="muted"
          />
          <FlowRow
            label="− Costo de insumos"
            value={-breakdown.costoInsumos}
            tone="muted"
          />
          <FlowRow
            label="= Neto para el negocio"
            value={breakdown.neto}
            tone="result"
          />
        </div>
      </section>

      {ingreso.observacion && (
        <section className="bg-cream/40 border border-border rounded-md p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Observación
          </p>
          <p className="text-sm">{ingreso.observacion}</p>
        </section>
      )}
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
  tone: "bold" | "muted" | "result";
}) {
  const valueStyle =
    tone === "result"
      ? {
          color: value >= 0 ? "var(--sage-700)" : "var(--danger)",
        }
      : undefined;
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 ${
        tone === "result" ? "bg-cream/40 border-t border-border" : ""
      }`}
    >
      <p
        className={`text-sm ${tone === "muted" ? "text-muted-foreground" : ""} ${
          tone === "result" ? "font-semibold uppercase tracking-wider text-xs" : ""
        }`}
      >
        {label}
      </p>
      <p
        className={`tabular-nums ${
          tone === "bold" || tone === "result"
            ? "font-display text-xl"
            : "text-sm text-muted-foreground"
        }`}
        style={valueStyle}
      >
        {formatARS(value)}
      </p>
    </div>
  );
}
