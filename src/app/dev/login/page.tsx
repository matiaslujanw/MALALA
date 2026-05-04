import { redirect } from "next/navigation";
import { loginWithPassword } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { listSucursales } from "@/lib/data/sucursales";
import { listUsuariosApp } from "@/lib/data/usuarios";
import { isSupabaseConfigured } from "@/lib/db/env";

const ROL_LABEL: Record<string, string> = {
  admin: "Admin",
  encargada: "Encargada",
  empleado: "Empleado",
};

interface SearchParams {
  error?: string;
}

export default async function DevLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect("/dashboard");

  const supabaseEnabled = isSupabaseConfigured();
  const passwordHint = process.env.MALALA_SEED_PASSWORD ?? "ChangeMe123!";

  if (!supabaseEnabled) {
    return (
      <main className="min-h-screen bg-cream px-6 py-10">
        <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-border bg-card p-8 shadow-[0_20px_60px_rgba(44,53,37,0.06)]">
          <header className="space-y-3 text-center">
            <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
              Acceso interno
            </p>
            <h1 className="font-display text-3xl tracking-[0.3em] uppercase">
              MALALA
            </h1>
            <p className="text-sm leading-7 text-muted-foreground">
              Este entorno ya no soporta login mock ni operacion en memoria. El
              back office necesita las credenciales completas de Supabase para
              iniciar sesion y cargar datos reales.
            </p>
          </header>

          <div className="mt-8 rounded-[1.4rem] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            <p className="font-medium">Supabase no esta configurado</p>
            <p className="mt-2 text-amber-800/80">
              Completa las variables obligatorias en <code>.env.local</code>,
              ejecuta las migraciones y vuelve a cargar esta pagina. Mientras
              tanto, la app no va a caer a datos mock.
            </p>
          </div>

          <div className="mt-6 rounded-[1.4rem] border border-border bg-cream/70 p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Variables minimas</p>
            <ul className="mt-3 space-y-2">
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
              <li>SUPABASE_SERVICE_ROLE_KEY</li>
              <li>SUPABASE_DATABASE_URL</li>
            </ul>
          </div>
        </div>
      </main>
    );
  }

  const [usuariosSupabase, sucursalesSupabase] = await Promise.all([
    listUsuariosApp({ incluirInactivos: true }),
    listSucursales({ soloActivas: true }),
  ]);
  const sucursalNameById = new Map(
    sucursalesSupabase.map((item) => [item.id, item.nombre]),
  );

  return (
    <main className="min-h-screen bg-cream px-6 py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-border bg-card p-8 shadow-[0_20px_60px_rgba(44,53,37,0.06)]">
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Acceso interno
          </p>
          <h1 className="mt-4 font-display text-4xl uppercase tracking-[0.18em]">
            MALALA
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            Esta pantalla ya trabaja con Supabase Auth real. Una vez cargadas
            las migraciones y el seed, el back office deja de depender de
            cookies mock y queda listo para seguir migrando los modulos hacia
            Postgres.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {usuariosSupabase.map((item) => (
              <div
                key={item.email}
                className="rounded-[1.4rem] border border-border bg-cream/70 p-4"
              >
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  {ROL_LABEL[item.rol]}
                </p>
                <p className="mt-3 font-medium">{item.nombre}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.email}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sucursalNameById.get(item.sucursal_default_id) ?? "Sin sucursal"}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.4rem] border border-sage-100 bg-sage-50 p-5 text-sm text-sage-900">
            <p className="font-medium">Password de seed</p>
            <p className="mt-1 text-sage-800/80">{passwordHint}</p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-8 shadow-[0_20px_60px_rgba(44,53,37,0.06)]">
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Inicia sesion
          </p>
          <h2 className="mt-4 text-3xl font-semibold">
            Entra al back office
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Usa uno de los usuarios sembrados en Supabase para validar roles,
            RLS y alcance por sucursal.
          </p>

          {sp.error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {sp.error}
            </div>
          ) : null}

          <form action={loginWithPassword} className="mt-8 space-y-4">
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Email
              </span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                placeholder="admin@malala.com"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Contrasena
              </span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                placeholder={passwordHint}
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-sage-700"
            >
              Entrar
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
