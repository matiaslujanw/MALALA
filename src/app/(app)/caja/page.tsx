import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import {
  getResumenDelDia,
  listCierres,
  getCierreDeFecha,
} from "@/lib/data/caja";
import { formatARS } from "@/lib/utils";

function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function CajaPage() {
  const user = await requireUser();
  const sucursal = await getActiveSucursal();
  if (!sucursal) redirect("/dev/login");

  const hoy = todayYMD();
  const [resumen, cierres, cierreHoy] = await Promise.all([
    getResumenDelDia(sucursal.id, hoy),
    listCierres({ sucursalId: sucursal.id, limit: 30 }),
    getCierreDeFecha(sucursal.id, hoy),
  ]);

  const puedeCerrar = user.rol === "admin" || user.rol === "encargada";

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Caja
          </h1>
          <p className="text-sm text-muted-foreground">
            {sucursal.nombre} · Cierre diario por sucursal
          </p>
        </div>

        {puedeCerrar && !cierreHoy && (
          <Link
            href="/caja/nuevo"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4 stroke-[1.5]" />
            Cerrar caja de hoy
          </Link>
        )}
        {cierreHoy && (
          <Link
            href={`/caja/${cierreHoy.id}`}
            className="px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider border border-border hover:bg-cream transition-colors"
          >
            Ver cierre de hoy
          </Link>
        )}
      </header>

      {/* Estado del día */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Movimientos de hoy
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Efectivo (neto)" value={formatARS(resumen.ef.neto)} />
          <Kpi label="Transferencia" value={formatARS(resumen.tr.neto)} />
          <Kpi label="Tarjeta crédito" value={formatARS(resumen.tc.ingresos)} />
          <Kpi label="Tarjeta débito" value={formatARS(resumen.td.ingresos)} />
        </div>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Medio</th>
                <th className="text-right font-medium px-4 py-3">Ingresos</th>
                <th className="text-right font-medium px-4 py-3">Egresos</th>
                <th className="text-right font-medium px-4 py-3">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {resumen.porMp.map((row) => (
                <tr key={row.mp.id}>
                  <td className="px-4 py-3 font-medium">
                    {row.mp.nombre}
                    <span className="text-xs text-muted-foreground ml-1">
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
                    className="px-4 py-3 text-right tabular-nums font-medium"
                    style={{
                      color:
                        row.neto >= 0 ? "var(--ink)" : "var(--danger)",
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
          {resumen.cantIngresos} ticket
          {resumen.cantIngresos !== 1 ? "s" : ""} · {resumen.cantEgresos} egreso
          {resumen.cantEgresos !== 1 ? "s" : ""} hoy.
        </p>
      </section>

      {/* Historial */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Cierres anteriores
        </h2>
        {cierres.length === 0 ? (
          <div className="bg-card border border-border rounded-md p-8 text-center text-sm text-muted-foreground">
            Todavía no hay cierres registrados.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Fecha</th>
                  <th className="text-left font-medium px-4 py-3">Cerrado por</th>
                  <th className="text-right font-medium px-4 py-3">EF esperado</th>
                  <th className="text-right font-medium px-4 py-3">EF contado</th>
                  <th className="text-right font-medium px-4 py-3">Diferencia</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cierres.map((c) => (
                  <tr key={c.cierre.id} className="hover:bg-cream/30">
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {c.cierre.fecha}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.cerrado_por_nombre}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(c.efectivoEsperado)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatARS(c.efectivoContado)}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums font-medium"
                      style={{
                        color:
                          c.diferenciaEf === 0
                            ? "var(--sage-700)"
                            : c.diferenciaEf > 0
                              ? "var(--ink)"
                              : "var(--danger)",
                      }}
                    >
                      {formatARS(c.diferenciaEf)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/caja/${c.cierre.id}`}
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
    <div className="bg-card border border-border rounded-md p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-2xl mt-2 tabular-nums">{value}</p>
    </div>
  );
}
