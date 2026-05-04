import Link from "next/link";
import { Plus } from "lucide-react";
import { listEmpleados } from "@/lib/data/empleados";
import { listSucursales } from "@/lib/data/sucursales";
import { requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";

const TIPO_LABEL: Record<string, string> = {
  porcentaje: "Porcentaje",
  mixto: "Mixto",
  sueldo_fijo: "Sueldo fijo",
};

export default async function EmpleadosPage() {
  const user = await requireUser();
  const empleados = await listEmpleados({ incluirInactivos: true });
  const sucursales = await listSucursales();
  const sucMap = new Map(sucursales.map((s) => [s.id, s.nombre]));

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
            Empleados
          </h1>
          <p className="text-sm text-muted-foreground">
            {empleados.length} empleados
          </p>
        </div>
        {user.rol === "admin" && (
          <Link
            href="/catalogos/empleados/nuevo"
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
              <th className="text-left font-medium px-4 py-3">Sucursal</th>
              <th className="text-left font-medium px-4 py-3">Comisión</th>
              <th className="text-right font-medium px-4 py-3">% default</th>
              <th className="text-right font-medium px-4 py-3">Asegurado</th>
              <th className="text-center font-medium px-4 py-3">Estado</th>
              {user.rol === "admin" && <th className="px-4 py-3 w-20"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {empleados.map((e) => (
              <tr key={e.id} className="hover:bg-cream/30">
                <td className="px-4 py-3 font-medium">{e.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sucMap.get(e.sucursal_principal_id) ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {TIPO_LABEL[e.tipo_comision]}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {e.porcentaje_default}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatARS(e.sueldo_asegurado)}
                </td>
                <td className="px-4 py-3 text-center">
                  {e.activo ? (
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
                      href={`/catalogos/empleados/${e.id}`}
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
