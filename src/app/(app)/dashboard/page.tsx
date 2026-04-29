import Link from "next/link";
import type { ComponentType } from "react";
import {
  CalendarClock,
  CircleAlert,
  PackageSearch,
  TrendingUp,
} from "lucide-react";
import { getAnalyticsSnapshot } from "@/lib/data/analytics";
import { listEmpleados } from "@/lib/data/empleados";
import { listSucursales } from "@/lib/data/sucursales";
import { requireUser } from "@/lib/auth/session";
import { formatARS, formatLongDate } from "@/lib/utils";

interface SearchParams {
  desde?: string;
  hasta?: string;
  sucursal?: string;
  empleado?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const analytics = await getAnalyticsSnapshot({
    desde: sp.desde,
    hasta: sp.hasta,
    sucursalId: sp.sucursal,
    empleadoId: sp.empleado,
  });
  const [sucursales, empleados] = await Promise.all([
    listSucursales({ soloActivas: true }),
    listEmpleados(),
  ]);

  const isEmployee = analytics.scope.rol === "empleado";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            {isEmployee
              ? "Mi operacion"
              : analytics.scope.puedeVerGlobal
                ? "Vision global"
                : "Mi sucursal"}
          </p>
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Hola {user.nombre} · rango{" "}
            {formatLongDate(`${analytics.filters.desde}T12:00:00`)} a{" "}
            {formatLongDate(`${analytics.filters.hasta}T12:00:00`)}
          </p>
        </div>
      </header>

      {!isEmployee && (
        <form
          action="/dashboard"
          method="get"
          className="grid gap-3 rounded-[1.5rem] border border-border bg-card p-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
        >
          <label className="space-y-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Desde
            </span>
            <input
              type="date"
              name="desde"
              defaultValue={analytics.filters.desde}
              className="w-full rounded-xl border border-border bg-card px-3 py-2"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Hasta
            </span>
            <input
              type="date"
              name="hasta"
              defaultValue={analytics.filters.hasta}
              className="w-full rounded-xl border border-border bg-card px-3 py-2"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Sucursal
            </span>
            <select
              name="sucursal"
              defaultValue={analytics.filters.sucursalId ?? ""}
              className="w-full rounded-xl border border-border bg-card px-3 py-2"
            >
              <option value="">Todas las permitidas</option>
              {sucursales
                .filter((item) =>
                  analytics.scope.sucursalIdsPermitidas.includes(item.id),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Profesional
            </span>
            <select
              name="empleado"
              defaultValue={analytics.filters.empleadoId ?? ""}
              className="w-full rounded-xl border border-border bg-card px-3 py-2"
            >
              <option value="">Todos</option>
              {empleados
                .filter((item) =>
                  analytics.scope.sucursalIdsPermitidas.includes(
                    item.sucursal_principal_id,
                  ),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition hover:bg-sage-700"
            >
              Actualizar
            </button>
          </div>
        </form>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label={isEmployee ? "Mi facturacion" : "Ingresos"}
          value={formatARS(analytics.kpis.ingresos)}
          hint="ventas cobradas"
          icon={TrendingUp}
        />
        <MetricCard
          label={isEmployee ? "Mi neto estimado" : "Neto"}
          value={formatARS(analytics.kpis.neto)}
          hint="menos comision e insumos"
        />
        <MetricCard
          label={isEmployee ? "Mis turnos" : "Turnos"}
          value={String(analytics.kpis.turnos)}
          hint="en el rango"
          icon={CalendarClock}
        />
        <MetricCard
          label="Ocupacion"
          value={`${analytics.kpis.ocupacionPct}%`}
          hint="capacidad teorica"
        />
        <MetricCard
          label="Cancelaciones"
          value={`${analytics.kpis.cancelacionesPct}%`}
          hint="sobre turnos"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <section className="space-y-6">
          <ChartCard
            title={isEmployee ? "Mi rendimiento por servicio" : "Ingresos por dia"}
            description="Base comun de metricas para seguimiento operativo."
            data={
              isEmployee
                ? analytics.charts.serviciosTop
                : analytics.charts.ingresosPorDia
            }
            valueFormatter={formatARS}
          />

          <ChartCard
            title={isEmployee ? "Mi agenda por estado" : "Turnos por estado"}
            description="Definiciones consistentes para confirmado, cancelado y completado."
            data={analytics.charts.turnosPorEstado}
          />

          {!isEmployee && (
            <ChartCard
              title={
                analytics.scope.puedeVerGlobal
                  ? "Rendimiento por profesional"
                  : "Servicios top"
              }
              description={
                analytics.scope.puedeVerGlobal
                  ? "Comparativo para detectar capacidad y productividad."
                  : "Mix de servicios mas vendido dentro de la sucursal."
              }
              data={
                analytics.scope.puedeVerGlobal
                  ? analytics.charts.rendimientoPorProfesional
                  : analytics.charts.serviciosTop
              }
              valueFormatter={formatARS}
            />
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[1.75rem] border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-cream p-2">
                <PackageSearch className="h-4 w-4 text-stone-700" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Salud operativa
                </p>
                <p className="text-sm text-muted-foreground">
                  {analytics.scope.puedeVerGlobal
                    ? "Comparativa de sucursales"
                    : "Estado actual de la sucursal"}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <StatusMiniCard
                label="Stock bajo"
                value={String(analytics.kpis.stockBajo)}
              />
              <StatusMiniCard
                label="Stock negativo"
                value={String(analytics.kpis.stockNegativo)}
                tone="danger"
              />
              <StatusMiniCard
                label="Egresos"
                value={formatARS(analytics.kpis.egresos)}
              />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[#fff5dd] p-2">
                <CircleAlert className="h-4 w-4 text-[#8c6b11]" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Gobernanza de dato
                </p>
                <p className="text-sm text-muted-foreground">
                  Las metricas salen de una definicion central compartida.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {analytics.governance.metricas.map((item) => (
                <div
                  key={item.nombre}
                  className="rounded-2xl border border-stone-100 bg-cream/60 p-4"
                >
                  <p className="text-sm font-semibold text-ink">{item.nombre}</p>
                  <p className="mt-1 text-sm text-stone-700">
                    {item.definicion}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Accesos
            </p>
            <div className="mt-4 grid gap-2">
              <QuickLink
                href="/turnos"
                label={isEmployee ? "Ver mis turnos" : "Abrir agenda"}
              />
              <QuickLink href="/reportes" label="Ir a reportes" />
              {analytics.scope.puedeVerStock ? (
                <QuickLink href="/stock" label="Revisar stock" />
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[1.4rem] border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        {Icon ? <Icon className="h-5 w-5 text-sage-700" /> : null}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  data,
  valueFormatter = (value: number) => String(value),
}: {
  title: string;
  description: string;
  data: Array<{ label: string; value: number }>;
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="rounded-[1.75rem] border border-border bg-card p-5">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-cream/60 px-4 py-6 text-sm text-stone-700">
          Sin datos para el rango seleccionado.
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">{item.label}</span>
                <span className="tabular-nums text-stone-700">
                  {valueFormatter(item.value)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-stone-100">
                <div
                  className="h-2 rounded-full bg-sage-700"
                  style={{
                    width: `${Math.max((item.value / max) * 100, 6)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusMiniCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "danger"
          ? "border-[#f2c4bd] bg-[#fff1ef]"
          : "border-stone-100 bg-cream/60"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border px-4 py-3 text-sm transition hover:border-sage-200 hover:bg-sage-50"
    >
      {label}
    </Link>
  );
}
