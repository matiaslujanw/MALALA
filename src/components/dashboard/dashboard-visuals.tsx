import { CircleAlert, PackageSearch } from "lucide-react";
import type { ReactNode } from "react";
import type { AnalyticsPoint, AnalyticsSnapshot } from "@/lib/data/analytics";
import { formatARS } from "@/lib/utils";

const CHART_COLORS = {
  primary: "#4a5840",
  primarySoft: "#dfe7d9",
  accent: "#8f6b7d",
  accentSoft: "#ead8e1",
  warm: "#d0af8c",
  warmSoft: "#f2e7db",
  danger: "#a84a3d",
  grid: "#e7e5e0",
  text: "#1a1a1a",
  muted: "#78766f",
  surface: "#ffffff",
};

export function DashboardVisuals({
  analytics,
  isEmployee,
}: {
  analytics: AnalyticsSnapshot;
  isEmployee: boolean;
}) {
  const showSucursalChart = analytics.scope.puedeVerGlobal;
  const showProductivity = !isEmployee;

  return (
    <div className="grid gap-6">
      <AreaChartCard
        title={isEmployee ? "Mi facturacion en el periodo" : "Ingresos por periodo"}
        description="Evolucion diaria de ingresos cobrados para detectar picos, caidas y tendencia."
        data={analytics.charts.ingresosPorDia}
        valueFormatter={formatARS}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <DonutChartCard
          title={isEmployee ? "Mi agenda por estado" : "Distribucion de estados"}
          description="Lectura rapida del equilibrio entre turnos completados, pendientes y cancelados."
          data={analytics.charts.turnosPorEstado}
        />
        <ColumnChartCard
          title="Hora pico de turnos"
          description="Concentracion horaria para ajustar agenda, equipo y capacidad."
          data={analytics.charts.turnosPorHora}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <HorizontalBarChartCard
          title="Top servicios por ingresos"
          description="Servicios con mayor peso economico dentro del rango filtrado."
          data={analytics.charts.serviciosTop}
          valueFormatter={formatARS}
          color={CHART_COLORS.accent}
          softColor={CHART_COLORS.accentSoft}
        />
        <RetentionCard
          title="Retencion de clientes"
          description="Relacion entre clientes recurrentes y nuevos para medir fidelizacion."
          retention={analytics.charts.retencionClientes}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        {showProductivity ? (
          <HorizontalBarChartCard
            title={analytics.scope.puedeVerGlobal ? "Productividad por profesional" : "Rendimiento del equipo"}
            description="Comparativo de facturacion para detectar capacidad, carga y desempeno."
            data={analytics.charts.rendimientoPorProfesional}
            valueFormatter={formatARS}
            color={CHART_COLORS.primary}
            softColor={CHART_COLORS.primarySoft}
          />
        ) : (
          <HorizontalBarChartCard
            title="Mis servicios con mayor impacto"
            description="Servicios que mas aportan a tu facturacion dentro del periodo."
            data={analytics.charts.serviciosTop}
            valueFormatter={formatARS}
            color={CHART_COLORS.primary}
            softColor={CHART_COLORS.primarySoft}
          />
        )}

        {showSucursalChart ? (
          <ColumnChartCard
            title="Ingresos por sucursal"
            description="Comparativa entre sedes para entender donde se concentra el negocio."
            data={analytics.charts.ingresosPorSucursal}
            valueFormatter={formatARS}
            color={CHART_COLORS.warm}
            softColor={CHART_COLORS.warmSoft}
          />
        ) : (
          <StatusPanel analytics={analytics} />
        )}
      </div>

      {showSucursalChart ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <ColumnChartCard
            title="Stock critico por sucursal"
            description="Alertas para decidir reposicion y prevenir quiebres operativos."
            data={analytics.charts.stockCriticoPorSucursal}
            color={CHART_COLORS.danger}
            softColor="#f6d7d2"
          />
          <StatusPanel analytics={analytics} />
        </div>
      ) : null}
    </div>
  );
}

function BaseCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.9rem] border border-border bg-card p-5 shadow-[0_14px_40px_rgba(44,53,37,0.04)]">
      <div className="mb-5 space-y-1">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          {title}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-200 bg-cream/60 px-4 py-10 text-center text-sm text-stone-700">
      Sin datos para el rango seleccionado.
    </div>
  );
}

function AreaChartCard({
  title,
  description,
  data,
  valueFormatter,
}: {
  title: string;
  description: string;
  data: AnalyticsPoint[];
  valueFormatter: (value: number) => string;
}) {
  if (data.length === 0) {
    return (
      <BaseCard title={title} description={description}>
        <EmptyChart />
      </BaseCard>
    );
  }

  const width = 880;
  const height = 280;
  const padding = { top: 18, right: 16, bottom: 40, left: 64 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const minValue = Math.min(...data.map((item) => item.value), 0);
  const valueRange = Math.max(maxValue - minValue, 1);

  const points = data.map((item, index) => {
    const x = padding.left + (chartWidth / Math.max(data.length - 1, 1)) * index;
    const y =
      padding.top + chartHeight - ((item.value - minValue) / valueRange) * chartHeight;
    return { ...item, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? 0} ${padding.top + chartHeight} L ${
    points[0]?.x ?? 0
  } ${padding.top + chartHeight} Z`;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, index) => {
    const value = minValue + (valueRange / ticks) * (ticks - index);
    const y = padding.top + (chartHeight / ticks) * index;
    return { value, y };
  });

  return (
    <BaseCard title={title} description={description}>
      <div className="space-y-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible">
          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={tick.y}
                y2={tick.y}
                stroke={CHART_COLORS.grid}
                strokeDasharray="4 6"
              />
              <text
                x={padding.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="11"
                fill={CHART_COLORS.muted}
              >
                {valueFormatter(Math.round(tick.value))}
              </text>
            </g>
          ))}

          {points.map((point) => (
            <line
              key={point.label}
              x1={point.x}
              x2={point.x}
              y1={padding.top}
              y2={padding.top + chartHeight}
              stroke={CHART_COLORS.grid}
              strokeDasharray="3 7"
            />
          ))}

          <path d={areaPath} fill="url(#incomeAreaGradient)" />
          <path
            d={linePath}
            fill="none"
            stroke={CHART_COLORS.accent}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point) => (
            <g key={`${point.label}-dot`}>
              <circle cx={point.x} cy={point.y} r="5" fill={CHART_COLORS.surface} />
              <circle cx={point.x} cy={point.y} r="4" fill={CHART_COLORS.accent} />
            </g>
          ))}

          {points.map((point) => (
            <text
              key={`${point.label}-label`}
              x={point.x}
              y={height - 12}
              textAnchor="middle"
              fontSize="11"
              fill={CHART_COLORS.muted}
            >
              {formatShortDate(point.label)}
            </text>
          ))}

          <defs>
            <linearGradient id="incomeAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8f6b7d" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#8f6b7d" stopOpacity="0.04" />
            </linearGradient>
          </defs>
        </svg>

        <div className="grid gap-3 sm:grid-cols-3">
          <InsightPill
            label="Pico"
            value={formatARS(Math.max(...data.map((item) => item.value), 0))}
          />
          <InsightPill
            label="Promedio"
            value={formatARS(
              Math.round(data.reduce((acc, item) => acc + item.value, 0) / Math.max(data.length, 1)),
            )}
          />
          <InsightPill
            label="Ultimo dia"
            value={formatARS(data.at(-1)?.value ?? 0)}
          />
        </div>
      </div>
    </BaseCard>
  );
}

function DonutChartCard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: AnalyticsPoint[];
}) {
  if (data.length === 0) {
    return (
      <BaseCard title={title} description={description}>
        <EmptyChart />
      </BaseCard>
    );
  }

  const normalized = data.filter((item) => item.value > 0);
  const total = normalized.reduce((acc, item) => acc + item.value, 0);
  const segmentsWithMeta = normalized.reduce<
    Array<AnalyticsPoint & { path: string; color: string; pathEnd: number }>
  >(
    (acc, item, index) => {
      const startAngle = acc.length === 0 ? -90 : acc[acc.length - 1]!.pathEnd;
      const angle = (item.value / total) * 360;
      const endAngle = startAngle + angle;
      const path = describeArc(120, 120, 72, startAngle, endAngle);
      return [
        ...acc,
        {
          ...item,
          path,
          color: pickSegmentColor(index),
          pathEnd: endAngle,
        },
      ];
    },
    [],
  );
  const segments = segmentsWithMeta.map(({ pathEnd, ...segment }) => {
    void pathEnd;
    return segment;
  });

  const highlighted = [...normalized].sort((a, b) => b.value - a.value)[0];

  return (
    <BaseCard title={title} description={description}>
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="mx-auto w-full max-w-[240px]">
          <svg viewBox="0 0 240 240" className="h-auto w-full">
            <circle cx="120" cy="120" r="72" fill="none" stroke="#f1eee8" strokeWidth="26" />
            {segments.map((segment) => (
              <path
                key={segment.label}
                d={segment.path}
                fill="none"
                stroke={segment.color}
                strokeWidth="26"
                strokeLinecap="butt"
              />
            ))}
            <circle cx="120" cy="120" r="52" fill="#fff" />
            <text
              x="120"
              y="112"
              textAnchor="middle"
              fontSize="14"
              fill={CHART_COLORS.muted}
            >
              Total
            </text>
            <text
              x="120"
              y="136"
              textAnchor="middle"
              fontSize="28"
              fontWeight="600"
              fill={CHART_COLORS.text}
            >
              {total}
            </text>
          </svg>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.35rem] border border-stone-100 bg-cream/55 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Estado dominante
            </p>
            <p className="mt-2 text-2xl font-semibold text-ink">{formatStateLabel(highlighted?.label ?? "-")}</p>
            <p className="mt-1 text-sm text-stone-700">
              {highlighted?.value ?? 0} turnos sobre {total}
            </p>
          </div>

          <div className="grid gap-3">
            {segments.map((segment) => (
              <div
                key={segment.label}
                className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-stone-100 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-sm text-ink">{formatStateLabel(segment.label)}</span>
                </div>
                <span className="text-sm font-medium tabular-nums text-stone-700">
                  {segment.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BaseCard>
  );
}

function HorizontalBarChartCard({
  title,
  description,
  data,
  valueFormatter,
  color,
  softColor,
}: {
  title: string;
  description: string;
  data: AnalyticsPoint[];
  valueFormatter: (value: number) => string;
  color: string;
  softColor: string;
}) {
  if (data.length === 0) {
    return (
      <BaseCard title={title} description={description}>
        <EmptyChart />
      </BaseCard>
    );
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <BaseCard title={title} description={description}>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">{item.label}</p>
              <p className="text-sm tabular-nums text-stone-700">{valueFormatter(item.value)}</p>
            </div>
            <div className="h-4 rounded-full" style={{ backgroundColor: softColor }}>
              <div
                className="h-4 rounded-full transition-[width]"
                style={{
                  width: `${Math.max((item.value / max) * 100, 8)}%`,
                  background: `linear-gradient(90deg, ${color} 0%, ${softColor} 100%)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </BaseCard>
  );
}

function ColumnChartCard({
  title,
  description,
  data,
  valueFormatter = (value: number) => String(value),
  color = CHART_COLORS.accent,
  softColor = CHART_COLORS.accentSoft,
}: {
  title: string;
  description: string;
  data: AnalyticsPoint[];
  valueFormatter?: (value: number) => string;
  color?: string;
  softColor?: string;
}) {
  if (data.length === 0) {
    return (
      <BaseCard title={title} description={description}>
        <EmptyChart />
      </BaseCard>
    );
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <BaseCard title={title} description={description}>
      <div className="space-y-5">
        <div className="flex h-72 items-end gap-3 rounded-[1.5rem] border border-stone-100 bg-[linear-gradient(180deg,#fff_0%,#f8f5ef_100%)] px-4 pb-4 pt-8">
          {data.map((item, index) => {
            const height = Math.max((item.value / max) * 100, 8);
            return (
              <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  {valueFormatter(item.value)}
                </div>
                <div className="flex h-52 w-full items-end justify-center rounded-t-[1.1rem]" style={{ backgroundColor: softColor }}>
                  <div
                    className="w-full rounded-t-[1rem]"
                    style={{
                      height: `${height}%`,
                      background:
                        index % 2 === 0
                          ? `linear-gradient(180deg, ${softColor} 0%, ${color} 100%)`
                          : color,
                    }}
                  />
                </div>
                <div className="text-center text-[11px] leading-4 text-stone-700">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <InsightPill label="Pico" value={valueFormatter(max)} />
          <InsightPill label="Items" value={String(data.length)} />
          <InsightPill
            label="Acumulado"
            value={valueFormatter(data.reduce((acc, item) => acc + item.value, 0))}
          />
        </div>
      </div>
    </BaseCard>
  );
}

function RetentionCard({
  title,
  description,
  retention,
}: {
  title: string;
  description: string;
  retention: AnalyticsSnapshot["charts"]["retencionClientes"];
}) {
  return (
    <BaseCard title={title} description={description}>
      {retention.total === 0 ? (
        <EmptyChart />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="rounded-[1.5rem] bg-[linear-gradient(145deg,#f7ecef_0%,#fff_100%)] p-5 text-center">
            <p className="font-display text-6xl text-[#8f6b7d]">{retention.tasaPct}%</p>
            <p className="mt-2 text-sm font-medium text-ink">Tasa de retencion</p>
            <p className="mt-1 text-sm text-stone-700">
              {retention.recurrentes} recurrentes de {retention.total} clientes
            </p>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-full bg-stone-100">
              <div className="flex h-4">
                <div
                  className="h-full bg-[#8f6b7d]"
                  style={{ width: `${retention.tasaPct}%` }}
                />
                <div
                  className="h-full bg-[#d8d3dc]"
                  style={{ width: `${100 - retention.tasaPct}%` }}
                />
              </div>
            </div>
            <div className="grid gap-3">
              <LegendRow color="#8f6b7d" label="Clientes recurrentes" value={retention.recurrentes} />
              <LegendRow color="#d8d3dc" label="Clientes nuevos / unicos" value={retention.nuevos} />
            </div>
          </div>
        </div>
      )}
    </BaseCard>
  );
}

function StatusPanel({ analytics }: { analytics: AnalyticsSnapshot }) {
  return (
    <div className="space-y-6">
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
              Indicadores rapidos para actuar antes de que el problema crezca.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <MiniMetric label="Stock bajo" value={String(analytics.kpis.stockBajo)} />
          <MiniMetric
            label="Stock negativo"
            value={String(analytics.kpis.stockNegativo)}
            tone="danger"
          />
          <MiniMetric label="Egresos" value={formatARS(analytics.kpis.egresos)} />
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
              Definiciones comunes para que todos lean el mismo negocio.
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
              <p className="mt-1 text-sm text-stone-700">{item.definicion}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
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

function InsightPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-stone-100 bg-cream/60 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-stone-100 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-ink">{label}</span>
      </div>
      <span className="text-sm font-medium tabular-nums text-stone-700">{value}</span>
    </div>
  );
}

function formatShortDate(label: string) {
  const [year, month, day] = label.split("-");
  if (!year || !month || !day) return label;
  return `${day}/${month}`;
}

function formatStateLabel(label: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    confirmado: "Confirmado",
    en_curso: "En curso",
    completado: "Completado",
    cancelado: "Cancelado",
    ausente: "Ausente",
  };
  return labels[label] ?? label;
}

function pickSegmentColor(index: number) {
  const palette = [
    CHART_COLORS.primary,
    CHART_COLORS.accent,
    CHART_COLORS.warm,
    "#74877f",
    CHART_COLORS.danger,
    "#b6a8b6",
  ];
  return palette[index % palette.length];
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angle: number) {
  const angleInRadians = ((angle - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}
