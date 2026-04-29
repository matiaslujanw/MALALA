import Link from "next/link";
import { Plus } from "lucide-react";
import { listIngresos } from "@/lib/data/ingresos";
import {
  aggregate,
  comisionesPorEmpleado,
} from "@/lib/data/ingresos-helpers";
import { listEmpleados } from "@/lib/data/empleados";
import { listClientes } from "@/lib/data/clientes";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";

interface SearchParams {
  rango?: "hoy" | "semana" | "mes" | "todo";
  empleado?: string;
  cliente?: string;
}

const RANGOS: Array<{ value: NonNullable<SearchParams["rango"]>; label: string }> = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Últimos 7 días" },
  { value: "mes", label: "Últimos 30 días" },
  { value: "todo", label: "Todo" },
];

function rangoToFechas(rango: NonNullable<SearchParams["rango"]>) {
  const now = new Date();
  const desde = new Date(now);
  if (rango === "hoy") {
    desde.setHours(0, 0, 0, 0);
  } else if (rango === "semana") {
    desde.setDate(desde.getDate() - 7);
  } else if (rango === "mes") {
    desde.setDate(desde.getDate() - 30);
  } else {
    return { desde: undefined, hasta: undefined };
  }
  return { desde: desde.toISOString(), hasta: now.toISOString() };
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const sucursal = await getActiveSucursal();
  if (!sucursal) return null;

  const sp = await searchParams;
  const rango = sp.rango ?? "hoy";
  const { desde, hasta } = rangoToFechas(rango);

  const [ingresos, empleados, clientes] = await Promise.all([
    listIngresos({
      sucursalId: sucursal.id,
      empleadoId: sp.empleado,
      clienteId: sp.cliente,
      desde,
      hasta,
    }),
    listEmpleados(),
    listClientes(),
  ]);

  const totales = aggregate(ingresos);
  const porEmpleado = comisionesPorEmpleado(ingresos);

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Ingresos
          </h1>
          <p className="text-sm text-muted-foreground">
            {sucursal.nombre} ·{" "}
            {RANGOS.find((r) => r.value === rango)?.label.toLowerCase()} ·{" "}
            {totales.cantidad} ticket{totales.cantidad !== 1 ? "s" : ""}
          </p>
        </div>

        {(user.rol === "admin" ||
          user.rol === "encargada" ||
          user.rol === "empleado") && (
          <Link
            href="/ventas/nueva"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4 stroke-[1.5]" />
            Nueva venta
          </Link>
        )}
      </header>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total cobrado"
          value={formatARS(totales.total)}
          hint={`${totales.cantidad} ticket${totales.cantidad !== 1 ? "s" : ""}`}
        />
        <KpiCard
          label="Para el equipo"
          value={formatARS(totales.comisiones)}
          hint={
            totales.total > 0
              ? `${((totales.comisiones / totales.total) * 100).toFixed(0)}% del total`
              : "—"
          }
          color="sage-700"
        />
        <KpiCard
          label="Costo de insumos"
          value={formatARS(totales.costoInsumos)}
          hint={
            totales.total > 0
              ? `${((totales.costoInsumos / totales.total) * 100).toFixed(0)}% del total`
              : "—"
          }
        />
        <KpiCard
          label="Neto del negocio"
          value={formatARS(totales.neto)}
          hint={
            totales.total > 0
              ? `${((totales.neto / totales.total) * 100).toFixed(0)}% del total`
              : "—"
          }
          color={totales.neto >= 0 ? "sage-700" : "danger"}
          highlight
        />
      </div>

      {/* Filtros */}
      <form
        action="/ventas"
        method="get"
        className="bg-card border border-border rounded-md p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Rango
          </label>
          <select
            name="rango"
            defaultValue={rango}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            {RANGOS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Empleado
          </label>
          <select
            name="empleado"
            defaultValue={sp.empleado ?? ""}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            <option value="">Todos</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Cliente
          </label>
          <select
            name="cliente"
            defaultValue={sp.cliente ?? ""}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Comisiones por empleado (solo si hay datos) */}
      {porEmpleado.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Comisiones por empleado en el rango
          </h2>
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Empleado</th>
                  <th className="text-right font-medium px-4 py-3">Líneas</th>
                  <th className="text-right font-medium px-4 py-3">
                    Comisión acumulada
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {porEmpleado.map(({ empleado, lineas, total }) => (
                  <tr key={empleado.id} className="hover:bg-cream/30">
                    <td className="px-4 py-3 font-medium">{empleado.nombre}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {lineas}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatARS(total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Listado de tickets */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Tickets
        </h2>
        {ingresos.length === 0 ? (
          <div className="bg-card border border-border rounded-md p-8 text-center text-sm text-muted-foreground">
            No hay ventas en el rango seleccionado.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Fecha</th>
                  <th className="text-left font-medium px-4 py-3">Cliente</th>
                  <th className="text-right font-medium px-4 py-3">Líneas</th>
                  <th className="text-right font-medium px-4 py-3">Cobrado</th>
                  <th className="text-right font-medium px-4 py-3">Equipo</th>
                  <th className="text-right font-medium px-4 py-3">Insumos</th>
                  <th className="text-right font-medium px-4 py-3">Neto</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ingresos.map((row) => (
                  <tr key={row.ingreso.id} className="hover:bg-cream/30">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {new Date(row.ingreso.fecha).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {row.cliente?.nombre ?? "Consumidor Final"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {row.lineas.length}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatARS(row.breakdown.total)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(row.breakdown.comisiones)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(row.breakdown.costoInsumos)}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums font-medium"
                      style={{
                        color:
                          row.breakdown.neto >= 0
                            ? "var(--sage-700)"
                            : "var(--danger)",
                      }}
                    >
                      {formatARS(row.breakdown.neto)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/ventas/${row.ingreso.id}`}
                        className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({
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
        <p className="text-xs text-muted-foreground mt-1 tabular-nums">{hint}</p>
      )}
    </div>
  );
}
