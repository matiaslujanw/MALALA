BEGIN;

CREATE TABLE "push_subscriptions" (
  "id" text PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "empleado_id" text NOT NULL REFERENCES "empleados"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "activo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_uq"
  ON "push_subscriptions" ("endpoint");

CREATE INDEX "push_subscriptions_empleado_activo_idx"
  ON "push_subscriptions" ("empleado_id", "activo");

CREATE INDEX "push_subscriptions_user_activo_idx"
  ON "push_subscriptions" ("user_id", "activo");

CREATE TABLE "push_notification_queue" (
  "id" text PRIMARY KEY,
  "subscription_id" text NOT NULL REFERENCES "push_subscriptions"("id") ON DELETE CASCADE,
  "titulo" text NOT NULL,
  "cuerpo" text NOT NULL,
  "url" text NOT NULL,
  "tipo" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "delivered_at" timestamptz
);

CREATE INDEX "push_notification_queue_sub_pending_idx"
  ON "push_notification_queue" ("subscription_id", "delivered_at", "created_at");

COMMIT;
