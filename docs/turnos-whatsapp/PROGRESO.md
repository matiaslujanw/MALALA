# Turnos + WhatsApp (ManyChat) — Progreso

Documento vivo. Se actualiza a medida que avanzan las fases.

## Decisiones de producto

| Decisión | Valor |
|---|---|
| Proveedor WA saliente | ManyChat API (Send Flow) |
| Setup ManyChat | 2 cuentas separadas (una por sucursal) |
| Cliente público | Reutilizar tabla `clientes` + teléfono único |
| Política de nombre en duplicado | Sobreescribir con el último ingresado |
| Magic link | Token por turno, expira en la hora exacta del turno, multiuso |
| Recordatorios | 2h antes del turno (+ confirmación inmediata + avisos en cancelar/reprogramar) |
| Formato teléfono | E.164 Argentina (`+549...`) |
| Cron | Supabase `pg_cron` + `pg_net` (gratis, ya tenemos Supabase) |
| Legacy `turnos.cliente_*` | Se eliminan, se reemplazan por FK `cliente_id` |

## Plan por fases

### Fase 1 — Modelo de datos + dedupe cliente por teléfono
- [x] Lib normalización teléfono AR (E.164)
- [x] `clientes.telefono_e164` con índice único parcial
- [x] `turnos`: drop `cliente_nombre/cliente_telefono/cliente_email`, add `cliente_id` FK
- [x] `turnos`: add `token_acceso`, `token_expira_en`, `confirmacion_enviada_en`, `recordatorio_2h_enviado_en`
- [x] Tabla `integraciones_manychat` (config por sucursal)
- [x] Tabla `whatsapp_envios` (bitácora)
- [x] Validations actualizadas
- [x] `turnos-actions` con upsert cliente por teléfono
- [x] Migración SQL + backfill

### Fase 2 — Magic link público
- [x] Página `/turno/[token]` (server component, sin auth)
- [x] Server actions públicas `cancelarTurnoPorTokenAction`, `reprogramarTurnoPorTokenAction`
- [x] Validación de token + expiración + estado del turno
- [x] Endpoint API `/api/turno-publico/slots` para fetcheo dinámico de horarios

### Fase 3 — Integración ManyChat
- [x] Cliente HTTP `src/lib/integraciones/manychat.ts`
- [x] Helper `notificarTurno` que arma payload y dispara el flow correspondiente
- [x] Envío de confirmación al crear turno (admin + público)
- [x] Envío al cancelar/reprogramar (admin + público)
- [x] Pantalla admin `/configuracion/integraciones-whatsapp` con aislamiento por sucursal
- [x] Botón "enviar mensaje de prueba"
- [x] Bitácora de últimos envíos por sucursal

### Fase 4 — Recordatorios automáticos
- [x] Endpoint `/api/cron/recordatorios-2h` protegido con `CRON_SECRET`
- [x] SQL para habilitar `pg_cron` + `pg_net` en Supabase
- [x] Documentar setup del job

## Estado actual

**Fase 1 completada.** `tsc --noEmit` pasa. Migración SQL lista en `drizzle/0000_turnos_whatsapp.sql`.

### Aplicar la migración

Sobre Postgres/Supabase con data existente (preserva turnos y crea clientes faltantes):

```bash
psql "$SUPABASE_DATABASE_URL" -f drizzle/0000_turnos_whatsapp.sql
```

O en un proyecto recién creado, sirve `npm run db:push` también — drizzle-kit
sincroniza el schema directamente desde TypeScript.

### Archivos tocados en Fase 1

- `src/lib/phone.ts` (nuevo) — normalización E.164 AR
- `src/lib/db/schema.ts` — clientes (telefono_e164, email), turnos (cliente_id FK,
  token, timestamps WA), nuevas tablas `integraciones_manychat`, `whatsapp_envios`,
  nuevos enums `whatsapp_envio_tipo`/`whatsapp_envio_estado`
- `src/lib/types.ts` — `Turno` y `Cliente` extendidos
- `src/lib/data/turnos.ts` — `mapTurno` con join a clientes, `mapCliente` exportado
- `src/lib/data/turnos-actions.ts` — normaliza teléfono, upsert cliente por
  E.164, sobreescribe nombre, genera token y `token_expira_en` (hora exacta
  del turno), invalida recordatorio al reprogramar
