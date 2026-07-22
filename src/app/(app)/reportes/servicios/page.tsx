import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { buildAccessScope } from "@/lib/auth/access";
import { listIngresos } from "@/lib/data/ingresos";
import { listSucursales } from "@/lib/data/sucursales";
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

interface AggServicio {
  servicioId: string;
  nombre: string;
  rubro: string;
  cantidad: number;
  facturado: number;
  comisiones: number;
  costoInsumos: number;
  neto: number;
}

export default async function ReportesServiciosPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (!scope.puedeVerReportes) redirect("/dashboard");

  const sp = await searchParams;
  const filtros = parseReporteFiltros(sp, scope);

  const sucursalesAll = await listSucursales({ soloActivas: true });
  const sucursales = sucursalesAll.filter((s) =>
    scope.sucursalIdsPermitidas.includes(s.id),
  );

  const ingresos = await listIngresos({
    sucursalId: filtros.sucursalId,
    desde: filtros.desdeIso,
    hasta: filtros.hastaIso,
  });

  // Agrupar por servicio
  const acc = new Map<string, AggServicio>();
  for (const row of ingresos) {
    for (const linea of row.lineas) {
      if (!linea.servicio) continue;
      const entry = acc.get(linea.servicio.id) ?? {
        servicioId: linea.servicio.id,
        nombre: linea.servicio.nombre,
        rubro: linea.servicio.rubro,
        cantidad: 0,
        facturado: 0,
        comisiones: 0,
        costoInsumos: 0,
        neto: 0,
      };
      entry.cantidad += linea.cantidad;
      entry.facturado += linea.subtotal;
      entry.comisiones += linea.comision_monto;
      entry.costoInsumos += linea.costoInsumos;
      entry.neto = entry.facturado - entry.comisiones - entry.costoInsumos;
      acc.set(linea.servicio.id, entry);
    }
  }

  const filas = Array.from(acc.values()).sort((a, b) => b.facturado - a.facturado);
  const totales = filas.reduce(
    (a, f) => ({
      cantidad: a.cantidad + f.cantidad,
      facturado: a.facturado + f.facturado,
      comisiones: a.comisiones + f.comisiones,
      costoInsumos: a.costoInsumos + f.costoInsumos,
      neto: a.neto + f.neto,
    }),
    { cantidad: 0, facturado: 0, comisiones: 0, costoInsumos: 0, neto: 0 },
  );

  // Top y servicios que pierden
  const perdedores = filas.filter((f) => f.neto < 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Rentabilidad por servicio
        </h1>
        <p className="text-sm text-muted-foreground">
          {filtros.desde} → {filtros.hasta} · {filas.length} servicio
          {filas.length !== 1 ? "s" : ""} con ventas
        </p>
      </header>

      <ReporteFiltroForm
        action="/reportes/servicios"
        filtros={filtros}
        sucursales={sucursales}
      />

      {perdedores.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-4 text-sm text-destructive">
          <p className="font-medium">
            {perdedores.length} servicio{perdedores.length !== 1 ? "s" : ""} con
            margen negativo:
          </p>
          <p className="mt-1 text-destructive/80">
            {perdedores.map((p) => p.nombre).join(", ")}. Revisá los precios o
            las recetas técnicas.
          </p>
        </div>
      )}

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-3">Servicio</th>
              <th className="text-left font-medium px-3 py-3 w-32">Rubro</th>
              <th className="text-right font-medium px-3 py-3 w-20">Cant.</th>
              <th className="text-right font-medium px-3 py-3 w-28">Facturado</th>
              <th className="text-right font-medium px-3 py-3 w-24">
                Precio prom.
              </th>
              <th className="text-right font-medium px-3 py-3 w-28">Comisión</th>
              <th className="text-right font-medium px-3 py-3 w-28">Insumos</th>
              <th className="text-right font-medium px-3 py-3 w-28">Neto</th>
              <th className="text-right font-medium px-3 py-3 w-20">Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filas.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  No hay ventas en el período.
                </td>
              </tr>
            ) : (
              filas.map((f) => {
                const precioProm = f.cantidad > 0 ? f.facturado / f.cantidad : 0;
                const margenPct =
                  f.facturado > 0 ? (f.neto / f.facturado) * 100 : 0;
                return (
                  <tr key={f.servicioId} className="hover:bg-cream/30">
                    <td className="px-3 py-3 font-medium">{f.nombre}</td>
                    <td className="px-3 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                      {f.rubro}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {f.cantidad}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatARS(f.facturado)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(precioProm)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(f.comisiones)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(f.costoInsumos)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums font-medium ${
                        f.neto >= 0 ? "text-sage-700" : "text-destructive"
                      }`}
                    >
                      {formatARS(f.neto)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums text-xs ${
                        margenPct >= 30
                          ? "text-sage-700"
                          : margenPct >= 0
                            ? "text-muted-foreground"
                            : "text-destructive"
                      }`}
                    >
                      {margenPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot className="bg-cream/30 text-xs uppercase tracking-wider">
              <tr className="border-t-2 border-border">
                <td className="px-3 py-3 font-semibold" colSpan={2}>
                  Totales
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {totales.cantidad}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {formatARS(totales.facturado)}
                </td>
                <td />
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {formatARS(totales.comisiones)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {formatARS(totales.costoInsumos)}
                </td>
                <td
                  className={`px-3 py-3 text-right tabular-nums font-semibold ${
                    totales.neto >= 0 ? "text-sage-700" : "text-destructive"
                  }`}
                >
                  {formatARS(totales.neto)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-xs">
                  {totales.facturado > 0
                    ? ((totales.neto / totales.facturado) * 100).toFixed(1) + "%"
                    : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Tip: el margen se calcula sobre las ventas reales del período. Si un
        servicio no tiene receta cargada, el costo de insumos figura como 0 (no
        significa que no consuma, sino que no está modelado).
      </p>
    </div>
  );
}
