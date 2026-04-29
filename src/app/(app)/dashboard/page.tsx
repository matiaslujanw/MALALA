import { getActiveSucursal, requireUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await requireUser();
  const sucursal = await getActiveSucursal();

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Hola {user.nombre} · {sucursal?.nombre}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-md p-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Ventas del día
          </p>
          <p className="font-display text-3xl mt-2 tabular-nums">$ 0</p>
          <p className="text-xs text-muted-foreground mt-1">Sin datos aún</p>
        </div>
        <div className="bg-card border border-border rounded-md p-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Tickets
          </p>
          <p className="font-display text-3xl mt-2 tabular-nums">0</p>
          <p className="text-xs text-muted-foreground mt-1">{sucursal?.nombre}</p>
        </div>
        <div className="bg-card border border-border rounded-md p-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Stock bajo
          </p>
          <p className="font-display text-3xl mt-2 tabular-nums">—</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pendiente cargar
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-md p-6">
        <p className="text-sm text-muted-foreground">
          Esta es la base. Próximos pasos: catálogos completos → stock → ventas.
        </p>
      </div>
    </div>
  );
}
