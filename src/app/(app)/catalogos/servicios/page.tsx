import Link from "next/link";
import { Plus } from "lucide-react";
import { listServicios } from "@/lib/data/servicios";
import { requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";

export default async function ServiciosPage() {
  const user = await requireUser();
  const servicios = await listServicios({ incluirInactivos: true });

  // Agrupar por rubro
  const grupos = servicios.reduce<Record<string, typeof servicios>>(
    (acc, s) => {
      (acc[s.rubro] ??= []).push(s);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Servicios
          </h1>
          <p className="text-sm text-muted-foreground">
            Catálogo compartido entre sucursales · {servicios.length} servicios
          </p>
        </div>

        {user.rol === "admin" && (
          <Link
            href="/catalogos/servicios/nuevo"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4 stroke-[1.5]" />
            Nuevo
          </Link>
        )}
      </header>

      <div className="space-y-8">
        {Object.entries(grupos).map(([rubro, items]) => (
          <section key={rubro} className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              {rubro}
            </h2>
            <div className="bg-card border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Nombre</th>
                    <th className="text-right font-medium px-4 py-3">P. lista</th>
                    <th className="text-right font-medium px-4 py-3">P. efectivo</th>
                    <th className="text-right font-medium px-4 py-3">Comisión</th>
                    <th className="text-center font-medium px-4 py-3">Estado</th>
                    {user.rol === "admin" && (
                      <th className="px-4 py-3 w-20"></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((s) => (
                    <tr key={s.id} className="hover:bg-cream/30">
                      <td className="px-4 py-3">{s.nombre}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatARS(s.precio_lista)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatARS(s.precio_efectivo)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {s.comision_default_pct}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.activo ? (
                          <span className="bg-sage-100 text-sage-900 px-2 py-0.5 rounded text-xs">
                            Activo
                          </span>
                        ) : (
                          <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded text-xs">
                            Inactivo
                          </span>
                        )}
                      </td>
                      {user.rol === "admin" && (
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/catalogos/servicios/${s.id}`}
                            className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900"
                          >
                            Editar
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
