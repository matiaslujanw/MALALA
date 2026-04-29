import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Calculator,
  ClipboardList,
  PackageX,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { BarChart } from "@/components/charts/bar-chart";
import { formatARS } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const sucursal = await getActiveSucursal();
  if (!sucursal) redirect("/dev/login");

  const data = await getDashboardData(sucursal.id);
  const { kpis, ventasUltimos14, topServicios, topEmpleados, ventasPorMp } =
    data;

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Hola {user.nombre} · {sucursal.nombre} ·{" "}
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          })}
        </p>
      </header>

      {/* Alertas operativas */}
      {(kpis.stockNegativo > 0 ||
        kpis.stockBajo > 0 ||
        kpis.egresosPendientes > 0 ||
        !kpis.cierreHoyId) && (
        <section className="space-y-2">
          {kpis.stockNegativo > 0 && (
            <Alert
              icon={<PackageX className="h-4 w-4 stroke-[1.5]" />}
              tone="danger"
              text={`${kpis.stockNegativo} insumo${kpis.stockNegativo !== 1 ? "s" : ""} con stock negativo`}
              href="/stock"
            />
          )}
          {kpis.stockBajo > 0 && (
            <Alert
              icon={<AlertTriangle className="h-4 w-4 stroke-[1.5]" />}
              tone="warning"
              text={`${kpis.stockBajo} insumo${kpis.stockBajo !== 1 ? "s" : ""} bajo el umbral de stock`}
              href="/stock"
            />
          )}
          {kpis.egresosPendientes > 0 && (
            <Alert
              icon={<Receipt className="h-4 w-4 stroke-[1.5]" />}
              tone="warning"
              text={`${kpis.egresosPendientes} egreso${kpis.egresosPendientes !== 1 ? "s" : ""} pendiente${kpis.egresosPendientes !== 1 ? "s" : ""} de pago · ${formatARS(kpis.egresosPendientesMonto)}`}
              href="/egresos?pendientes=1"
            />
          )}
          {!kpis.cierreHoyId &&
            (user.rol === "admin" || user.rol === "encargada") && (
              <Alert
                icon={<Calculator className="h-4 w-4 stroke-[1.5]" />}
                tone="info"
                text="No cerraste la caja de hoy todavía"
                href="/caja/nuevo"
              />
            )}
        </section>
      )}

      {/* KPIs del día */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Hoy
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Ventas"
            value={formatARS(kpis.ventasHoy)}
            hint={`${kpis.ticketsHoy} ticket${kpis.ticketsHoy !== 1 ? "s" : ""}`}
            highlight
          />
          <Kpi
            label="Ticket promedio"
            value={formatARS(kpis.ticketPromedioHoy)}
          />
          <Kpi
            label="Comisiones"
            value={formatARS(kpis.comisionesHoy)}
            color="sage-700"
          />
          <Kpi
            label="Neto del día"
            value={formatARS(kpis.netoHoy)}
            color={kpis.netoHoy >= 0 ? "sage-700" : "danger"}
          />
        </div>
      </section>

      {/* Gráfico de ventas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Ventas últimos 14 días
          </h2>
          <Link
            href="/ventas?rango=mes"
            className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900"
          >
            Ver todas →
          </Link>
        </div>
        <div className="bg-card border border-border rounded-md p-5">
          <BarChart data={ventasUltimos14} />
        </div>
      </section>

      {/* KPIs del mes */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Mes en curso
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Ventas mes"
            value={formatARS(kpis.ventasMes)}
            hint={`${kpis.ticketsMes} ticket${kpis.ticketsMes !== 1 ? "s" : ""}`}
          />
          <Kpi
            label="Comisiones mes"
            value={formatARS(kpis.comisionesMes)}
            hint={
              kpis.ventasMes > 0
                ? `${((kpis.comisionesMes / kpis.ventasMes) * 100).toFixed(0)}% del total`
                : undefined
            }
            color="sage-700"
          />
          <Kpi
            label="Egresos mes"
            value={formatARS(kpis.egresosMes)}
          />
          <Kpi
            label="Neto mes"
            value={formatARS(kpis.netoMes)}
            color={kpis.netoMes >= 0 ? "sage-700" : "danger"}
            hint={
              kpis.ventasMes > 0
                ? `${((kpis.netoMes / kpis.ventasMes) * 100).toFixed(0)}% del total`
                : undefined
            }
            highlight
          />
        </div>
      </section>

      {/* Doble columna: top servicios + top empleados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 stroke-[1.5]" />
            Top servicios del mes
          </h2>
          {topServicios.length === 0 ? (
            <EmptyBox text="Sin ventas registradas este mes." />
          ) : (
            <div className="bg-card border border-border rounded-md overflow-hidden">
              {topServicios.map((s, idx) => (
                <div
                  key={s.servicio.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums w-5">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {s.servicio.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.servicio.rubro} · {s.cantidad} unidad
                        {s.cantidad !== 1 ? "es" : ""}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-medium tabular-nums">
                    {formatARS(s.total)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <ClipboardList className="h-3.5 w-3.5 stroke-[1.5]" />
            Comisiones del mes por empleado
          </h2>
          {topEmpleados.length === 0 ? (
            <EmptyBox text="Sin comisiones acumuladas este mes." />
          ) : (
            <div className="bg-card border border-border rounded-md overflow-hidden">
              {topEmpleados.map((e, idx) => {
                const max = topEmpleados[0].comisiones || 1;
                const pct = (e.comisiones / max) * 100;
                return (
                  <div
                    key={e.empleado.id}
                    className="px-4 py-3 border-b border-border last:border-b-0 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground tabular-nums w-5">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {e.empleado.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {e.lineas} línea{e.lineas !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <p
                        className="text-sm font-medium tabular-nums"
                        style={{ color: "var(--sage-700)" }}
                      >
                        {formatARS(e.comisiones)}
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-cream/60 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: "var(--sage-700)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Ventas por medio de pago (mes) */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Ventas por medio de pago (mes)
        </h2>
        {ventasPorMp.length === 0 ? (
          <EmptyBox text="Sin ventas registradas este mes." />
        ) : (
          <div className="bg-card border border-border rounded-md p-5 space-y-3">
            {ventasPorMp.map((row) => (
              <div key={row.codigo} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {row.nombre}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({row.codigo})
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {formatARS(row.total)}
                    <span className="text-xs text-muted-foreground ml-2">
                      {row.pct.toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-cream/60 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${row.pct}%`,
                      backgroundColor: "var(--sage-700)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  color,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: "sage-700" | "danger";
  highlight?: boolean;
}) {
  const valueStyle =
    color === "sage-700"
      ? { color: "var(--sage-700)" }
      : color === "danger"
        ? { color: "var(--danger)" }
        : undefined;
  return (
    <div
      className={`bg-card border rounded-md p-5 ${highlight ? "border-sage-300" : "border-border"}`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className="font-display text-2xl mt-2 tabular-nums"
        style={valueStyle}
      >
        {value}
      </p>
      {hint && (
        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
          {hint}
        </p>
      )}
    </div>
  );
}

function Alert({
  icon,
  text,
  tone,
  href,
}: {
  icon: React.ReactNode;
  text: string;
  tone: "danger" | "warning" | "info";
  href: string;
}) {
  const styles = {
    danger: {
      borderColor: "var(--danger)",
      color: "var(--danger)",
      bg: "rgba(220, 38, 38, 0.05)",
    },
    warning: {
      borderColor: "var(--ink)",
      color: "var(--ink)",
      bg: "rgba(180, 140, 60, 0.05)",
    },
    info: {
      borderColor: "var(--sage-700)",
      color: "var(--sage-700)",
      bg: "rgba(120, 150, 130, 0.05)",
    },
  } as const;
  const s = styles[tone];
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-md border text-sm hover:opacity-90 transition-opacity"
      style={{ borderColor: s.borderColor, backgroundColor: s.bg, color: s.color }}
    >
      <span className="flex items-center gap-2">
        {icon}
        {text}
      </span>
      <span className="text-xs uppercase tracking-wider opacity-70">
        Ver →
      </span>
    </Link>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="bg-card border border-border rounded-md p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
