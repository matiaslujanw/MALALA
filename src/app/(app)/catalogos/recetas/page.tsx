import Link from "next/link";
import { listRecetasResumen } from "@/lib/data/recetas";
import { requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";

export default async function RecetasPage() {
  await requireUser();
  const resumen = await listRecetasResumen();

  // Agrupar por rubro
  const grupos = resumen.reduce<Record<string, typeof resumen>>((acc, r) => {
    (acc[r.servicio.rubro] ??= []).push(r);
    return acc;
  }, {});

  const sinReceta = resumen.filter((r) => r.cantidadInsumos === 0).length;

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Recetas
        </h1>
        <p className="text-sm text-muted-foreground">
          {resumen.length} servicios · {sinReceta} sin receta cargada
        </p>
      </header>

      <div className="space-y-6">
        {Object.entries(grupos).map(([rubro, items]) => (
          <section key={rubro} className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              {rubro}
            </h2>
            <div className="bg-card border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">
                      Servicio
                    </th>
                    <th className="text-right font-medium px-4 py-3">
                      Insumos
                    </th>
                    <th className="text-right font-medium px-4 py-3">
                      Costo total
                    </th>
                    <th className="text-right font-medium px-4 py-3">
                      Precio efectivo
                    </th>
                    <th className="text-right font-medium px-4 py-3">Margen</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(({ servicio, cantidadInsumos, costoTotal }) => {
                    const margen = servicio.precio_efectivo - costoTotal;
                    const margenPct =
                      servicio.precio_efectivo > 0
                        ? (margen / servicio.precio_efectivo) * 100
                        : 0;
                    return (
                      <tr key={servicio.id} className="hover:bg-cream/30">
                        <td className="px-4 py-3 font-medium">
                          {servicio.nombre}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {cantidadInsumos === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : (
                            cantidadInsumos
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {cantidadInsumos === 0
                            ? "—"
                            : formatARS(costoTotal)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatARS(servicio.precio_efectivo)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {cantidadInsumos === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              style={{
                                color:
                                  margen >= 0
                                    ? "var(--sage-700)"
                                    : "var(--danger)",
                              }}
                            >
                              {formatARS(margen)} ({margenPct.toFixed(0)}%)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/catalogos/recetas/${servicio.id}`}
                            className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900"
                          >
                            {cantidadInsumos === 0 ? "Cargar" : "Editar"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