- `src/lib/data/clientes.ts` — persiste `telefono_e164` y `email`
- `src/lib/validations/cliente.ts` y `turno.ts` — validan teléfono argentino
- `src/lib/data/analytics.ts` — visitas únicas se cuentan por `cliente_id`
- `src/lib/db/seed.ts` y `src/lib/mock/seed.ts` — adaptan datos de prueba
- `src/components/forms/cliente-form.tsx` — campo email nuevo
- `drizzle/0000_turnos_whatsapp.sql` (nuevo) — migración ALTER + backfill

### Notas de la migración

- El backfill usa solo dígitos para deduplicar contra `clientes.telefono`
  existente. La normalización fina a E.164 ocurre la próxima vez que se edite
  cada cliente o se cree un turno con ese teléfono.
- Si un turno legacy no matchea ningún cliente del catálogo, se crea uno
  con id `turno-cli-<turno_id>` y `telefono_e164 = NULL` (se completará al
  primer uso).
- Tokens viejos se generan random; los nuevos turnos usan `crypto.getRandomValues`.

**Fase 2 completada.** `tsc --noEmit` pasa.

### Cómo probar la página pública

1. Aplicar la migración de Fase 1 a la DB.
2. Crear un turno (desde la landing o como admin). En el turno generado verás
   `token_acceso` en la tabla `turnos`.
3. Abrir `http://localhost:3000/turno/<TOKEN>` — debería mostrar el detalle.
4. Probar:
   - Botón **Reprogramar**: seleccionar fecha → aparecen slots disponibles →
     elegir slot → confirmar. El turno actualiza fecha/hora/profesional y
     resetea `recordatorio_2h_enviado_en`.
   - Botón **Cancelar turno**: marca estado `cancelado` y deja `turno_eventos`.
5. Tokens vencidos o turnos en estado terminal (`cancelado`/`completado`/
   `en_curso`/`ausente`) muestran un mensaje informativo, sin acciones.

### Archivos nuevos en Fase 2

- `src/lib/data/turnos-publico.ts` — `getTurnoPorToken`, `getSlotsDisponiblesPorToken`,
  `cancelarTurnoPorTokenAction`, `reprogramarTurnoPorTokenAction`.
- `src/app/turno/[token]/page.tsx` — server component con el detalle.
- `src/app/turno/[token]/turno-acciones.tsx` — client component (cancelar +
  reprogramar con selector de fecha/horarios).
- `src/app/turno/[token]/not-found.tsx` — fallback para link inválido.
- `src/app/api/turno-publico/slots/route.ts` — endpoint GET para slots.

### Notas

- La acción de reprogramar usa el mismo `pg_advisory_xact_lock` que la versión
  admin, así que dos clientes no pueden ocupar el mismo slot al mismo tiempo.
- El profesional por defecto en la reprogramación es el del slot elegido
  (puede cambiar si la sucursal asigna otro disponible). Si el cliente quiere
  conservar al mismo profesional, eso lo hace eligiendo un slot de ese
  profesional en la lista.
- El token sigue siendo el mismo después de reprogramar; sólo se actualiza
  `token_expira_en` a la nueva fecha/hora.

**Fase 3 completada.** `tsc --noEmit` pasa.

### Setup en ManyChat (lo que tiene que hacer cada sucursal)

Una vez por cuenta ManyChat (una por sucursal):

1. **API key**: en ManyChat → Settings → API → copiar el token y pegarlo en
   `/configuracion/integraciones-whatsapp`.
2. **Custom fields** (User Fields) — crear estos como tipo Text:
   - `nombre`
   - `sucursal`
   - `servicio`
   - `fecha`
   - `hora`
   - `duracion_min`
   - `link_magico`
   - `mensaje` (opcional, solo para pruebas)
3. **Flows**: crear un flow por evento (confirmación, recordatorio_2h,
   cancelación, reprogramación). En el cuerpo de cada flow usar las
   variables anteriores con `{{nombre}}`, `{{fecha}} {{hora}}`,
   `{{link_magico}}`, etc.
4. En ManyChat, abrir cada flow → menú "..." → **Get content namespace** →
   copiar el `content...` y pegarlo en el campo correspondiente del form.

### Variables de entorno necesarias

