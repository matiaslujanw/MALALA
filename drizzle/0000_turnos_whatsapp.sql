-- Fase 1 — Turnos + WhatsApp (ManyChat)
-- Aplica:
--   * clientes: agrega telefono_e164 (único parcial), email
--   * turnos: agrega cliente_id (FK), token_acceso, token_expira_en,
--             confirmacion_enviada_en, recordatorio_2h_enviado_en
--             y elimina las columnas legacy cliente_nombre/cliente_telefono/cliente_email
--   * tablas nuevas: integraciones_manychat, whatsapp_envios

BEGIN;

-- 1) Enums nuevos
CREATE TYPE "whatsapp_envio_tipo" AS ENUM (
  'confirmacion', 'recordatorio_2h', 'cancelacion', 'reprogramacion', 'prueba'
);
CREATE TYPE "whatsapp_envio_estado" AS ENUM ('ok', 'error');

-- 2) Extensiones a clientes
ALTER TABLE "clientes"
  ADD COLUMN "telefono_e164" text,
  ADD COLUMN "email" text;

-- 3) Extensiones a turnos (nuevas columnas como nullable para el backfill)
ALTER TABLE "turnos"
  ADD COLUMN "cliente_id" text,
  ADD COLUMN "token_acceso" text,
  ADD COLUMN "token_expira_en" timestamptz,
  ADD COLUMN "confirmacion_enviada_en" timestamptz,
  ADD COLUMN "recordatorio_2h_enviado_en" timestamptz;

-- 4) Backfill de clientes faltantes a partir de los turnos legacy.
--    Dedupe por digits-only del cliente_telefono (la normalización fina a E.164
--    se hace cuando un cliente vuelve a editarse desde la app).
WITH turnos_norm AS (
  SELECT
    t.id   AS turno_id,
    t.cliente_nombre,
    t.cliente_telefono,
    t.cliente_email,
    regexp_replace(coalesce(t.cliente_telefono, ''), '[^0-9]', '', 'g') AS digits
  FROM turnos t
),
existentes AS (
  SELECT
    c.id,
    regexp_replace(coalesce(c.telefono, ''), '[^0-9]', '', 'g') AS digits
  FROM clientes c
),
match_existente AS (
  SELECT DISTINCT ON (tn.digits) tn.digits, e.id AS cliente_id
  FROM turnos_norm tn
  JOIN existentes e ON e.digits <> '' AND e.digits = tn.digits
),
faltantes AS (
  SELECT
    'turno-cli-' || min(tn.turno_id) AS new_id,
    min(tn.cliente_nombre)           AS nombre,
    min(tn.cliente_telefono)         AS telefono,
    min(tn.cliente_email)            AS email,
    tn.digits                        AS digits
  FROM turnos_norm tn
  WHERE tn.digits <> ''
    AND NOT EXISTS (SELECT 1 FROM match_existente m WHERE m.digits = tn.digits)
  GROUP BY tn.digits
),
sin_telefono AS (
  SELECT
    'turno-cli-' || tn.turno_id AS new_id,
    tn.cliente_nombre           AS nombre,
    tn.cliente_telefono         AS telefono,
    tn.cliente_email            AS email
  FROM turnos_norm tn
  WHERE tn.digits = ''
),
ins_faltantes AS (
  INSERT INTO clientes (id, nombre, telefono, telefono_e164, email, observacion, activo, saldo_cc)
  SELECT new_id, nombre, telefono, NULL, email, NULL, true, 0 FROM faltantes
  RETURNING id
),
ins_sin_tel AS (
  INSERT INTO clientes (id, nombre, telefono, telefono_e164, email, observacion, activo, saldo_cc)
  SELECT new_id, nombre, telefono, NULL, email, NULL, true, 0 FROM sin_telefono
  RETURNING id
)
UPDATE turnos t
SET cliente_id = COALESCE(
  (SELECT m.cliente_id FROM match_existente m
     JOIN turnos_norm tn ON tn.turno_id = t.id
    WHERE m.digits = tn.digits),
  (SELECT f.new_id FROM faltantes f
     JOIN turnos_norm tn ON tn.turno_id = t.id
    WHERE f.digits = tn.digits),
  'turno-cli-' || t.id
);

-- 5) Backfill token y expiración (token base64url 32 bytes, expira al inicio del turno)
UPDATE turnos
SET
  token_acceso = replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', ''),
  token_expira_en = ((fecha_turno || ' ' || hora || ':00')::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
WHERE token_acceso IS NULL;

-- 6) Constraints definitivos en turnos
ALTER TABLE "turnos"
  ALTER COLUMN "cliente_id" SET NOT NULL,
  ALTER COLUMN "token_acceso" SET NOT NULL,
  ALTER COLUMN "token_expira_en" SET NOT NULL;

ALTER TABLE "turnos"
  ADD CONSTRAINT "turnos_cliente_id_fk"
    FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id");

CREATE UNIQUE INDEX "turnos_token_acceso_uq" ON "turnos" ("token_acceso");
CREATE INDEX "turnos_cliente_id_idx" ON "turnos" ("cliente_id");

-- 7) Drop columnas legacy de turnos
ALTER TABLE "turnos"
  DROP COLUMN "cliente_nombre",
  DROP COLUMN "cliente_telefono",
  DROP COLUMN "cliente_email";

-- 8) Índice único parcial por telefono_e164 (solo cuando no es null)
CREATE UNIQUE INDEX "clientes_telefono_e164_uq"
  ON "clientes" ("telefono_e164")
  WHERE "telefono_e164" IS NOT NULL;

-- 9) Tabla de configuración ManyChat por sucursal
CREATE TABLE "integraciones_manychat" (
  "sucursal_id" text PRIMARY KEY REFERENCES "sucursales"("id") ON DELETE CASCADE,
  "api_key" text NOT NULL,
  "numero_whatsapp_e164" text NOT NULL,
  "flow_ns_confirmacion" text,
  "flow_ns_recordatorio_2h" text,
  "flow_ns_cancelacion" text,
  "flow_ns_reprogramacion" text,
  "activo" boolean NOT NULL DEFAULT true,
  "creado_en" timestamptz NOT NULL DEFAULT now(),
  "actualizado_en" timestamptz
);

-- 10) Bitácora de envíos WhatsApp
CREATE TABLE "whatsapp_envios" (
  "id" text PRIMARY KEY,
  "turno_id" text REFERENCES "turnos"("id") ON DELETE SET NULL,
  "sucursal_id" text NOT NULL REFERENCES "sucursales"("id"),
  "cliente_id" text REFERENCES "clientes"("id") ON DELETE SET NULL,
  "telefono_destino_e164" text NOT NULL,
  "tipo" "whatsapp_envio_tipo" NOT NULL,
  "estado" "whatsapp_envio_estado" NOT NULL,
  "flow_ns" text,
  "payload" jsonb,
  "respuesta" jsonb,
  "error_detalle" text,
  "enviado_en" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "whatsapp_envios_turno_idx" ON "whatsapp_envios" ("turno_id");
CREATE INDEX "whatsapp_envios_tipo_idx" ON "whatsapp_envios" ("tipo");

COMMIT;
