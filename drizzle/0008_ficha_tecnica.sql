-- Fase 8 — Ficha técnica del cliente (estilo historia clínica)
-- Suma un perfil fijo en `clientes` (tipo de pelo, salud, alergias, color base,
-- observaciones técnicas) y una tabla de registros fechados (fórmula de color,
-- servicio, notas por visita). NO reemplaza el historial de ventas.

BEGIN;

-- 1) Perfil técnico fijo del cliente
ALTER TABLE "clientes"
  ADD COLUMN "tipo_cabello" text,
  ADD COLUMN "salud_cabello" text,
  ADD COLUMN "alergias" text,
  ADD COLUMN "color_actual" text,
  ADD COLUMN "observaciones_tecnicas" text;

-- 2) Registros fechados de la ficha técnica
CREATE TABLE "cliente_ficha_registros" (
  "id" text PRIMARY KEY,
  "cliente_id" text NOT NULL REFERENCES "clientes"("id") ON DELETE CASCADE,
  "fecha" timestamptz NOT NULL,
  "servicio_id" text REFERENCES "servicios"("id"),
  "formula" text,
  "notas" text,
  "empleado_id" text REFERENCES "empleados"("id"),
  "usuario_id" uuid NOT NULL REFERENCES "profiles"("user_id"),
  "creado_en" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "cliente_ficha_registros_cliente_fecha_idx"
  ON "cliente_ficha_registros" ("cliente_id", "fecha");

COMMIT;
