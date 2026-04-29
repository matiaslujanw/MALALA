import { notFound, redirect } from "next/navigation";
import { EmpleadoForm } from "@/components/forms/empleado-form";
import {
  getEmpleado,
  toggleEmpleadoActivo,
  updateEmpleado,
} from "@/lib/data/empleados";
import { listSucursales } from "@/lib/data/sucursales";
import { requireUser } from "@/lib/auth/session";

export default async function EditarEmpleadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/catalogos/empleados");

  const { id } = await params;
  const [empleado, sucursales] = await Promise.all([
    getEmpleado(id),
    listSucursales(),
  ]);
  if (!empleado) notFound();

  async function update(_prev: unknown, formData: FormData) {
    "use server";
    return await updateEmpleado(id, formData);
  }
  async function toggle() {
    "use server";
    await toggleEmpleadoActivo(id);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Editar empleado
        </h1>
        <p className="text-sm text-muted-foreground">{empleado.nombre}</p>
      </header>
      <EmpleadoForm
        empleado={empleado}
        sucursales={sucursales}
        action={update}
        submitLabel="Guardar"
      />
      <div className="border-t border-border pt-6">
        <form action={toggle}>
          <button
            type="submit"
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {empleado.activo ? "Marcar inactivo" : "Reactivar"}
          </button>
        </form>
      </div>
    </div>
  );
}
