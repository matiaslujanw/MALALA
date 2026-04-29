import { notFound, redirect } from "next/navigation";
import { InsumoForm } from "@/components/forms/insumo-form";
import {
  getInsumo,
  toggleInsumoActivo,
  updateInsumo,
} from "@/lib/data/insumos";
import { listProveedores } from "@/lib/data/proveedores";
import { requireUser } from "@/lib/auth/session";

export default async function EditarInsumoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/catalogos/insumos");
  const { id } = await params;
  const [insumo, proveedores] = await Promise.all([
    getInsumo(id),
    listProveedores(),
  ]);
  if (!insumo) notFound();

  async function update(_prev: unknown, formData: FormData) {
    "use server";
    return await updateInsumo(id, formData);
  }
  async function toggle() {
    "use server";
    await toggleInsumoActivo(id);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Editar insumo
        </h1>
        <p className="text-sm text-muted-foreground">{insumo.nombre}</p>
      </header>
      <InsumoForm
        insumo={insumo}
        proveedores={proveedores}
        action={update}
        submitLabel="Guardar"
      />
      <div className="border-t border-border pt-6">
        <form action={toggle}>
          <button
            type="submit"
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {insumo.activo ? "Marcar inactivo" : "Reactivar"}
          </button>
        </form>
      </div>
    </div>
  );
}
