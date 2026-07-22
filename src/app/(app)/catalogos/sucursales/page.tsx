import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { buildAccessScope, esAdmin, isSucursalAllowed } from "@/lib/auth/access";
import { listSucursales } from "@/lib/data/sucursales";
import { listSucursalHorarios } from "@/lib/data/sucursales-horarios";

export default async function SucursalesHorariosPage() {
  const user = await requireUser();
  if (!esAdmin(user.rol) && user.rol !== "encargada") {
    redirect("/catalogos");
  }

  // Aislamiento: cada usuario solo ve y edita los horarios de sus sucursales.
  const scope = buildAccessScope(user);
  const sucursales = (await listSucursales()).filter((s) =>
    isSucursalAllowed(scope, s.id),
  );
  const conHorarios = await Promise.all(
    sucursales.map(async (s) => ({
      sucursal: s,
      franjas: (await listSucursalHorarios(s.id)).length,
    })),
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Horarios de sucursal
        </h1>
        <p className="text-sm text-muted-foreground">
          Días y franjas de atención de cada sede. Definen qué fechas y horas se
          ofrecen al reservar turnos online. Sin horarios cargados, la sucursal
          no ofrece turnos.
        </p>
      </header>

      <div className="space-y-3">
        {conHorarios.map(({ sucursal, franjas }) => (
          <Link
            key={sucursal.id}
            href={`/catalogos/sucursales/${sucursal.id}`}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:bg-cream/40"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {sucursal.nombre}
                {!sucursal.activo && (
                  <span className="ml-2 rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                    Inactiva
                  </span>
                )}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {franjas === 0 ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 stroke-[1.5] text-warning" />
                    <span className="text-warning">
                      Sin horarios cargados — no ofrece turnos
                    </span>
                  </>
                ) : (
                  <>
                    <Clock3 className="h-3.5 w-3.5 stroke-[1.5]" />
                    {franjas} {franjas === 1 ? "franja" : "franjas"} cargadas
                  </>
                )}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-sage-700">
              Editar
              <ArrowRight className="h-4 w-4 stroke-[1.5]" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
