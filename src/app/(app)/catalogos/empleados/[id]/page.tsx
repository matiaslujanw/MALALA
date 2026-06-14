import { notFound, redirect } from "next/navigation";
import { EmpleadoForm } from "@/components/forms/empleado-form";
import { AnticiposPanel } from "@/components/anticipos-panel";
import { AccesoEmpleadoPanel } from "@/components/forms/acceso-empleado-panel";
import {
  crearAccesoEmpleado,
  getAccesoDeEmpleado,
  getEmpleado,
  toggleEmpleadoActivo,
  updateEmpleado,
} from "@/lib/data/empleados";
import { listAnticipos } from "@/lib/data/anticipos";
import { listMediosPago } from "@/lib/data/medios-pago";
import { listSucursales } from "@/lib/data/sucursales";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";

const ROL_LABEL: Record<string, string> = {
  empleado: "Empleado",
  encargada: "Encargada",
  admin: "Admin",
};

export default async function EditarEmpleadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "admin" && user.rol !== "superadmin") {
    redirect("/catalogos/empleados");
  }

  const { id } = await params;
  const sucursal = await getActiveSucursal();
  const [empleado, sucursales, anticipos, mediosPago, acceso] = await Promise.all([
    getEmpleado(id),
    listSucursales(),
    listAnticipos(id),
    sucursal
      ? listMediosPago({ sucursalId: sucursal.id, soloActivos: true })
      : Promise.resolve([]),
    getAccesoDeEmpleado(id),
  ]);
  if (!empleado) notFound();

  const rolesPermitidos =
    user.rol === "superadmin"
      ? ["empleado", "encargada", "admin"]
      : ["empleado", "encargada"];
  const rolesDisponibles = rolesPermitidos.map((value) => ({
    value,
    label: ROL_LABEL[value] ?? value,
  }));

  async function update(_prev: unknown, formData: FormData) {
    "use server";
    return await updateEmpleado(id, formData);
  }
  async function toggle() {
    "use server";
    await toggleEmpleadoActivo(id);
  }
  async function crearAcceso(_prev: unknown, formData: FormData) {
    "use server";
    return await crearAccesoEmpleado(id, formData);
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

      <AccesoEmpleadoPanel
        acceso={acceso}
        rolesDisponibles={rolesDisponibles}
        action={crearAcceso}
      />

      <AnticiposPanel
        empleadoId={empleado.id}
        anticipos={anticipos}
        mediosPago={mediosPago}
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
