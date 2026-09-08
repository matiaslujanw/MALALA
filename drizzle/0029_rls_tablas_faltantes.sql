-- Cierra el agujero de RLS en las 14 tablas que quedaron afuera.
--
-- QUÉ PASABA: supabase/rls.sql prendió RLS en 27 tablas, y todo lo que se
-- agregó después quedó sin prender. Esas 14 tablas conservaban el grant por
-- defecto de Supabase al rol `anon` (SELECT/INSERT/UPDATE/DELETE), y `anon` usa
-- la anon key, que viaja en el bundle del navegador: es pública por diseño.
--
-- O sea que cualquiera desde internet podía, con la clave que sale de ver el
-- código fuente de la página:
--   * INSERTAR una gift_card con el saldo que quisiera y después canjearla como
--     medio de pago — plata que sale de la caja contra un vale inventado
--   * leer cliente_ficha_registros, que tiene alergias y estado de salud del
--     cabello de las clientas
--   * escribir servicio_sucursal, promocion_items, servicios_horarios y demás
--     tablas de estructura del catálogo
--
-- POR QUÉ ALCANZA CON PRENDER RLS, SIN POLÍTICAS: con RLS activo y cero
-- políticas, postgres deniega todo por defecto a cualquier rol que no tenga
-- BYPASSRLS. Verificado que ninguna de las 14 tiene política hoy (pg_policies
-- devuelve 0 para ellas), así que no hay nada que se active sin querer.
--
-- POR QUÉ NO ROMPE LA APP: la app no entra por PostgREST, entra por postgres-js
-- con el rol `postgres`, que tiene rolbypassrls = true — verificado contra la
-- base. RLS es invisible para el servidor. Y el cliente de browser
-- (src/lib/db/client/supabase-browser.ts) sólo se usa para autenticación: no
-- hay una sola llamada `supabase.from(...)` en todo src/.
--
-- Idempotente: prender RLS sobre una tabla que ya lo tiene no hace nada.

BEGIN;

alter table public.gift_cards enable row level security;
alter table public.gift_card_movimientos enable row level security;
alter table public.cliente_ficha_registros enable row level security;
alter table public.cliente_sucursal enable row level security;
alter table public.cuenta_impuestos enable row level security;
alter table public.motivo_sucursal enable row level security;
alter table public.profesionales_servicios enable row level security;
alter table public.promocion_items enable row level security;
alter table public.proveedor_sucursal enable row level security;
alter table public.push_notification_queue enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.rubro_sucursal enable row level security;
alter table public.servicio_sucursal enable row level security;
alter table public.servicios_horarios enable row level security;

COMMIT;
