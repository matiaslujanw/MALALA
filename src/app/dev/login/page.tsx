/**
 * Dev login: selector de usuario para entrar como admin/encargada/empleado.
 * Reemplazar por /login con Supabase Auth en su momento.
 */
import { loginAs } from "@/lib/auth/actions";
import { store } from "@/lib/mock/store";

const ROL_LABEL: Record<string, string> = {
  admin: "Admin",
  encargada: "Encargada",
  empleado: "Empleado",
};

export default function DevLoginPage() {
  const usuarios = store.usuarios;
  const sucursales = store.sucursales;

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center space-y-2">
          <h1 className="font-display text-3xl tracking-[0.3em] uppercase">
            MALALA
          </h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Dev login
          </p>
        </header>

        <div className="bg-card border border-border rounded-md p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Elegí un usuario para iniciar sesión.
          </p>

          <ul className="space-y-2">
            {usuarios.map((u) => {
              const sucursal = sucursales.find(
                (s) => s.id === u.sucursal_default_id,
              );
              return (
                <li key={u.id}>
                  <form action={loginAs.bind(null, u.id)}>
                    <button
                      type="submit"
                      className="w-full text-left p-4 border border-border rounded-md hover:bg-cream transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{u.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wider text-sage-700 font-medium">
                            {ROL_LABEL[u.rol]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sucursal?.nombre}
                          </p>
                        </div>
                      </div>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </main>
  );
}
