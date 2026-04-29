import { redirect } from "next/navigation";
import { TransferenciaForm } from "@/components/forms/transferencia-form";
import { listInsumos } from "@/lib/data/insumos";
import { listSucursales } from "@/lib/data/sucursales";
import { createTransferencia } from "@/lib/data/stock";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";

export default async function TransferenciaPage() {
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
    return await createTransferencia(formData);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Transferencia entre sucursales
        </h1>
        <p className="text-sm text-muted-foreground">
          Genera dos movimientos atómicos: salida en origen y entrada en
          destino.
        </p>
      </header>
      <TransferenciaForm
        insumos={insumos}
        sucursales={sucursales}
        defaultOrigenId={sucursal.id}
        action={action}
      />
    </div>
  );
}
