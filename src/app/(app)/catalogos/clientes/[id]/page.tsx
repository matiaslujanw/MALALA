import { notFound } from "next/navigation";
import { ClienteForm } from "@/components/forms/cliente-form";
import {
  getCliente,
  toggleClienteActivo,
  updateCliente,
} from "@/lib/data/clientes";
import { requireUser } from "@/lib/auth/session";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const cliente = await getCliente(id);
  if (!cliente) notFound();

  async function update(_prev: unknown, formData: FormData) {
    "use server";
    return await updateCliente(id, formData);
  }
  async function toggle() {
    "use server";
    await toggleClienteActivo(id);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Editar cliente
        </h1>
        <p className="text-sm text-muted-foreground">{cliente.nombre}</p>
      </header>
      <ClienteForm cliente={cliente} action={update} submitLabel="Guardar" />
      <div className="border-t border-border pt-6">
        <form action={toggle}>
          <button
            type="submit"
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {cliente.activo ? "Marcar inactivo" : "Reactivar"}
          </button>
        </form>
      </div>
    </div>
  );
}
