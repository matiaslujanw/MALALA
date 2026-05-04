import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightLeft, History, SlidersHorizontal } from "lucide-react";
import { listStockBySucursal } from "@/lib/data/stock";
import { getAccessScopeForUser } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";
import { listSucursales } from "@/lib/data/sucursales";

const UNIDAD_LABEL: Record<string, string> = {
  ud: "ud",
  ml: "ml",
  g: "g",
  aplicacion: "apl.",
};

interface SearchParams {
  sucursal?: string;
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const scope = getAccessScopeForUser(user);
  if (!scope?.puedeVerStock) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const sucursalId =
    (sp.sucursal && scope.sucursalIdsPermitidas.includes(sp.sucursal)
      ? sp.sucursal
      : scope.sucursalIdsPermitidas[0]) ?? "";

  const rows = await listStockBySucursal(sucursalId);
  const sucursales = await listSucursales({ soloActivas: true });
  const negativos = rows.filter((r) => r.estado === "negativo").length;
  const bajos = rows.filter((r) => r.estado === "bajo").length;
  const totalValuado = rows.reduce((acc, row) => {
    const unit = row.insumo.precio_unitario ?? 0;
    return acc + Math.max(row.cantidad, 0) * unit;
  }, 0);

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Stock
          </h1>
          <p className="text-sm text-muted-foreground">
            {scope.puedeVerGlobal
              ? "Vista consolidable por sucursal"
              : "Control operativo de tu sucursal"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/stock/movimientos"
            className="border border-border px-3 py-2 rounded-md text-sm font-medium hover:bg-cream transition-colors flex items-center gap-2"
          >
            <History className="h-4 w-4 stroke-[1.5]" />
            Movimientos
          </Link>
          {scope.rol === "admin" && (
            <>
              <Link
                href="/stock/transferencia"
                className="border border-border px-3 py-2 rounded-md text-sm font-medium hover:bg-cream transition-colors flex items-center gap-2"
              >
                <ArrowRightLeft className="h-4 w-4 stroke-[1.5]" />
                Transferir
              </Link>
              <Link
                href="/stock/ajuste"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors flex items-center gap-2"
              >
                <SlidersHorizontal className="h-4 w-4 stroke-[1.5]" />
                Ajuste manual
              </Link>
            </>
          )}
        </div>
      </header>

      <form action="/stock" method="get" className="rounded-[1.5rem] border border-border bg-card p-4">
        <label className="space-y-1.5 text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Sucursal
          </span>
          <div className="flex gap-3">
            <select
              name="sucursal"
              defaultValue={sucursalId}
              className="w-full rounded-xl border border-border bg-card px-3 py-2"
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
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground"
            >
              Ver
            </button>
          </div>
        </label>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Valuacion estimada" value={formatARS(totalValuado)} />
        <SummaryCard label="Stock bajo" value={String(bajos)} tone="warning" />
        <SummaryCard label="Stock negativo" value={String(negativos)} tone="danger" />
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Insumo</th>
              <th className="text-right font-medium px-4 py-3">Stock</th>
              <th className="text-right font-medium px-4 py-3">Umbral</th>
              <th className="text-right font-medium px-4 py-3">$ unitario</th>
              <th className="text-right font-medium px-4 py-3">Valor total</th>
              <th className="text-center font-medium px-4 py-3 w-28">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ insumo, cantidad, estado }) => {
              const valor =
                insumo.precio_unitario != null
                  ? cantidad * insumo.precio_unitario
                  : null;
              return (
                <tr key={insumo.id} className="hover:bg-cream/30">
                  <td className="px-4 py-3 font-medium">{insumo.nombre}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {cantidad.toLocaleString("es-AR")} {UNIDAD_LABEL[insumo.unidad_medida]}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {insumo.umbral_stock_bajo}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {insumo.precio_unitario != null
                      ? formatARS(insumo.precio_unitario)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {valor != null ? formatARS(valor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {estado === "negativo" && (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: "rgb(168 74 61 / 0.12)",
                          color: "var(--danger)",
                        }}
                      >
                        Negativo
                      </span>
                    )}
                    {estado === "bajo" && (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: "rgb(201 169 97 / 0.15)",
                          color: "var(--warning)",
                        }}
                      >
                        Bajo
                      </span>
                    )}
                    {estado === "ok" && (
                      <span className="bg-sage-100 text-sage-900 px-2 py-0.5 rounded text-xs font-medium">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "danger";
}) {
  const className =
    tone === "danger"
      ? "border-[#f2c4bd] bg-[#fff1ef]"
      : tone === "warning"
        ? "border-[#f1ddab] bg-[#fff8e9]"
        : "border-border bg-card";
  return (
    <div className={`rounded-[1.4rem] border p-5 ${className}`}>
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
    </div>
  );
}
