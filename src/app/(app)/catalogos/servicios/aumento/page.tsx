import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { buildAccessScope } from "@/lib/auth/access";
import { previewAumentoServicios } from "@/lib/data/servicios-aumento";
import { AumentoForm } from "./aumento-form";

export default async function AumentoServiciosPage() {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  // Cambiar precios es estructura del catálogo: sólo admin, igual que crear o
  // editar un servicio.
  if (!scope.esAdmin) redirect("/catalogos/servicios");

  // Se pide un preview con un porcentaje cualquiera sólo para traer la lista de
  // rubros con sus conteos; no aplica nada.
  const base = await previewAumentoServicios({ pct: 1 });
  const rubros = base.ok ? base.rubros : [];

  return (
    <div className="space-y-8 max-w-5xl">
      <Link
        href="/catalogos/servicios"
        className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
        Servicios
      </Link>

      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Aumento masivo
        </h1>
        <p className="text-sm text-muted-foreground">
          Sube o baja un porcentaje los precios de los servicios de la sucursal
          activa. Los dos precios —lista y efectivo— se mueven por el mismo
          porcentaje, así cada servicio conserva su descuento, y quedan
          redondeados a $100.
        </p>
      </header>

      <AumentoForm rubros={rubros} />
    </div>
  );
}
