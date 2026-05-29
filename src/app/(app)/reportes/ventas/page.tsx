import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { buildAccessScope } from "@/lib/auth/access";
import { listIngresos } from "@/lib/data/ingresos";
import { listSucursales } from "@/lib/data/sucursales";
import { listEmpleados } from "@/lib/data/empleados";
import { listMotivosDescuento } from "@/lib/data/motivos-descuento";
import { aggregate, descuentosPorMotivo } from "@/lib/data/ingresos-helpers";
import { formatARS } from "@/lib/utils";
import {
  parseReporteFiltros,
  type ReporteFiltrosInput,
} from "../_filters";
import { ReporteFiltroForm } from "../_filter-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<ReporteFiltrosInput>;
}

export default async function ReportesVentasPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (!scope.puedeVerReportes) redirect("/dashboard");

  const sp = await searchParams;
  const filtros = parseReporteFiltros(sp, scope);

  const [sucursalesAll, empleadosAll, motivosAll] = await Promise.all([
    listSucursales({ soloActivas: true }),
    listEmpleados(),
    listMotivosDescuento(),
  ]);
  const motivosById = new Map(motivosAll.map((m) => [m.id, m]));
  const sucursales = sucursalesAll.filter((s) =>
    scope.sucursalIdsPermitidas.includes(s.id),
  );
  const empleados = empleadosAll.filter(
    (e) => scope.sucursalIdsPermitidas.includes(e.sucursal_principal_id),
  );

  const ingresos = await listIngresos({
    sucursalId: filtros.sucursalId,
    empleadoId: filtros.empleadoId,
    desde: filtros.desdeIso,
    hasta: filtros.hastaIso,
  });

  const totals = aggregate(ingresos);
  const descuentosMotivos = descuentosPorMotivo(ingresos, motivosById);
  const sucursalNombreById = new Map(sucursales.map((s) => [s.id, s.nombre]));
  const multiSucursal = sucursales.length > 1;

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="space-y-2">
        <Link
          href={`/reportes?${new URLSearchParams({
            desde: filtros.desde,
            hasta: filtros.hasta,
            ...(filtros.sucursalId ? { sucursal: filtros.sucursalId } : {}),
          }).toString()}`}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3 stroke-[1.5]" />
          Volver a reportes
        </Link>
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Ventas del período
        </h1>
        <p className="text-sm text-muted-foreground">
          {filtros.desde} → {filtros.hasta} · {totals.cantidad} venta
          {totals.cantidad !== 1 ? "s" : ""}
        </p>
      </header>

      <ReporteFiltroForm
        action="/reportes/ventas"
        filtros={filtros}
        sucursales={sucursales}
        empleados={empleados}
        mostrarEmpleado
      />

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Venta teórica" value={formatARS(totals.ventaTeorica)} />
        <Stat
          label="Descuentos"
          value={formatARS(totals.descuentos)}
          accent={totals.descuentos > 0 ? "danger" : undefined}
        />
        <Stat
          label="Venta real"
          value={formatARS(totals.total)}
          accent="sage"
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Tickets" value={String(totals.cantidad)} />
        <Stat label="Facturado" value={formatARS(totals.total)} accent="sage" />
        <Stat label="Comisiones" value={formatARS(totals.comisiones)} />
        <Stat label="Costo insumos" value={formatARS(totals.costoInsumos)} />
        <Stat
          label="Neto"
          value={formatARS(totals.neto)}
          accent={totals.neto >= 0 ? "sage" : "danger"}
        />
      </section>

      {descuentosMotivos.length > 0 && (
        <section className="bg-card border border-border rounded-md p-5 space-y-3 max-w-md">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Descuentos por motivo
          </h2>
          <div className="space-y-1.5 text-sm">
            {descuentosMotivos.map((d) => (
              <div
                key={d.motivo}
                className="flex justify-between items-center tabular-nums"
              >
                <span>
                  {d.motivo}
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · {d.cantidad} venta{d.cantidad !== 1 ? "s" : ""}
                  </span>
                </span>
                <span className="text-rose-600">− {formatARS(d.total)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 mt-1 border-t border-border tabular-nums font-medium">
              <span className="text-xs uppercase tracking-wider">Total</span>
              <span className="text-rose-600">
                − {formatARS(totals.descuentos)}
              </span>
            </div>
          </div>
        </section>
      )}

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-3 w-28">Fecha</th>
              {multiSucursal && (
                <th className="text-left font-medium px-3 py-3 w-32">Sucursal</th>
              )}
              <th className="text-left font-medium px-3 py-3">Cliente</th>
              <th className="text-left font-medium px-3 py-3">Servicios</th>
              <th className="text-right font-medium px-3 py-3 w-24">Total</th>
              <th className="text-right font-medium px-3 py-3 w-28">Comisión</th>
              <th className="text-right font-medium px-3 py-3 w-28">Insumos</th>
              <th className="text-right font-medium px-3 py-3 w-24">Neto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ingresos.length === 0 ? (
              <tr>
                <td
                  colSpan={multiSucursal ? 8 : 7}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  No hay ventas para los filtros aplicados.
                </td>
              </tr>
            ) : (
              ingresos.map((row) => {
                const empleadasUnicas = Array.from(
                  new Set(
                    row.lineas
                      .map((l) => l.empleado?.nombre)
                      .filter(Boolean) as string[],
                  ),
                );
                return (
                  <tr key={row.ingreso.id} className="hover:bg-cream/30">
                    <td className="px-3 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(row.ingreso.fecha).toLocaleDateString(
                        "es-AR",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        },
                      )}
                    </td>
                    {multiSucursal && (
                      <td className="px-3 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                        {sucursalNombreById.get(row.ingreso.sucursal_id) ?? "—"}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      {row.cliente?.nombre ?? (
                        <span className="text-muted-foreground italic">
                          sin cliente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      <div className="text-xs">
                        {row.lineas
                          .map((l) => l.servicio?.nombre)
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                      {empleadasUnicas.length > 0 && (
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">
                          por {empleadasUnicas.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium">
                      {formatARS(row.breakdown.total)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(row.breakdown.comisiones)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(row.breakdown.costoInsumos)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums font-medium ${
                        row.breakdown.neto >= 0
                          ? "text-sage-700"
                          : "text-rose-600"
                      }`}
                    >
                      {formatARS(row.breakdown.neto)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {ingresos.length > 0 && (
            <tfoot className="bg-cream/30 text-xs uppercase tracking-wider">
              <tr className="border-t-2 border-border">
                <td
                  className="px-3 py-3 font-semibold"
                  colSpan={multiSucursal ? 4 : 3}
                >
                  Totales
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {formatARS(totals.total)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {formatARS(totals.comisiones)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {formatARS(totals.costoInsumos)}
                </td>
                <td
                  className={`px-3 py-3 text-right tabular-nums font-semibold ${
                    totals.neto >= 0 ? "text-sage-700" : "text-rose-600"
                  }`}
                >
                  {formatARS(totals.neto)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "sage" | "danger";
}) {
  const color =
    accent === "sage"
      ? "text-sage-700"
      : accent === "danger"
        ? "text-rose-600"
        : "";
  return (
    <div className="bg-card border border-border rounded-md p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`font-display text-xl mt-1 tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
