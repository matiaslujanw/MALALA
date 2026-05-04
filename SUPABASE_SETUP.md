# Supabase + Drizzle en MALALA

## 1. Variables obligatorias

Copia `C:\repos\MALALA\.env.example` a `.env.local` y completa:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DATABASE_URL`
- `MALALA_SEED_PASSWORD`

`SUPABASE_DATABASE_URL` debe ser una connection string Postgres valida de Supabase.

## 2. Bootstrap inicial

```bash
npm run db:push
npm run db:seed
```

Luego aplica:

- `C:\repos\MALALA\supabase\rls.sql`

Puedes pegarlo en el SQL editor de Supabase.

## 3. Que carga el seed

El seed crea:

- usuarios internos en `auth.users`
- perfiles en `public.profiles`
- sucursales
- empleados
- clientes
- proveedores
- servicios
- insumos y recetas
- stock y movimientos
- ingresos y egresos
- cierres de caja
- turnos y `turno_eventos`

Los usuarios seeded usan la password definida en `MALALA_SEED_PASSWORD` al momento de correr `npm run db:seed`.

## 4. Runtime real

MALALA ya no soporta runtime mock. Si faltan variables o Supabase no esta operativo:

- el back office redirige a `C:\repos\MALALA\src\app\dev\login\page.tsx`
- `dev/login` muestra el error de configuracion
- las rutas protegidas no caen a `store`
- la landing y los modulos de negocio no usan datos en memoria

`src/lib/mock/*` queda solo como snapshot tecnico para `db:seed`.

## 5. Rutas utiles de desarrollo

- `C:\repos\MALALA\src\app\dev\login\page.tsx`: login real por email/password
- `C:\repos\MALALA\src\app\page.tsx`: landing publica + reserva
- `C:\repos\MALALA\src\app\(app)\dashboard\page.tsx`
- `C:\repos\MALALA\src\app\(app)\turnos\page.tsx`
- `C:\repos\MALALA\src\app\(app)\ventas\page.tsx`
- `C:\repos\MALALA\src\app\(app)\stock\page.tsx`
- `C:\repos\MALALA\src\app\(app)\egresos\page.tsx`
- `C:\repos\MALALA\src\app\(app)\caja\page.tsx`
- `C:\repos\MALALA\src\app\(app)\catalogos\page.tsx`
- `C:\repos\MALALA\src\app\(app)\reportes\page.tsx`

## 6. Usuarios seeded

- `admin@malala.com`
- `encargada.centro@malala.com`
- `anita@malala.com`
- `encargada.norte@malala.com`
- `eliana@malala.com`

## 7. Comandos habituales

```bash
npm run dev
npm run db:push
npm run db:seed
npm run lint
npx tsc --noEmit
```
