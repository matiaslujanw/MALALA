-- Gift cards como entidad propia.
--
-- POR QUÉ: hasta ahora la venta de una gift card se cargaba como si fuera un
-- servicio (GFC100..GFC104), o sea que entraba a `ingresos` y sumaba a la
-- facturación del día. Pero vender una gift card no es una venta: es plata que
-- se cobra por un servicio que todavía no se prestó. Cuando la clienta la
-- canjea, ESE es el momento en que hay facturación. Cargándola de las dos
-- formas, el mismo dinero se contaba dos veces y alguien tenía que restarlo a
-- mano todos los meses.
--
-- A partir de acá: la emisión NO escribe en `ingresos` (sólo mueve plata, igual
-- que un pago de cuenta corriente) y el canje es una venta normal que descuenta
-- el saldo de la tarjeta.
--
-- ESTADO DERIVADO, NO GUARDADO: la columna `estado` sólo distingue 'activa' de
-- 'anulada'. Que una tarjeta esté "canjeada" se deduce de saldo <= 0 y que esté
-- "vencida" de vence_el, ambas cosas al leer. Guardarlas sería duplicar
-- información que ya está en los números y arriesgarse a que quede desfasada;
-- además el salón hace excepciones con la fecha, así que un vencimiento nunca
-- puede ser un estado terminal.
--
-- El CHECK de saldo es la última línea de defensa contra un canje mal calculado:
-- ninguna tarjeta puede quedar en negativo ni valer más de lo que se pagó.

BEGIN;

CREATE TABLE IF NOT EXISTS "gift_cards" (
  "id" text PRIMARY KEY,
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id"),
  "codigo" text NOT NULL,
  "importe" double precision NOT NULL,
  "saldo" double precision NOT NULL,
  "estado" text NOT NULL DEFAULT 'activa',
  "fecha_emision" timestamptz NOT NULL,
  "vence_el" date,
  "compradora" text,
  "beneficiaria" text,
  "observacion" text,
  "emitida_pre_sistema" boolean NOT NULL DEFAULT false,
  "usuario_id" uuid NOT NULL REFERENCES "profiles"("user_id"),
  "creado_en" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "gift_cards_importe_positivo" CHECK ("importe" > 0),
  CONSTRAINT "gift_cards_saldo_en_rango" CHECK ("saldo" >= 0 AND "saldo" <= "importe"),
  CONSTRAINT "gift_cards_estado_valido" CHECK ("estado" IN ('activa', 'anulada'))
);

-- El código se guarda normalizado (trim + mayúsculas) desde la app, pero el
-- índice va sobre upper() igual: un script que inserte sin normalizar no puede
-- colar un duplicado. Es único POR SUCURSAL, no global — cada salón numera sus
-- tarjetas por su cuenta y una gift card sólo se canjea donde se vendió.
CREATE UNIQUE INDEX IF NOT EXISTS "gift_cards_sucursal_codigo_uq"
  ON "gift_cards" ("sucursal_id", upper("codigo"));

-- Para el combo del canje: las canjeables de una sucursal.
CREATE INDEX IF NOT EXISTS "gift_cards_sucursal_estado_idx"
  ON "gift_cards" ("sucursal_id", "estado");

-- Historial de la tarjeta. Es append-only: la fila de gift_cards guarda el saldo
-- actual y esta tabla cuenta cómo llegó hasta ahí.
--
-- `monto` va firmado: la emisión suma (+importe), el canje resta (-lo usado).
-- `saldo_resultante` es redundante a propósito — deja auditar el historial sin
-- tener que recalcular la suma de toda la tabla.
--
-- `ingreso_id` no lleva foreign key, siguiendo lo que ya hacen movimientos_cc y
-- liquidacion_lineas: las ventas no se borran nunca (se anulan), así que la FK
-- no aportaría y sí ataría el orden de los inserts.
CREATE TABLE IF NOT EXISTS "gift_card_movimientos" (
  "id" text PRIMARY KEY,
  "gift_card_id" text NOT NULL REFERENCES "gift_cards"("id") ON DELETE CASCADE,
  "fecha" timestamptz NOT NULL,
  "tipo" text NOT NULL,
  "monto" double precision NOT NULL DEFAULT 0,
  "saldo_resultante" double precision NOT NULL,
  "ingreso_id" text,
  "descripcion" text,
  "usuario_id" uuid NOT NULL REFERENCES "profiles"("user_id"),
  "creado_en" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "gift_card_mov_tipo_valido" CHECK ("tipo" IN ('emision', 'canje', 'anulacion', 'ajuste', 'correccion_codigo'))
);

CREATE INDEX IF NOT EXISTS "gift_card_mov_tarjeta_fecha_idx"
  ON "gift_card_movimientos" ("gift_card_id", "fecha");

CREATE INDEX IF NOT EXISTS "gift_card_mov_ingreso_idx"
  ON "gift_card_movimientos" ("ingreso_id");

COMMIT;
