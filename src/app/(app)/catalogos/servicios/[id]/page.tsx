import { notFound, redirect } from "next/navigation";
import { ServicioForm } from "@/components/forms/servicio-form";
import {
  getServicio,
  toggleServicioActivo,
  updateServicio,
} from "@/lib/data/servicios";
import { requireUser } from "@/lib/auth/session";

export default async function EditarServicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/catalogos/servicios");

  const { id } = await params;
  const servicio = await getServicio(id);
  if (!servicio) notFound();

  async function update(_prev: unknown, formData: FormData) {
    "use server";
    return await updateServicio(id, formData);
  }

  async function toggle() {
    "use server";
    await toggleServicioActivo(id);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Editar servicio
        </h1>
        <p className="text-sm text-muted-foreground">{servicio.nombre}</p>
      </header>

      <ServicioForm servicio={servicio} action={update} submitLabel="Guardar" />

      <div className="border-t border-border pt-6">
        <form action={toggle}>
          <button
            type="submit"
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {servicio.activo ? "Marcar inactivo" : "Reactivar"}
          </button>
        </form>
      </div>
    </div>
  );
}
