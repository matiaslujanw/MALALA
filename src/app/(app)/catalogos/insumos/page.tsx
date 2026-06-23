import Link from "next/link";
import { Plus } from "lucide-react";
import { listInsumos } from "@/lib/data/insumos";
import { listMediosPago } from "@/lib/data/medios-pago";
import { listProveedores } from "@/lib/data/proveedores";
import { listSucursales } from "@/lib/data/sucursales";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";
import { RegistrarCompraInsumoModal } from "@/components/forms/registrar-compra-insumo-modal";

const UNIDAD_LABEL: Record<string, string> = {
  ud: "ud",
  ml: "ml",
  g: "g",
  aplicacion: "apl.",
};

export default async function InsumosPage() {
  const user = await requireUser();
  const sucursalActiva = await getActiveSucursal();
  const [insumos, proveedores, sucursales, mediosPago] = await Promise.all([
    listInsumos({ incluirInactivos: true, sucursalId: sucursalActiva?.id }),
    listProveedores(),
    listSucursales({ soloActivas: true }),
    listMediosPago({ soloActivos: true }),
  ]);
  const provMap = new Map(proveedores.map((p) => [p.id, p]));
  const puedeCargarCompra = user.rol === "admin" || user.rol === "encargada";

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Insumos
          </h1>
          <p className="text-sm text-muted-foreground">
            {insumos.length} insumos · {sucursalActiva?.nombre ?? "sucursal"}
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
              <th className="text-right font-medium px-4 py-3">Umbral</th>
              <th className="text-center font-medium px-4 py-3">Estado</th>
              <th className="px-4 py-3 w-48 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {insumos.map((i) => {
              const proveedoresDelInsumo = (i.proveedor_ids ?? [])
                .map((id) => provMap.get(id))
                .filter((p): p is NonNullable<typeof p> => p != null);
              return (
                <tr key={i.id} className="hover:bg-cream/30">
                  <td className="px-4 py-3 font-medium">{i.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {proveedoresDelInsumo.length > 0
                      ? proveedoresDelInsumo.map((p) => p.nombre).join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {i.tamano_envase} {UNIDAD_LABEL[i.unidad_medida]}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatARS(i.precio_envase)}
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
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {puedeCargarCompra &&
                        i.activo &&
                        sucursalActiva &&
                        sucursales.length > 0 && (
                          <RegistrarCompraInsumoModal
                            insumo={i}
                            proveedores={proveedoresDelInsumo}
                            sucursales={sucursales}
                            mediosPago={mediosPago}
                            defaultSucursalId={sucursalActiva.id}
                          />
                        )}
                      {user.rol === "admin" && (
                        <Link
                          href={`/catalogos/insumos/${i.id}`}
                          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                        >
                          Editar
                        </Link>
                      )}
                    </div>
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
