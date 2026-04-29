import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { clampSucursalId, getAccessScope } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import {
  getCierreDeFecha,
  getResumenDelDia,
  listCierres,
} from "@/lib/data/caja";
import { listSucursales } from "@/lib/data/sucursales";
import { formatARS } from "@/lib/utils";

interface SearchParams {
  sucursal?: string;
}

function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [user, scope, sp, sucursales] = await Promise.all([
    requireUser(),
    getAccessScope(),
    searchParams,
    listSucursales({ soloActivas: true }),
  ]);

  if (!scope?.puedeVerCaja) {
    redirect("/dashboard");
  }

  const sucursalId = clampSucursalId(scope, sp.sucursal);
  const sucursal =
    sucursales.find((item) => item.id === sucursalId) ??
    sucursales.find((item) => scope.sucursalIdsPermitidas.includes(item.id)) ??
    null;

  if (!sucursal) {
    redirect("/dashboard");
  }

  const hoy = todayYMD();
  const [resumen, cierres, cierreHoy] = await Promise.all([
    getResumenDelDia(sucursal.id, hoy),
    listCierres({ sucursalId: sucursal.id, limit: 30 }),
    getCierreDeFecha(sucursal.id, hoy),
  ]);

  const puedeCerrar = user.rol === "admin" || user.rol === "encargada";

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Caja
          </h1>
          <p className="text-sm text-muted-foreground">
            {sucursal.nombre} · Cierre diario por sucursal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {scope.puedeVerGlobal ? (
            <form action="/caja" method="get" className="flex items-center gap-2">
              <select
                name="sucursal"
                defaultValue={sucursal.id}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                {sucursales
                  .filter((item) => scope.sucursalIdsPermitidas.includes(item.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-2 text-xs uppercase tracking-wider transition-colors hover:bg-cream"
              >
                Ver
              </button>
            </form>
          ) : null}

          {puedeCerrar && !cierreHoy ? (
            <Link
              href="/caja/nuevo"
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700"
            >
              <Plus className="h-4 w-4 stroke-[1.5]" />
              Cerrar caja de hoy
            </Link>
          ) : null}

          {cierreHoy ? (
            <Link
              href={`/caja/${cierreHoy.id}`}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium uppercase tracking-wider transition-colors hover:bg-cream"
            >
              Ver cierre de hoy
            </Link>
          ) : null}
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Movimientos de hoy
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Efectivo (neto)" value={formatARS(resumen.ef.neto)} />
          <Kpi label="Transferencia" value={formatARS(resumen.tr.neto)} />
          <Kpi label="Tarjeta credito" value={formatARS(resumen.tc.ingresos)} />
          <Kpi label="Tarjeta debito" value={formatARS(resumen.td.ingresos)} />
        </div>
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Medio</th>
                <th className="px-4 py-3 text-right font-medium">Ingresos</th>
                <th className="px-4 py-3 text-right font-medium">Egresos</th>
                <th className="px-4 py-3 text-right font-medium">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {resumen.porMp.map((row) => (
                <tr key={row.mp.id}>
                  <td className="px-4 py-3 font-medium">
                    {row.mp.nombre}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({row.mp.codigo})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatARS(row.ingresos)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatARS(row.egresos)}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-medium tabular-nums"
                    style={{
                      color: row.neto >= 0 ? "var(--ink)" : "var(--danger)",
                    }}
                  >
                    {formatARS(row.neto)}
                  </td>
                </tr>
              ))}
              <tr className="bg-cream/40 font-medium">
                <td className="px-4 py-3">Totales</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatARS(resumen.totalIngresos)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatARS(resumen.totalEgresos)}
                </td>
                <td
                  className="px-4 py-3 text-right tabular-nums"
                  style={{
                    color:
                      resumen.totalNeto >= 0
                        ? "var(--sage-700)"
                        : "var(--danger)",
                  }}
                >
                  {formatARS(resumen.totalNeto)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          {resumen.cantIngresos} ticket{resumen.cantIngresos !== 1 ? "s" : ""} ·{" "}
          {resumen.cantEgresos} egreso{resumen.cantEgresos !== 1 ? "s" : ""} hoy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Cierres anteriores
        </h2>
        {cierres.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Todavia no hay cierres registrados.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Cerrado por</th>
                  <th className="px-4 py-3 text-right font-medium">EF esperado</th>
                  <th className="px-4 py-3 text-right font-medium">EF contado</th>
                  <th className="px-4 py-3 text-right font-medium">Diferencia</th>
                  <th className="w-20 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cierres.map((item) => (
                  <tr key={item.cierre.id} className="hover:bg-cream/30">
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {item.cierre.fecha}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.cerrado_por_nombre}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(item.efectivoEsperado)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatARS(item.efectivoContado)}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-medium tabular-nums"
                      style={{
                        color:
                          item.diferenciaEf === 0
                            ? "var(--sage-700)"
                            : item.diferenciaEf > 0
                              ? "var(--ink)"
                              : "var(--danger)",
                      }}
                    >
                      {formatARS(item.diferenciaEf)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/caja/${item.cierre.id}`}
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}
