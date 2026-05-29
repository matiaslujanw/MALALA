import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { NuevaVentaForm } from "@/components/forms/nueva-venta-form";
import { listClientes } from "@/lib/data/clientes";
import { listEmpleados } from "@/lib/data/empleados";
import { listInsumosVendibles } from "@/lib/data/insumos";
import { listMediosPago } from "@/lib/data/medios-pago";
import { listServicios } from "@/lib/data/servicios";
import { listMotivosDescuento } from "@/lib/data/motivos-descuento";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";

export default async function NuevaVentaPage() {
  await requireUser();
  const sucursal = await getActiveSucursal();
  if (!sucursal) redirect("/dev/login");

  const [clientes, servicios, empleados, mediosPago, productos, motivosDescuento] =
    await Promise.all([
      listClientes(),
      listServicios(),
      listEmpleados(),
      listMediosPago({ sucursalId: sucursal.id, soloActivos: true }),
      listInsumosVendibles(),
      listMotivosDescuento(),
    ]);

  const mediosActivos = mediosPago;

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="space-y-2">
        <Link
          href="/ventas"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3 stroke-[1.5]" />
          Volver a ingresos
        </Link>
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Nueva venta
        </h1>
        <p className="text-sm text-muted-foreground">
          {sucursal.nombre} · El stock se descuenta automáticamente al guardar
        </p>
      </header>

      <NuevaVentaForm
        sucursalId={sucursal.id}
        sucursalNombre={sucursal.nombre}
        clientes={clientes}
        servicios={servicios}
        empleados={empleados}
        mediosPago={mediosActivos}
        productos={productos}
        motivosDescuento={motivosDescuento.filter((m) => m.activo)}
      />
    </div>
  );
}
