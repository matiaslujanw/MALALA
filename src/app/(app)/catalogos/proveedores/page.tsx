import Link from "next/link";
import { Plus } from "lucide-react";
import { listProveedores } from "@/lib/data/proveedores";
import { requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";

export default async function ProveedoresPage() {
  await requireUser();
  const proveedores = await listProveedores();

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Proveedores
          </h1>
          <p className="text-sm text-muted-foreground">
            {proveedores.length} proveedores
          </p>
        </div>
        <Link
          href="/catalogos/proveedores/nuevo"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4 stroke-[1.5]" />
          Nuevo
        </Link>
      </header>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Nombre</th>
              <th className="text-left font-medium px-4 py-3">Teléfono</th>
              <th className="text-left font-medium px-4 py-3">CUIT</th>
              <th className="text-right font-medium px-4 py-3">
                Deuda pendiente
              </th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {proveedores.map((p) => (
              <tr key={p.id} className="hover:bg-cream/30">
                <td className="px-4 py-3 font-medium">{p.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {p.telefono ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {p.cuit ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatARS(p.deuda_pendiente)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/catalogos/proveedores/${p.id}`}
                    className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
