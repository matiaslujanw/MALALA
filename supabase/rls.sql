create or replace function public.app_role()
returns text
language sql
stable
as $$
  select rol::text
  from public.profiles
  where user_id = auth.uid()
$$;

create or replace function public.app_sucursal_default()
returns text
language sql
stable
as $$
  select sucursal_default_id
  from public.profiles
  where user_id = auth.uid()
$$;

create or replace function public.app_empleado_id()
returns text
language sql
stable
as $$
  select empleado_id
  from public.profiles
  where user_id = auth.uid()
$$;

create or replace function public.app_is_admin()
returns boolean
language sql
stable
as $$
  select public.app_role() = 'admin'
$$;

create or replace function public.app_can_access_sucursal(target_sucursal_id text)
returns boolean
language sql
stable
as $$
  select
    public.app_is_admin()
    or public.app_sucursal_default() = target_sucursal_id
$$;

create or replace function public.app_can_access_empleado(target_empleado_id text)
returns boolean
language sql
stable
as $$
  select
    public.app_is_admin()
    or public.app_role() = 'encargada'
    or public.app_empleado_id() = target_empleado_id
$$;

alter table public.profiles enable row level security;
alter table public.sucursales enable row level security;
alter table public.empleados enable row level security;
alter table public.clientes enable row level security;
alter table public.proveedores enable row level security;
alter table public.servicios enable row level security;
alter table public.horarios_sucursal enable row level security;
alter table public.profesionales_agenda enable row level security;
alter table public.insumos enable row level security;
alter table public.recetas enable row level security;
alter table public.medios_pago enable row level security;
alter table public.rubros_gasto enable row level security;
alter table public.stock_sucursal enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.ingresos enable row level security;
alter table public.ingreso_lineas enable row level security;
alter table public.egresos enable row level security;
alter table public.cierres_caja enable row level security;
alter table public.turnos enable row level security;
alter table public.turno_eventos enable row level security;

create policy "profiles self or admin"
on public.profiles
for select
using (auth.uid() = user_id or public.app_is_admin());

create policy "sucursales by scope"
on public.sucursales
for select
using (public.app_can_access_sucursal(id));

create policy "empleados by scope"
on public.empleados
for select
using (
  public.app_is_admin()
  or public.app_sucursal_default() = sucursal_principal_id
  or public.app_empleado_id() = id
);

create policy "clientes internal roles"
on public.clientes
for select
using (public.app_role() in ('admin', 'encargada', 'empleado'));

create policy "proveedores only management"
on public.proveedores
for select
using (public.app_role() in ('admin', 'encargada'));

create policy "servicios internal roles"
on public.servicios
for select
using (public.app_role() in ('admin', 'encargada', 'empleado'));

create policy "horarios by scope"
on public.horarios_sucursal
for select
using (public.app_can_access_sucursal(sucursal_id));

create policy "profesionales by scope"
on public.profesionales_agenda
for select
using (
  public.app_can_access_sucursal(sucursal_id)
  and public.app_can_access_empleado(empleado_id)
);

create policy "insumos only management"
on public.insumos
for select
using (public.app_role() in ('admin', 'encargada'));

create policy "recetas only management"
on public.recetas
for select
using (public.app_role() in ('admin', 'encargada'));

create policy "medios pago internal roles"
on public.medios_pago
for select
using (public.app_role() in ('admin', 'encargada', 'empleado'));

create policy "rubros gasto only management"
on public.rubros_gasto
for select
using (public.app_role() in ('admin', 'encargada'));

create policy "stock by scope"
on public.stock_sucursal
for select
using (public.app_can_access_sucursal(sucursal_id));

create policy "movimientos stock by scope"
on public.movimientos_stock
for select
using (public.app_can_access_sucursal(sucursal_id));

create policy "ingresos by scope"
on public.ingresos
for select
using (public.app_can_access_sucursal(sucursal_id));

create policy "ingreso lineas by ingreso scope"
on public.ingreso_lineas
for select
using (
  exists (
    select 1
    from public.ingresos
    where ingresos.id = ingreso_lineas.ingreso_id
      and public.app_can_access_sucursal(ingresos.sucursal_id)
  )
);

create policy "egresos by scope"
on public.egresos
for select
using (public.app_can_access_sucursal(sucursal_id));

create policy "cierres caja by scope"
on public.cierres_caja
for select
using (public.app_can_access_sucursal(sucursal_id));

create policy "turnos by scope"
on public.turnos
for select
using (
  public.app_can_access_sucursal(sucursal_id)
  and (
    public.app_role() in ('admin', 'encargada')
    or public.app_empleado_id() = profesional_id
  )
);

create policy "turno eventos by turno scope"
on public.turno_eventos
for select
using (
  exists (
    select 1
    from public.turnos
    where turnos.id = turno_eventos.turno_id
      and public.app_can_access_sucursal(turnos.sucursal_id)
      and (
        public.app_role() in ('admin', 'encargada')
        or public.app_empleado_id() = turnos.profesional_id
      )
  )
);

-- Las escrituras publicas de reservas deben pasar por server actions con service role.
-- Para el back office, agregar politicas INSERT/UPDATE/DELETE modulo por modulo
-- cuando cada flujo quede migrado a Supabase.
