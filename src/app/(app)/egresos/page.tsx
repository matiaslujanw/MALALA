import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { clampSucursalId, getAccessScope } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { listEgresos } from "@/lib/data/egresos";
import { aggregateEgresos } from "@/lib/data/egresos-helpers";
import { listProveedores } from "@/lib/data/proveedores";
import { listRubrosGasto } from "@/lib/data/rubros-gasto";
import { listSucursales } from "@/lib/data/sucursales";
import { formatARS } from "@/lib/utils";
import { TogglePagadoButton } from "./toggle-pagado-button";

interface SearchParams {
  rango?: "hoy" | "semana" | "mes" | "todo";
  rubro?: string;
  proveedor?: string;
  pendientes?: string;
  sucursal?: string;
}

const RANGOS: Array<{ value: NonNullable<SearchParams["rango"]>; label: string }> = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Ultimos 7 dias" },
  { value: "mes", label: "Ultimos 30 dias" },
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
  const [user, scope, sp, sucursales, rubros, proveedores] = await Promise.all([
    requireUser(),
    getAccessScope(),
    searchParams,
    listSucursales({ soloActivas: true }),
    listRubrosGasto(),
    listProveedores(),
  ]);

  if (!scope || scope.rol === "empleado") {
    redirect("/dashboard");
  }

  const rango = sp.rango ?? "mes";
  const { desde, hasta } = rangoToFechas(rango);
  const sucursalId = clampSucursalId(scope, sp.sucursal);
  const sucursal =
    sucursales.find((item) => item.id === sucursalId) ??
    sucursales.find((item) => scope.sucursalIdsPermitidas.includes(item.id)) ??
    null;

  if (!sucursal) {
    redirect("/dashboard");
  }

  const egresos = await listEgresos({
    sucursalId: sucursal.id,
    rubroId: sp.rubro,
    proveedorId: sp.proveedor,
    soloPendientes: sp.pendientes === "1",
    desde,
    hasta,
  });

  const totales = aggregateEgresos(egresos);
  const puedeCargar = user.rol === "admin" || user.rol === "encargada";

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Egresos
          </h1>
          <p className="text-sm text-muted-foreground">
            {sucursal.nombre} ·{" "}
            {RANGOS.find((item) => item.value === rango)?.label.toLowerCase()} ·{" "}
            {totales.cantidad} movimiento{totales.cantidad !== 1 ? "s" : ""}
          </p>
        </div>

        {puedeCargar && (
          <Link
            href="/egresos/nuevo"
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700"
          >
            <Plus className="h-4 w-4 stroke-[1.5]" />
            Nuevo egreso
          </Link>
        )}
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Kpi label="Total egresos" value={formatARS(totales.total)} />
        <Kpi label="Pagado" value={formatARS(totales.pagado)} color="sage-700" />
        <Kpi
          label="Pendiente"
          value={formatARS(totales.pendiente)}
          color={totales.pendiente > 0 ? "danger" : undefined}
        />
      </div>

      <form
        action="/egresos"
        method="get"
        className="grid grid-cols-1 items-end gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-5 xl:grid-cols-6"
      >
        {scope.puedeVerGlobal ? (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sucursal
            </label>
            <select
              name="sucursal"
              defaultValue={sucursal.id}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              {sucursales
                .filter((item) => scope.sucursalIdsPermitidas.includes(item.id))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Rango
          </label>
          <select
            name="rango"
            defaultValue={rango}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            {RANGOS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
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
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {rubros.map((item) => (
              <option key={item.id} value={item.id}>
                {item.subrubro ? `${item.rubro} · ${item.subrubro}` : item.rubro}
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
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {proveedores.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="pendientes"
            value="1"
            defaultChecked={sp.pendientes === "1"}
            className="h-4 w-4 rounded border-border accent-sage-500"
          />
          <span>Solo pendientes</span>
        </label>

        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700"
        >
          Filtrar
        </button>
      </form>

      {egresos.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No hay egresos en el rango seleccionado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Rubro</th>
                <th className="px-4 py-3 text-left font-medium">Detalle</th>
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium">MP</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                {puedeCargar ? <th className="w-28 px-4 py-3"></th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {egresos.map((row) => (
                <tr key={row.egreso.id} className="hover:bg-cream/30">
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
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
                        {row.egreso.cantidad != null ? (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            x {row.egreso.cantidad}
                          </span>
                        ) : null}
                      </>
                    ) : row.egreso.observacion ? (
                      <span className="text-muted-foreground">
                        {row.egreso.observacion}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.proveedor?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-muted-foreground">
                    {row.mp?.codigo ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
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
                  {puedeCargar ? (
                    <td className="px-4 py-3 text-right">
                      <TogglePagadoButton
                        egresoId={row.egreso.id}
                        pagado={row.egreso.pagado}
                      />
                    </td>
                  ) : null}
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
    <div className="rounded-md border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl tabular-nums" style={valueStyle}>
        {value}
      </p>
    </div>
  );
}
