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
-- Tablas agregadas en fases posteriores (bancos, liquidaciones, integraciones, descuentos)
alter table public.motivos_descuento enable row level security;
alter table public.cuentas_bancarias enable row level security;
alter table public.movimientos_bancarios enable row level security;
alter table public.liquidaciones enable row level security;
alter table public.liquidacion_lineas enable row level security;
alter table public.integraciones_manychat enable row level security;
alter table public.whatsapp_envios enable row level security;

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

-- Motivos de descuento: catalogo compartido, leido tambien desde el form de venta.
create policy "motivos descuento internal roles"
on public.motivos_descuento
for select
using (public.app_role() in ('admin', 'encargada', 'empleado'));

-- Cuentas bancarias: por sucursal (financiero, mismo criterio que ingresos/egresos).
create policy "cuentas bancarias by scope"
on public.cuentas_bancarias
for select
using (public.app_can_access_sucursal(sucursal_id));

-- Movimientos bancarios: por sucursal del movimiento (admin ve los sin sucursal).
create policy "movimientos bancarios by scope"
on public.movimientos_bancarios
for select
using (public.app_can_access_sucursal(sucursal_id));

-- Liquidaciones: por sucursal; la empleada solo ve las propias.
create policy "liquidaciones by scope"
on public.liquidaciones
for select
using (
  public.app_can_access_sucursal(sucursal_id)
  and (
    public.app_role() in ('admin', 'encargada')
    or public.app_empleado_id() = empleado_id
  )
);

-- Lineas de liquidacion: heredan el scope de la liquidacion padre.
create policy "liquidacion lineas by liquidacion scope"
on public.liquidacion_lineas
for select
using (
  exists (
    select 1
    from public.liquidaciones
    where liquidaciones.id = liquidacion_lineas.liquidacion_id
      and public.app_can_access_sucursal(liquidaciones.sucursal_id)
      and (
        public.app_role() in ('admin', 'encargada')
        or public.app_empleado_id() = liquidaciones.empleado_id
      )
  )
);

-- Integraciones ManyChat: contienen api_key, solo admin.
create policy "integraciones manychat admin only"
on public.integraciones_manychat
for select
using (public.app_is_admin());

-- Envios de WhatsApp: log por sucursal, roles de gestion.
create policy "whatsapp envios by scope"
on public.whatsapp_envios
for select
using (
  public.app_can_access_sucursal(sucursal_id)
  and public.app_role() in ('admin', 'encargada')
);

-- Las escrituras publicas de reservas deben pasar por server actions con service role.
-- Para el back office, agregar politicas INSERT/UPDATE/DELETE modulo por modulo
-- cuando cada flujo quede migrado a Supabase.
