/**
 * Formulario reutilizable de filtros para sub-reportes.
 * GET puro a la propia ruta. Server component.
 */
import type { Empleado, Sucursal } from "@/lib/types";
import type { ReporteFiltros } from "./_filters";

interface Props {
  action: string; // ruta a la que GET
  filtros: ReporteFiltros;
  sucursales: Sucursal[];
  empleados?: Empleado[];
  mostrarSucursal?: boolean;
  mostrarEmpleado?: boolean;
}

export function ReporteFiltroForm({
  action,
  filtros,
  sucursales,
  empleados,
  mostrarSucursal = true,
  mostrarEmpleado = false,
}: Props) {
  return (
    <form
      action={action}
      method="get"
      className="bg-card border border-border rounded-md p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
    >
      <label className="space-y-1.5 text-sm">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Desde
        </span>
        <input
          type="date"
          name="desde"
          defaultValue={filtros.desde}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
        />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Hasta
        </span>
        <input
          type="date"
          name="hasta"
          defaultValue={filtros.hasta}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
        />
      </label>
      {mostrarSucursal && sucursales.length > 1 && (
        <label className="space-y-1.5 text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Sucursal
          </span>
          <select
            name="sucursal"
            defaultValue={filtros.sucursalId ?? ""}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            <option value="">Todas</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {mostrarEmpleado && empleados && empleados.length > 0 && (
        <label className="space-y-1.5 text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Empleada
          </span>
          <select
            name="empleado"
            defaultValue={filtros.empleadoId ?? ""}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            <option value="">Todas</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors"
      >
        Aplicar
      </button>
    </form>
  );
}
