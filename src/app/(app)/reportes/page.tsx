import { redirect } from "next/navigation";
import { getAnalyticsSnapshot } from "@/lib/data/analytics";
import { listEmpleados } from "@/lib/data/empleados";
import { listSucursales } from "@/lib/data/sucursales";
import { requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";

interface SearchParams {
  desde?: string;
  hasta?: string;
  sucursal?: string;
  empleado?: string;
  estado?: string;
  rubro?: string;
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();
  const sp = await searchParams;
  const analytics = await getAnalyticsSnapshot({
    desde: sp.desde,
    hasta: sp.hasta,
    sucursalId: sp.sucursal,
    empleadoId: sp.empleado,
    turnoEstado: (sp.estado as never) ?? "",
    rubro: sp.rubro,
  });

  if (!analytics.scope.puedeVerReportes) {
    redirect("/dashboard");
  }

  const [sucursales, empleados] = await Promise.all([
    listSucursales({ soloActivas: true }),
    listEmpleados(),
  ]);

  return (
    <div className="space-y-8 max-w-7xl">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Hub analitico
        </p>
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Reportes
        </h1>
        <p className="text-sm text-muted-foreground">
          Analitica multi-modulo con filtros compartidos y actividad auditada.
        </p>
      </header>

      <form
        action="/reportes"
        method="get"
        className="grid gap-3 rounded-[1.5rem] border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-6"
      >
        <FieldDate name="desde" label="Desde" value={analytics.filters.desde} />
        <FieldDate name="hasta" label="Hasta" value={analytics.filters.hasta} />
        <FieldSelect
          name="sucursal"
          label="Sucursal"
          value={analytics.filters.sucursalId ?? ""}
          options={[
            { value: "", label: "Todas" },
            ...sucursales
              .filter((item) =>
                analytics.scope.sucursalIdsPermitidas.includes(item.id),
              )
              .map((item) => ({ value: item.id, label: item.nombre })),
          ]}
        />
        <FieldSelect
          name="empleado"
          label="Profesional"
          value={analytics.filters.empleadoId ?? ""}
          options={[
            { value: "", label: "Todos" },
            ...empleados
              .filter((item) =>
                analytics.scope.sucursalIdsPermitidas.includes(
                  item.sucursal_principal_id,
                ),
              )
              .map((item) => ({ value: item.id, label: item.nombre })),
          ]}
        />
        <FieldSelect
          name="estado"
          label="Estado turno"
          value={analytics.filters.turnoEstado}
          options={[
            { value: "", label: "Todos" },
            { value: "pendiente", label: "Pendiente" },
            { value: "confirmado", label: "Confirmado" },
            { value: "en_curso", label: "En curso" },
            { value: "completado", label: "Completado" },
            { value: "cancelado", label: "Cancelado" },
            { value: "ausente", label: "Ausente" },
          ]}
        />
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition hover:bg-sage-700"
          >
            Aplicar
          </button>
        </div>
      </form>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <ReportSection
            title="Distribucion de ingresos"
            description="Consolidado por sucursal para comparacion ejecutiva."
            rows={analytics.charts.ingresosPorSucursal}
            formatValue={formatARS}
          />
          <ReportSection
            title="Productividad por profesional"
            description="Facturacion asociada a lineas registradas."
            rows={analytics.charts.rendimientoPorProfesional}
            formatValue={formatARS}
          />
          <ReportSection
            title="Servicios top"
            description="Mix de servicios mas vendidos dentro del rango actual."
            rows={analytics.charts.serviciosTop}
            formatValue={formatARS}
          />
          <ReportSection
            title="Stock critico por sucursal"
            description="Conteo de insumos por debajo del umbral o en negativo."
            rows={analytics.charts.stockCriticoPorSucursal}
          />
        </div>

        <aside className="space-y-6">
          <div className="rounded-[1.75rem] border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              KPIs de control
            </p>
            <div className="mt-4 grid gap-3">
              <KpiLine
                label="Ingresos"
                value={formatARS(analytics.kpis.ingresos)}
              />
              <KpiLine label="Neto" value={formatARS(analytics.kpis.neto)} />
              <KpiLine label="Turnos" value={String(analytics.kpis.turnos)} />
              <KpiLine
                label="Ocupacion"
                value={`${analytics.kpis.ocupacionPct}%`}
              />
              <KpiLine
                label="Cancelaciones"
                value={`${analytics.kpis.cancelacionesPct}%`}
              />
              <KpiLine
                label="Egresos"
                value={formatARS(analytics.kpis.egresos)}
              />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Trazabilidad reciente
            </p>
            <div className="mt-4 space-y-3">
              {analytics.governance.actividadReciente.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-stone-100 bg-cream/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                    <span>{item.modulo}</span>
                    <span>
                      {new Date(item.fecha).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-ink">
                    {item.actor}
                  </p>
                  <p className="mt-1 text-sm text-stone-700">{item.detalle}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FieldDate({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: string;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        name={name}
        type="date"
        defaultValue={value}
        className="w-full rounded-xl border border-border bg-card px-3 py-2"
      />
    </label>
  );
}

function FieldSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="w-full rounded-xl border border-border bg-card px-3 py-2"
      >
        {options.map((item) => (
          <option key={`${name}-${item.value || "all"}`} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function KpiLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-cream/60 px-4 py-3 text-sm">
      <span className="text-stone-700">{label}</span>
      <span className="font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

function ReportSection({
  title,
  description,
  rows,
  formatValue = (value: number) => String(value),
}: {
  title: string;
  description: string;
  rows: Array<{ label: string; value: number }>;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(...rows.map((item) => item.value), 1);
  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-5">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-cream/60 px-4 py-6 text-sm text-stone-700">
          Sin datos para estos filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">{item.label}</span>
                <span className="tabular-nums text-stone-700">
                  {formatValue(item.value)}
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
    </section>
  );
}
