import { switchSucursal } from "@/lib/auth/actions";
import type { Sucursal, Usuario } from "@/lib/types";

interface Props {
  user: Usuario;
  active: Sucursal;
  sucursales: Sucursal[];
}

export function SucursalSwitcher({ user, active, sucursales }: Props) {
  if (user.rol !== "admin") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Sucursal
        </span>
        <span className="font-medium">{active.nombre}</span>
      </div>
    );
  }

  return (
    <form action={switchSucursalAndReload} className="flex items-center gap-2">
      <label
        htmlFor="sucursal"
        className="text-xs uppercase tracking-wider text-muted-foreground"
      >
        Sucursal
      </label>
      <select
        id="sucursal"
        name="sucursal_id"
        defaultValue={active.id}
        className="text-sm border border-border rounded-md px-3 py-1.5 bg-card"
      >
        {sucursales.map((sucursal) => (
          <option key={sucursal.id} value={sucursal.id}>
            {sucursal.nombre}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900"
      >
        Cambiar
      </button>
    </form>
  );
}

async function switchSucursalAndReload(formData: FormData) {
  "use server";
  const { revalidatePath } = await import("next/cache");
  const sucursalId = formData.get("sucursal_id");
  if (typeof sucursalId === "string") {
    await switchSucursal(sucursalId);
    revalidatePath("/", "layout");
  }
}
