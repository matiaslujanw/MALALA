import Link from "next/link";
import type { ComponentType } from "react";
import { CalendarClock, Landmark, TrendingUp } from "lucide-react";
import { DashboardVisuals } from "@/components/dashboard/dashboard-visuals";
import { getAnalyticsSnapshot } from "@/lib/data/analytics";
import { listEmpleados } from "@/lib/data/empleados";
import { listSucursales } from "@/lib/data/sucursales";
import { listSaldos } from "@/lib/data/cuentas-bancarias";
import { requireUser } from "@/lib/auth/session";
import { buildAccessScope } from "@/lib/auth/access";
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
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const scope = buildAccessScope(user);
  const [analytics, sucursales, empleados, saldos] = await Promise.all([
    getAnalyticsSnapshot({
      desde: sp.desde,
      hasta: sp.hasta,
      sucursalId: sp.sucursal,
      empleadoId: sp.empleado,
    }),
    listSucursales({ soloActivas: true }),
    listEmpleados(),
    scope.puedeVerCaja ? listSaldos() : Promise.resolve([]),
  ]);

  const isEmployee = analytics.scope.rol === "empleado";
  const totalSaldos = saldos.reduce((acc, s) => acc + s.saldo, 0);

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
          <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
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
          className="grid gap-3 rounded-[1.5rem] border border-border bg-card p-4 shadow-[0_14px_40px_rgba(44,53,37,0.04)] lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
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

      {scope.puedeVerCaja && saldos.length > 0 && (
        <SaldosCard
          saldos={saldos}
          sucursales={sucursales}
          total={totalSaldos}
        />
      )}

      <DashboardVisuals analytics={analytics} isEmployee={isEmployee} />

      <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[0_14px_40px_rgba(44,53,37,0.04)]">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Accesos
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
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
    <div className="rounded-[1.4rem] border border-border bg-card p-5 shadow-[0_12px_30px_rgba(44,53,37,0.04)]">
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

function SaldosCard({
  saldos,
  sucursales,
  total,
}: {
  saldos: Array<{ cuenta: { id: string; sucursal_id: string; nombre: string; tipo: string }; saldo: number }>;
  sucursales: Array<{ id: string; nombre: string }>;
  total: number;
}) {
  const sucursalNombreById = new Map(sucursales.map((s) => [s.id, s.nombre]));
  const grupos = new Map<string, { total: number; items: typeof saldos }>();
  for (const s of saldos) {
    const entry = grupos.get(s.cuenta.sucursal_id) ?? { total: 0, items: [] };
    entry.total += s.saldo;
    entry.items.push(s);
    grupos.set(s.cuenta.sucursal_id, entry);
  }
  const multipleSucursales = grupos.size > 1;
  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[0_14px_40px_rgba(44,53,37,0.04)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-sage-700" />
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Saldos en cuentas
          </p>
        </div>
        <Link
          href="/bancos"
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Ver detalle →
        </Link>
      </div>
      <p className="mt-2 font-display text-3xl tabular-nums">
        {formatARS(total)}
      </p>
      <div className="mt-5 space-y-4">
        {Array.from(grupos.entries()).map(([sucId, entry]) => (
          <div key={sucId}>
            {multipleSucursales && (
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {sucursalNombreById.get(sucId) ?? sucId}
                </p>
                <p className="text-xs tabular-nums font-medium">
                  {formatARS(entry.total)}
                </p>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {entry.items.map((s) => (
                <div
                  key={s.cuenta.id}
                  className="flex items-baseline justify-between rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.cuenta.nombre}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.cuenta.tipo}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums font-medium">
                    {formatARS(s.saldo)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
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
