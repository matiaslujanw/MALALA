import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { buildAccessScope } from "@/lib/auth/access";
import { listIngresos } from "@/lib/data/ingresos";
import { listSucursales } from "@/lib/data/sucursales";
import { listEmpleados } from "@/lib/data/empleados";
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

interface AggEmpleada {
  empleadoId: string;
  nombre: string;
  servicios: number;
  facturado: number;
  comisiones: number;
  costoInsumos: number;
  netoNegocio: number;
}

export default async function ReportesEmpleadasPage({
  searchParams,
}: PageProps) {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (!scope.puedeVerReportes) redirect("/dashboard");

  const sp = await searchParams;
  const filtros = parseReporteFiltros(sp, scope);

  const [sucursalesAll, empleadosAll, ingresos] = await Promise.all([
    listSucursales({ soloActivas: true }),
    listEmpleados(),
    listIngresos({
      sucursalId: filtros.sucursalId,
      desde: filtros.desdeIso,
      hasta: filtros.hastaIso,
    }),
  ]);

  const sucursales = sucursalesAll.filter((s) =>
    scope.sucursalIdsPermitidas.includes(s.id),
  );
  const empleados = empleadosAll.filter((e) =>
    scope.sucursalIdsPermitidas.includes(e.sucursal_principal_id),
  );
  const empleadoById = new Map(empleados.map((e) => [e.id, e]));

  // Agrupar
  const acc = new Map<string, AggEmpleada>();
  for (const row of ingresos) {
    for (const linea of row.lineas) {
      if (!linea.empleado) continue;
      const empleado = empleadoById.get(linea.empleado.id);
      if (!empleado) continue;
      const entry = acc.get(empleado.id) ?? {
        empleadoId: empleado.id,
        nombre: empleado.nombre,
        servicios: 0,
        facturado: 0,
        comisiones: 0,
        costoInsumos: 0,
        netoNegocio: 0,
      };
      entry.servicios += linea.cantidad;
      entry.facturado += linea.subtotal;
      entry.comisiones += linea.comision_monto;
      entry.costoInsumos += linea.costoInsumos;
      entry.netoNegocio =
        entry.facturado - entry.comisiones - entry.costoInsumos;
      acc.set(empleado.id, entry);
    }
  }

  const filas = Array.from(acc.values()).sort((a, b) => b.facturado - a.facturado);
  const totales = filas.reduce(
    (a, f) => ({
      servicios: a.servicios + f.servicios,
      facturado: a.facturado + f.facturado,
      comisiones: a.comisiones + f.comisiones,
      costoInsumos: a.costoInsumos + f.costoInsumos,
      netoNegocio: a.netoNegocio + f.netoNegocio,
    }),
    {
      servicios: 0,
      facturado: 0,
      comisiones: 0,
      costoInsumos: 0,
      netoNegocio: 0,
    },
  );

  const backQs = new URLSearchParams({
    desde: filtros.desde,
    hasta: filtros.hasta,
    ...(filtros.sucursalId ? { sucursal: filtros.sucursalId } : {}),
  }).toString();

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="space-y-2">
        <Link
          href={`/reportes?${backQs}`}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3 stroke-[1.5]" />
          Volver a reportes
        </Link>
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Rendimiento por empleada
        </h1>
        <p className="text-sm text-muted-foreground">
          {filtros.desde} → {filtros.hasta} · {filas.length} empleada
          {filas.length !== 1 ? "s" : ""} con servicios cargados
        </p>
      </header>

      <ReporteFiltroForm
        action="/reportes/empleadas"
        filtros={filtros}
        sucursales={sucursales}
      />

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-3">Empleada</th>
              <th className="text-right font-medium px-3 py-3 w-24">
                Servicios
              </th>
              <th className="text-right font-medium px-3 py-3 w-28">Facturado</th>
              <th className="text-right font-medium px-3 py-3 w-28">
                Comisiones
              </th>
              <th className="text-right font-medium px-3 py-3 w-28">
                Neto negocio
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filas.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  Sin servicios cargados a empleadas en el período.
                </td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr key={f.empleadoId} className="hover:bg-cream/30">
                  <td className="px-3 py-3 font-medium">{f.nombre}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {f.servicios}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatARS(f.facturado)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatARS(f.comisiones)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right tabular-nums font-medium ${
                      f.netoNegocio >= 0 ? "text-sage-700" : "text-rose-600"
                    }`}
                  >
                    {formatARS(f.netoNegocio)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot className="bg-cream/30 text-xs uppercase tracking-wider">
              <tr className="border-t-2 border-border">
                <td className="px-3 py-3 font-semibold">Totales</td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {totales.servicios}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {formatARS(totales.facturado)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {formatARS(totales.comisiones)}
                </td>
                <td
                  className={`px-3 py-3 text-right tabular-nums font-semibold ${
                    totales.netoNegocio >= 0 ? "text-sage-700" : "text-rose-600"
                  }`}
                >
                  {formatARS(totales.netoNegocio)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Tip: <strong>Neto negocio</strong> = facturado − comisión − costo insumos
        (es lo que le queda al negocio antes de gastos generales). El sueldo por
        horas y los anticipos se ven en cada liquidación.
      </p>
    </div>
  );
}
