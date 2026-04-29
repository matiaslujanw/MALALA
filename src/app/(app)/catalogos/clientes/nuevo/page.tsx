import { ClienteForm } from "@/components/forms/cliente-form";
import { createCliente } from "@/lib/data/clientes";
import { requireUser } from "@/lib/auth/session";

export default async function NuevoClientePage() {
  await requireUser();

  async function action(_prev: unknown, formData: FormData) {
    "use server";
    return await createCliente(formData);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Nuevo cliente
        </h1>
      </header>
      <ClienteForm action={action} submitLabel="Crear" />
    </div>
  );
}
