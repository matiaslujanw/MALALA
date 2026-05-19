-- Setup del cron de recordatorios 2h antes del turno.
--
-- Requiere extensiones pg_cron y pg_net habilitadas en el proyecto Supabase
-- (Dashboard → Database → Extensions).
--
-- Antes de aplicar, reemplazar:
--   <APP_URL>    → https://tu-dominio.com  (sin barra final)
--   <CRON_SECRET> → el mismo valor que tenés en la env var CRON_SECRET del
--                   deployment de Next.js

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Borra job previo si existe (idempotente).
DO $$
BEGIN
  PERFORM cron.unschedule('malala_recordatorios_2h');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Cada 15 minutos llama al endpoint con el bearer secreto.
SELECT cron.schedule(
  'malala_recordatorios_2h',
  '*/15 * * * *',
  $cron$
    SELECT net.http_post(
      url     := '<APP_URL>/api/cron/recordatorios-2h',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <CRON_SECRET>',
        'Content-Type',  'application/json'
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cron$
);

-- Para verificar:
--   SELECT * FROM cron.job WHERE jobname = 'malala_recordatorios_2h';
--   SELECT * FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'malala_recordatorios_2h')
--    ORDER BY start_time DESC LIMIT 10;