```
MALALA_PUBLIC_BASE_URL=https://tu-dominio.com
# fallback en dev:
# NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Esto se usa para armar el `link_magico` que va en el WhatsApp.

### Archivos nuevos / tocados en Fase 3

- `src/lib/integraciones/manychat.ts` — cliente HTTP, `sendManychatFlow`,
  `buildMagicLink`, `splitName`
- `src/lib/integraciones/notificaciones-turno.ts` — `notificarTurno` (helper
  centralizado que arma custom fields y dispara flow). También setea
  `confirmacion_enviada_en` / `recordatorio_2h_enviado_en` en éxito.
- `src/lib/validations/integracion-manychat.ts`
- `src/lib/data/integraciones-manychat.ts` — `list`, `upsert`, `enviarPrueba`,
  `listUltimosEnvios`. **Aislamiento por sucursal**: cada función filtra por
  `scope.sucursalIdsPermitidas`.
- `src/app/(app)/configuracion/integraciones-whatsapp/page.tsx` — lista las
  sucursales del scope del usuario (admin/encargada), tarjeta por sucursal.
- `.../form.tsx` — edita API key (oculta) + número + 4 flow IDs + activo.
- `.../probar-envio.tsx` — manda un mensaje de prueba al teléfono que el user
  ingrese, usando el flow de confirmación.
- `src/lib/data/turnos-actions.ts` — `await notificarTurno(...)` en crear,
  cancelar (estado→cancelado), reprogramar.
- `src/lib/data/turnos-publico.ts` — `await notificarTurno(...)` en cancelar y
  reprogramar por token.
- `src/components/app-sidebar.tsx` + `src/app/(app)/layout.tsx` — nuevo link
  "WhatsApp" en sidebar (oculto para empleados).

### Aislamiento por sucursal (verificado)

- `listIntegracionesManychat` sólo retorna sucursales en `scope.sucursalIdsPermitidas`.
- `upsertIntegracionManychatAction` valida `isSucursalAllowed` antes de tocar la DB.
- `enviarMensajePruebaAction` también valida.
- `listUltimosEnvios` filtra por `sucursalId` y valida acceso.
- El nav esconde el link para rol `empleado`.

### Cómo se comporta cuando falta config

- `sendManychatFlow` registra el envío como `error` en `whatsapp_envios` y
  retorna `{ ok: false }`. **Nunca tira excepción**, así que un turno se crea
  igual aunque ManyChat no responda o no esté configurado.
- Si no hay flow para el tipo (ej. recordatorio_2h sin flow): mismo
  comportamiento — log con error "No hay flow configurado".

**Fase 4 completada.** `tsc --noEmit` pasa.

### Endpoint cron

`POST /api/cron/recordatorios-2h` (también acepta `GET` para schedulers que sólo
hagan GET).

- **Auth**: header `Authorization: Bearer ${CRON_SECRET}`. Si el header no
  matchea o `CRON_SECRET` no está seteado en env, responde 401.
- **Lógica atómica**: hace un `UPDATE turnos SET recordatorio_2h_enviado_en = NOW()`
  con `RETURNING id` filtrando por:
  - `estado IN ('pendiente','confirmado')`
  - `recordatorio_2h_enviado_en IS NULL`
  - `fecha + hora` (timezone `America/Argentina/Buenos_Aires`) dentro de la
    ventana `[NOW() + 90min, NOW() + 150min]`
  - Esto "reclama" los turnos antes del envío → dos invocaciones simultáneas
    del cron no duplican el mensaje.
- Luego dispara `sendManychatFlow` con tipo `recordatorio_2h` para cada uno.
- Si el envío falla, queda en `whatsapp_envios` con `estado=error`. **No
  reintenta automáticamente** — el operador puede ver el log y reenviar a
  mano desde la pantalla de integración.

Respuesta: `{ ok: true, claimed, sent, errors }`.

### Variables de entorno necesarias

```
CRON_SECRET=<un secreto largo>
MALALA_PUBLIC_BASE_URL=https://tu-dominio.com
```

### Setup del cron en Supabase

1. En el dashboard de Supabase → **Database → Extensions**, habilitar
   `pg_cron` y `pg_net`.
2. Abrir el archivo `supabase/migrations/202605200001_pgcron_recordatorios_2h.sql`,
   reemplazar `<APP_URL>` (sin barra final) y `<CRON_SECRET>` (igual al de
   Next.js).
3. Ejecutar el SQL en el SQL editor de Supabase, o vía `supabase db push` /
   `psql`.
4. Verificar:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'malala_recordatorios_2h';

   SELECT * FROM cron.job_run_details
    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'malala_recordatorios_2h')
    ORDER BY start_time DESC LIMIT 10;
   ```

