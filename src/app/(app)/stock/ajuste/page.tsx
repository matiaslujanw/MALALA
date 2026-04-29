import { redirect } from "next/navigation";
import { AjusteForm } from "@/components/forms/ajuste-form";
import { listInsumos } from "@/lib/data/insumos";
import { listSucursales } from "@/lib/data/sucursales";
import { createAjusteManual } from "@/lib/data/stock";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";

export default async function AjustePage() {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/stock");
  const sucursal = await getActiveSucursal();
  if (!sucursal) redirect("/stock");

  const [insumos, sucursales] = await Promise.all([
    listInsumos(),
    listSucursales(),
  ]);

  async function action(_prev: unknown, formData: FormData) {
    "use server";
    return await createAjusteManual(formData);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Ajuste manual de stock
        </h1>
        <p className="text-sm text-muted-foreground">
          Suma o resta cantidad al stock y queda registrado en el log de
          movimientos.
        </p>
      </header>
      <AjusteForm
        insumos={insumos}
        sucursales={sucursales}
        defaultSucursalId={sucursal.id}
        action={action}
      />
    </div>
  );
}
