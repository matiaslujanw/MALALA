import { ProveedorForm } from "@/components/forms/proveedor-form";
import { createProveedor } from "@/lib/data/proveedores";
import { requireUser } from "@/lib/auth/session";

export default async function NuevoProveedorPage() {
  await requireUser();

  async function action(_prev: unknown, formData: FormData) {
    "use server";
    return await createProveedor(formData);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Nuevo proveedor
        </h1>
      </header>
      <ProveedorForm action={action} submitLabel="Crear" />
    </div>
  );
}
