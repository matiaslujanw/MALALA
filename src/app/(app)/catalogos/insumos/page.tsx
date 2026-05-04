import Link from "next/link";
import { Plus } from "lucide-react";
import { listInsumos } from "@/lib/data/insumos";
import { listProveedores } from "@/lib/data/proveedores";
import { requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";

const UNIDAD_LABEL: Record<string, string> = {
  ud: "ud",
  ml: "ml",
  g: "g",
  aplicacion: "apl.",
};

export default async function InsumosPage() {
  const user = await requireUser();
  const insumos = await listInsumos({ incluirInactivos: true });
  const proveedores = await listProveedores();
  const provMap = new Map(proveedores.map((p) => [p.id, p.nombre]));

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Insumos
          </h1>
          <p className="text-sm text-muted-foreground">
            {insumos.length} insumos · catálogo compartido
          </p>
        </div>
        {user.rol === "admin" && (
          <Link
            href="/catalogos/insumos/nuevo"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4 stroke-[1.5]" />
            Nuevo
          </Link>
        )}
      </header>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Nombre</th>
              <th className="text-left font-medium px-4 py-3">Proveedor</th>
              <th className="text-right font-medium px-4 py-3">Envase</th>
              <th className="text-right font-medium px-4 py-3">$ envase</th>
              <th className="text-right font-medium px-4 py-3">$ unitario</th>
              <th className="text-right font-medium px-4 py-3">Umbral</th>
              <th className="text-center font-medium px-4 py-3">Estado</th>
              {user.rol === "admin" && <th className="px-4 py-3 w-20"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {insumos.map((i) => (
              <tr key={i.id} className="hover:bg-cream/30">
                <td className="px-4 py-3 font-medium">{i.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {i.proveedor_id ? provMap.get(i.proveedor_id) ?? "—" : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {i.tamano_envase} {UNIDAD_LABEL[i.unidad_medida]}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatARS(i.precio_envase)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {i.precio_unitario != null
                    ? formatARS(i.precio_unitario)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {i.umbral_stock_bajo}
                </td>
                <td className="px-4 py-3 text-center">
                  {i.activo ? (
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
                      href={`/catalogos/insumos/${i.id}`}
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
    </div>
  );
}
