import { switchSucursal } from "@/lib/auth/actions";
import { store } from "@/lib/mock/store";
import type { Sucursal, Usuario } from "@/lib/types";

interface Props {
  user: Usuario;
  active: Sucursal;
}

export function SucursalSwitcher({ user, active }: Props) {
  // Solo admin puede cambiar; los otros ven su sucursal pero sin selector
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
        {store.sucursales.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
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
  const sucId = formData.get("sucursal_id");
  if (typeof sucId === "string") {
    await switchSucursal(sucId);
    revalidatePath("/", "layout");
  }
}
