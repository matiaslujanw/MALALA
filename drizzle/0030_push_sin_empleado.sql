-- Permite que se suscriban al push las personas que NO son empleadas.
--
-- push_subscriptions.empleado_id era NOT NULL, y el endpoint de alta rechazaba
-- con 403 "Perfil sin empleado" a cualquiera sin ficha de empleada. En
-- producción los 7 profiles tienen empleado_id en NULL (2 admin, 2 encargada,
-- 3 empleado), así que hoy no se puede suscribir absolutamente nadie: 0 filas
-- en push_subscriptions y 0 en la cola.
--
-- POR QUÉ NO SE ARREGLA LINKEANDO LOS PROFILES A EMPLEADOS: los avisos que ya
-- existen (turno nuevo, turno reprogramado, liquidación) resuelven a quién
-- notificar por empleado_id. Si al admin se le cuelga una ficha de empleada para
-- "destrabarlo", empieza a recibir cada turno de esa persona antes de recibir
-- una sola de las notificaciones que le interesan. El dueño no es una empleada:
-- la suscripción tiene que colgar de user_id, que ya está en la tabla y ya tiene
-- su índice (push_subscriptions_user_activo_idx).
--
-- empleado_id se conserva y se sigue llenando cuando existe: es lo que hace
-- posible el envío por empleada (queueEmployeeNotification) sin tener que
-- resolver el profile en cada disparo.
--
-- Idempotente: quitar un NOT NULL que ya no está no falla.

BEGIN;

ALTER TABLE "push_subscriptions" ALTER COLUMN "empleado_id" DROP NOT NULL;

COMMIT;
