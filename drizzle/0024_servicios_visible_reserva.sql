-- Separar el menú de reserva pública (lo que ve el cliente) de los ítems que
-- solo se cobran en caja. En YB los tratamientos/combos tienen precios por largo
-- de pelo (1/2/3/4): en la web se muestra un único servicio "desde $X", pero en
-- la caja el operador tiene que poder elegir el precio exacto de cada tier.
--
-- `servicios` es una sola tabla que alimenta tanto la reserva como la caja, así
-- que agregamos un flag de visibilidad:
--   * visible_reserva = true  (default): aparece en la web y genera turnos.
--   * visible_reserva = false: solo-caja; no se muestra ni se puede reservar.
--
-- Default true => todos los servicios existentes quedan visibles, sin cambios.

BEGIN;

ALTER TABLE "servicios"
  ADD COLUMN IF NOT EXISTS "visible_reserva" boolean NOT NULL DEFAULT true;

COMMIT;
