import { redirect } from "next/navigation";
import { InsumoForm } from "@/components/forms/insumo-form";
import { createInsumo } from "@/lib/data/insumos";
import { listMediosPago } from "@/lib/data/medios-pago";
import { listProveedores } from "@/lib/data/proveedores";
import { listSucursales } from "@/lib/data/sucursales";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";

export default async function NuevoInsumoPage() {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/catalogos/insumos");
  const [proveedores, sucursales, mediosPago, sucursalActiva] =
    await Promise.all([
      listProveedores(),
      listSucursales({ soloActivas: true }),
      listMediosPago({ soloActivos: true }),
      getActiveSucursal(),
    ]);

  async function action(_prev: unknown, formData: FormData) {
    "use server";
    return await createInsumo(formData);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Nuevo insumo
        </h1>
      </header>
      <InsumoForm
        proveedores={proveedores}
        sucursales={sucursales}
        mediosPago={mediosPago}
        defaultSucursalId={sucursalActiva?.id}
        action={action}
        submitLabel="Crear"
      />
    </div>
  );
}
