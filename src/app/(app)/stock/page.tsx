import Link from "next/link";
import { ArrowRightLeft, History, SlidersHorizontal } from "lucide-react";
import { listStockBySucursal } from "@/lib/data/stock";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";

const UNIDAD_LABEL: Record<string, string> = {
  ud: "ud",
  ml: "ml",
  g: "g",
  aplicacion: "apl.",
};

export default async function StockPage() {
  const user = await requireUser();
  const sucursal = await getActiveSucursal();
  if (!sucursal) return null;

  const rows = await listStockBySucursal(sucursal.id);
  const negativos = rows.filter((r) => r.estado === "negativo").length;
  const bajos = rows.filter((r) => r.estado === "bajo").length;

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Stock
          </h1>
          <p className="text-sm text-muted-foreground">
            {sucursal.nombre} · {rows.length} insumos · {negativos} negativos ·{" "}
            {bajos} bajos
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
          {user.rol === "admin" && (
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

      {/* Banner si hay alertas */}
      {(negativos > 0 || bajos > 0) && (
        <div
          className="bg-card border border-border rounded-md p-4 flex items-center gap-3"
          style={{ borderLeftWidth: 3, borderLeftColor: negativos > 0 ? "var(--danger)" : "var(--warning)" }}
        >
          <p className="text-sm">
            {negativos > 0 && (
              <span className="font-medium" style={{ color: "var(--danger)" }}>
                {negativos} insumo{negativos !== 1 ? "s" : ""} en stock negativo.{" "}
              </span>
            )}
            {bajos > 0 && (
              <span style={{ color: "var(--warning)" }}>
                {bajos} insumo{bajos !== 1 ? "s" : ""} por debajo del umbral.
              </span>
            )}
          </p>
        </div>
      )}

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

      <p className="text-xs text-muted-foreground">
        El stock se descuenta automáticamente al registrar ventas (próxima fase).
        Stock negativo se permite con warning — no bloquea operaciones.
      </p>
    </div>
  );
}
