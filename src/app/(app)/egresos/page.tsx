import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { listEgresos } from "@/lib/data/egresos";
import { aggregateEgresos } from "@/lib/data/egresos-helpers";
import { listRubrosGasto } from "@/lib/data/rubros-gasto";
import { listProveedores } from "@/lib/data/proveedores";
import { formatARS } from "@/lib/utils";
import { TogglePagadoButton } from "./toggle-pagado-button";

interface SearchParams {
  rango?: "hoy" | "semana" | "mes" | "todo";
  rubro?: string;
  proveedor?: string;
  pendientes?: string; // "1"
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
  if (rango === "hoy") desde.setHours(0, 0, 0, 0);
  else if (rango === "semana") desde.setDate(desde.getDate() - 7);
  else if (rango === "mes") desde.setDate(desde.getDate() - 30);
  else return { desde: undefined, hasta: undefined };
  return { desde: desde.toISOString(), hasta: now.toISOString() };
}

export default async function EgresosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const sucursal = await getActiveSucursal();
  if (!sucursal) redirect("/dev/login");

  const sp = await searchParams;
  const rango = sp.rango ?? "mes";
  const { desde, hasta } = rangoToFechas(rango);

  const [egresos, rubros, proveedores] = await Promise.all([
    listEgresos({
      sucursalId: sucursal.id,
      rubroId: sp.rubro,
      proveedorId: sp.proveedor,
      soloPendientes: sp.pendientes === "1",
      desde,
      hasta,
    }),
    listRubrosGasto(),
    listProveedores(),
  ]);

  const totales = aggregateEgresos(egresos);
  const puedeCargar = user.rol === "admin" || user.rol === "encargada";

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Egresos
          </h1>
          <p className="text-sm text-muted-foreground">
            {sucursal.nombre} ·{" "}
            {RANGOS.find((r) => r.value === rango)?.label.toLowerCase()} ·{" "}
            {totales.cantidad} movimiento{totales.cantidad !== 1 ? "s" : ""}
          </p>
        </div>

        {puedeCargar && (
          <Link
            href="/egresos/nuevo"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4 stroke-[1.5]" />
            Nuevo egreso
          </Link>
        )}
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi label="Total egresos" value={formatARS(totales.total)} />
        <Kpi label="Pagado" value={formatARS(totales.pagado)} color="sage-700" />
        <Kpi
          label="Pendiente"
          value={formatARS(totales.pendiente)}
          color={totales.pendiente > 0 ? "danger" : undefined}
        />
      </div>

      {/* Filtros */}
      <form
        action="/egresos"
        method="get"
        className="bg-card border border-border rounded-md p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
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
            Rubro
          </label>
          <select
            name="rubro"
            defaultValue={sp.rubro ?? ""}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            <option value="">Todos</option>
            {rubros.map((r) => (
              <option key={r.id} value={r.id}>
                {r.subrubro ? `${r.rubro} · ${r.subrubro}` : r.rubro}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Proveedor
          </label>
          <select
            name="proveedor"
            defaultValue={sp.proveedor ?? ""}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            <option value="">Todos</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-2">
          <input
            type="checkbox"
            name="pendientes"
            value="1"
            defaultChecked={sp.pendientes === "1"}
            className="h-4 w-4 rounded border-border accent-sage-500"
          />
          <span>Sólo pendientes</span>
        </label>
        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Listado */}
      {egresos.length === 0 ? (
        <div className="bg-card border border-border rounded-md p-8 text-center text-sm text-muted-foreground">
          No hay egresos en el rango seleccionado.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Fecha</th>
                <th className="text-left font-medium px-4 py-3">Rubro</th>
                <th className="text-left font-medium px-4 py-3">Detalle</th>
                <th className="text-left font-medium px-4 py-3">Proveedor</th>
                <th className="text-left font-medium px-4 py-3">MP</th>
                <th className="text-right font-medium px-4 py-3">Monto</th>
                <th className="text-center font-medium px-4 py-3">Estado</th>
                {puedeCargar && (
                  <th className="px-4 py-3 w-28"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {egresos.map((row) => (
                <tr key={row.egreso.id} className="hover:bg-cream/30">
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {new Date(row.egreso.fecha).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {row.rubro
                      ? row.rubro.subrubro
                        ? `${row.rubro.rubro} · ${row.rubro.subrubro}`
                        : row.rubro.rubro
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.insumo ? (
                      <>
                        <span className="font-medium">{row.insumo.nombre}</span>
                        {row.egreso.cantidad != null && (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            × {row.egreso.cantidad}
                          </span>
                        )}
                      </>
                    ) : row.egreso.observacion ? (
                      <span className="text-muted-foreground">
                        {row.egreso.observacion}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.proveedor?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-muted-foreground">
                    {row.mp?.codigo ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatARS(row.egreso.valor)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.egreso.pagado ? (
                      <span
                        className="text-xs uppercase tracking-wider"
                        style={{ color: "var(--sage-700)" }}
                      >
                        Pagado
                      </span>
                    ) : (
                      <span
                        className="text-xs uppercase tracking-wider"
                        style={{ color: "var(--danger)" }}
                      >
                        Pendiente
                      </span>
                    )}
                  </td>
                  {puedeCargar && (
                    <td className="px-4 py-3 text-right">
                      <TogglePagadoButton
                        egresoId={row.egreso.id}
                        pagado={row.egreso.pagado}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "sage-700" | "danger";
}) {
  const valueStyle =
    color === "sage-700"
      ? { color: "var(--sage-700)" }
      : color === "danger"
        ? { color: "var(--danger)" }
        : undefined;
  return (
    <div className="bg-card border border-border rounded-md p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-2xl mt-2 tabular-nums" style={valueStyle}>
        {value}
      </p>
    </div>
  );
}
