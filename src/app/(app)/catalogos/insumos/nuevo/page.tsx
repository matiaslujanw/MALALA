import { redirect } from "next/navigation";
import { InsumoForm } from "@/components/forms/insumo-form";
import { createInsumo } from "@/lib/data/insumos";
import { listProveedores } from "@/lib/data/proveedores";
import { requireUser } from "@/lib/auth/session";

export default async function NuevoInsumoPage() {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/catalogos/insumos");
  const proveedores = await listProveedores();

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
        action={action}
        submitLabel="Crear"
      />
    </div>
  );
}
