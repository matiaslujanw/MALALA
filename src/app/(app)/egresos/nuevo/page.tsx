import { redirect } from "next/navigation";
import { EgresoForm } from "@/components/forms/egreso-form";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { listRubrosGasto } from "@/lib/data/rubros-gasto";
import { listProveedores } from "@/lib/data/proveedores";
import { listMediosPago } from "@/lib/data/medios-pago";
import { listSucursales } from "@/lib/data/sucursales";
import { listInsumos } from "@/lib/data/insumos";
import { createEgreso } from "@/lib/data/egresos";
import { registrarCompraInsumo } from "@/lib/data/insumos";

function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function NuevoEgresoPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedor?: string; compra?: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "admin" && user.rol !== "encargada") redirect("/egresos");

  const sucursal = await getActiveSucursal();
  if (!sucursal) redirect("/dev/login");

  const sp = await searchParams;
  const defaultProveedorId = sp.proveedor;
  const defaultEsCompra = sp.compra === "1";

  const [sucursales, rubros, proveedores, mediosPago, insumos] = await Promise.all([
    listSucursales(),
    listRubrosGasto(),
    listProveedores(),
    listMediosPago({ soloActivos: true }),
    listInsumos(),
  ]);
  const mediosActivos = mediosPago;

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Nuevo gasto
        </h1>
        <p className="text-sm text-muted-foreground">
          Sueldos, alquiler, servicios y demás gastos. Si es una compra de
          insumos, tildá <strong>&ldquo;Es compra de insumo&rdquo;</strong> y se
          suma al stock automáticamente.
        </p>
      </header>

      <EgresoForm
        sucursales={sucursales.filter((s) => s.activo)}
        defaultSucursalId={sucursal.id}
        rubros={rubros}
        proveedores={proveedores}
        mediosPago={mediosActivos}
        insumos={insumos}
        defaultFecha={todayYMD()}
        defaultProveedorId={defaultProveedorId}
        defaultEsCompraInsumo={defaultEsCompra}
        action={createEgreso}
        compraAction={registrarCompraInsumo}
      />
    </div>
  );
}
