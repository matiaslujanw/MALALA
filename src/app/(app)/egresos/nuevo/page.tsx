import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { EgresoForm } from "@/components/forms/egreso-form";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { listRubrosGasto } from "@/lib/data/rubros-gasto";
import { listInsumos } from "@/lib/data/insumos";
import { listProveedores } from "@/lib/data/proveedores";
import { listMediosPago } from "@/lib/data/medios-pago";
import { listSucursales } from "@/lib/data/sucursales";
import { createEgreso } from "@/lib/data/egresos";

function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function NuevoEgresoPage() {
  const user = await requireUser();
  if (user.rol !== "admin" && user.rol !== "encargada") redirect("/egresos");

  const sucursal = await getActiveSucursal();
  if (!sucursal) redirect("/dev/login");

  const [sucursales, rubros, insumos, proveedores, mediosPago] = await Promise.all([
    listSucursales(),
    listRubrosGasto(),
    listInsumos(),
    listProveedores(),
    listMediosPago(),
  ]);
  const mediosActivos = mediosPago.filter((m) => m.activo);

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-2">
        <Link
          href="/egresos"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3 stroke-[1.5]" />
          Volver a egresos
        </Link>
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Nuevo egreso
        </h1>
        <p className="text-sm text-muted-foreground">
          Si elegís rubro <em>Insumos</em> y vinculás un insumo, el stock se
          actualiza automáticamente.
        </p>
      </header>

      <EgresoForm
        sucursales={sucursales.filter((s) => s.activo)}
        defaultSucursalId={sucursal.id}
        rubros={rubros}
        insumos={insumos}
        proveedores={proveedores}
        mediosPago={mediosActivos}
        defaultFecha={todayYMD()}
        action={createEgreso}
      />
    </div>
  );
}
