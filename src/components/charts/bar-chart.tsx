import { formatARS } from "@/lib/utils";

interface BarChartProps {
  data: Array<{ fecha: string; total: number; tickets: number }>;
  height?: number;
}

/**
 * Gráfico de barras simple en SVG (server component, sin client JS).
 * data: array ya ordenado cronológicamente.
 */
export function BarChart({ data, height = 180 }: BarChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Sin datos para graficar.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.total), 1);
  const barCount = data.length;
  const gap = 6;
  // viewBox responsive: 800 x height
  const width = 800;
  const innerH = height - 28; // margen para labels
  const barW = (width - gap * (barCount + 1)) / barCount;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className="overflow-visible"
    >
      {/* Eje base */}
      <line
        x1={0}
        x2={width}
        y1={innerH}
        y2={innerH}
        stroke="currentColor"
        opacity={0.1}
      />
      {data.map((d, i) => {
        const h = max > 0 ? (d.total / max) * (innerH - 6) : 0;
        const x = gap + i * (barW + gap);
        const y = innerH - h;
        const day = d.fecha.slice(8, 10); // dd
        const isToday = i === data.length - 1;
        return (
          <g key={d.fecha}>
            <title>
              {d.fecha} · {formatARS(d.total)} · {d.tickets} tickets
            </title>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              fill={isToday ? "var(--sage-700)" : "var(--sage-300, #b5cdb6)"}
            />
            <text
              x={x + barW / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              opacity={0.6}
            >
              {day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
