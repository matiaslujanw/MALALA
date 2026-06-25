import { redirect } from "next/navigation";
import {
  createCuenta,
  listCuentas,
  toggleCuentaActiva,
} from "@/lib/data/cuentas-bancarias";
import { listSucursales } from "@/lib/data/sucursales";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { buildAccessScope } from "@/lib/auth/access";
import { SubmitButton } from "@/components/forms/field";

export default async function CuentasBancariasPage() {
  const user = await requireUser();
  if (user.rol !== "admin" && user.rol !== "superadmin") {
    redirect("/catalogos");
  }

  const scope = buildAccessScope(user);
  const [cuentas, todasSucursales, activa] = await Promise.all([
    listCuentas(),
    listSucursales({ soloActivas: true }),
    getActiveSucursal(),
  ]);
  const sucursalesPermitidas = todasSucursales.filter((s) =>
    scope.sucursalIdsPermitidas.includes(s.id),
  );
  const sucursalNombreById = new Map(
    sucursalesPermitidas.map((s) => [s.id, s.nombre]),
  );

  async function create(formData: FormData) {
    "use server";
    await createCuenta(formData);
  }
  async function toggle(formData: FormData) {
    "use server";
    const id = formData.get("id");
    if (typeof id === "string") await toggleCuentaActiva(id);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Cuentas bancarias
        </h1>
        <p className="text-sm text-muted-foreground">
          {cuentas.length} cuentas · cada cuenta pertenece a una sucursal
        </p>
      </header>

      <section className="bg-card border border-border rounded-md p-5 space-y-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
          Agregar cuenta
        </h2>
        <form
          action={create}
          className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sucursal
            </label>
            <select
              name="sucursal_id"
              required
              defaultValue={activa?.id ?? sucursalesPermitidas[0]?.id}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {sucursalesPermitidas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Nombre
            </label>
            <input
              name="nombre"
              required
              placeholder="Banco Galicia, Caja Efectivo…"
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tipo
            </label>
            <select
              name="tipo"
              required
              defaultValue="banco"
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="banco">Banco</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </div>
          <SubmitButton
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors"
            pendingLabel="Agregando..."
          >
            Agregar
          </SubmitButton>
          <div className="space-y-1.5 sm:col-span-5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Observación
            </label>
            <input
              name="observacion"
              placeholder="Número de CBU, alias, etc. (opcional)"
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </form>
      </section>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3 w-40">Sucursal</th>
              <th className="text-left font-medium px-4 py-3">Nombre</th>
              <th className="text-left font-medium px-4 py-3 w-24">Tipo</th>
              <th className="text-left font-medium px-4 py-3">Observación</th>
              <th className="text-center font-medium px-4 py-3 w-28">Estado</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cuentas.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Todavía no hay cuentas cargadas.
                </td>
              </tr>
            ) : (
              cuentas.map((c) => (
                <tr key={c.id} className="hover:bg-cream/30">
                  <td className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                    {sucursalNombreById.get(c.sucursal_id) ?? c.sucursal_id}
                  </td>
                  <td className="px-4 py-3 font-medium">{c.nombre}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                    {c.tipo}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.observacion ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.activo ? (
                      <span className="bg-sage-100 text-sage-900 px-2 py-0.5 rounded text-xs">
                        Activa
                      </span>
                    ) : (
                      <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded text-xs">
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={toggle}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
                        {c.activo ? "Desactivar" : "Reactivar"}
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
