import { redirect } from "next/navigation";
import { EmpleadoForm } from "@/components/forms/empleado-form";
import { createEmpleado } from "@/lib/data/empleados";
import { listSucursales } from "@/lib/data/sucursales";
import { requireUser } from "@/lib/auth/session";

export default async function NuevoEmpleadoPage() {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/catalogos/empleados");
  const sucursales = await listSucursales();

  async function action(_prev: unknown, formData: FormData) {
    "use server";
    return await createEmpleado(formData);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Nuevo empleado
        </h1>
      </header>
      <EmpleadoForm
        sucursales={sucursales}
        action={action}
        submitLabel="Crear"
      />
    </div>
  );
}
