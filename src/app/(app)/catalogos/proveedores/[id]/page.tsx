import { notFound } from "next/navigation";
import { ProveedorForm } from "@/components/forms/proveedor-form";
import {
  getProveedor,
  updateProveedor,
} from "@/lib/data/proveedores";
import { requireUser } from "@/lib/auth/session";

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const proveedor = await getProveedor(id);
  if (!proveedor) notFound();

  async function update(_prev: unknown, formData: FormData) {
    "use server";
    return await updateProveedor(id, formData);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Editar proveedor
        </h1>
        <p className="text-sm text-muted-foreground">{proveedor.nombre}</p>
      </header>
      <ProveedorForm
        proveedor={proveedor}
        action={update}
        submitLabel="Guardar"
      />
    </div>
  );
}