### Test manual del endpoint

```bash
curl -X POST https://tu-dominio.com/api/cron/recordatorios-2h \
  -H "Authorization: Bearer $CRON_SECRET"
```

Debería responder `{ "ok": true, "claimed": N, "sent": N, "errors": 0 }`.

### Archivos nuevos en Fase 4

- `src/app/api/cron/recordatorios-2h/route.ts` — endpoint con claim atómico.
- `supabase/migrations/202605200001_pgcron_recordatorios_2h.sql` — habilita
  extensiones y agenda el job.

## Fase 5 — Migración a Baileys (reemplazo de ManyChat)

Se reemplazó ManyChat por **Baileys** (WhatsApp Web vía WebSocket, escaneando un
QR). No requiere WhatsApp Business ni aprobación de Meta. `tsc --noEmit` pasa.

### Por qué un worker aparte

Baileys necesita un proceso Node persistente (socket vivo + credenciales en
disco). Vercel (serverless) no puede alojarlo, así que vive en `worker/`, un
paquete Node independiente que se corre con `npm run worker`. La app de Next le
pega por HTTP.

### Arquitectura

- **`worker/`** — multi-sesión: una sesión de WhatsApp **por sucursal**
  (`auth/<sucursalId>/`, gitignored). Endpoints: `GET /status[?sucursal]`,
  `GET /qr?sucursal`, `POST /send` (auth `Bearer WORKER_SECRET`),
  `POST /logout?sucursal`. Reconecta solo salvo logout. Ver `worker/README.md`.
- **`src/lib/integraciones/whatsapp.ts`** — reemplaza a `manychat.ts`.
  `sendWhatsappMessage` chequea el flag `activo` por sucursal (tabla
  `integraciones_manychat`, reusada sólo como on/off), postea al worker y
  registra en `whatsapp_envios`. Best-effort, nunca tira.
- **`notificaciones-turno.ts`** — `buildMensaje(tipo, data)` arma el texto plano
  por tipo (plantillas en código). `notificarTurno` mantiene su firma, así los
  call sites (turnos-actions, turnos-publico) no cambiaron.
- **Cron** `recordatorios-2h` — ahora reusa `notificarTurno` (sin duplicar el
  armado del mensaje); el claim atómico sigue igual.
- **UI** `/configuracion/integraciones-whatsapp` — el form pasó a **número +
  activo**; se agregó el bloque **Conexión WhatsApp** (estado + QR) que consume
  los proxies `GET /api/whatsapp/{status,qr}` (gateados a admin/encargada).

### Variables de entorno nuevas

```
WHATSAPP_WORKER_URL=http://localhost:8787
WHATSAPP_WORKER_SECRET=<secreto largo>   # igual al WORKER_SECRET del worker
MALALA_PUBLIC_BASE_URL=...               # para el link mágico (ya existía)
```

### Producción (importante)

El worker debe estar **prendido 24/7** en un host persistente (Railway/Fly/VPS)
y la carpeta `auth/` en **disco persistente** (volumen). El QR se escanea una
sola vez por sucursal; WhatsApp desvincula dispositivos inactivos ~14 días.

### Quitado

- `src/lib/integraciones/manychat.ts` (cliente ManyChat).
- Campos `api_key` y `flow_ns_*` del form/validación (columnas siguen en la DB,
  sin uso, para no hacer migración destructiva).

## Listo (ManyChat — histórico)

Las 4 fases originales del feature (con ManyChat) están terminadas. Pasos
pendientes del lado del usuario (ahora aplican a Baileys, ver Fase 5):

1. Aplicar `drizzle/0000_turnos_whatsapp.sql` a la DB.
2. Configurar variables de entorno (`MALALA_PUBLIC_BASE_URL`, `CRON_SECRET`).
3. Crear las 2 cuentas ManyChat (una por sucursal), los custom fields y los
   flows según el setup documentado en Fase 3.
4. Cargar API key + flow IDs por sucursal desde
   `/configuracion/integraciones-whatsapp`.
5. Aplicar el SQL de pg_cron con `<APP_URL>` y `<CRON_SECRET>` reemplazados.
6. Mandar un mensaje de prueba desde la pantalla de configuración para
   validar la integración.
