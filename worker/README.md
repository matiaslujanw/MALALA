# MALALA — Worker de WhatsApp (Baileys)

Proceso Node persistente que mantiene **una sesión de WhatsApp por sucursal**
(Baileys / WhatsApp Web) y expone HTTP para que la app envíe mensajes. Es la
pieza que reemplaza a ManyChat.

> **Por qué un proceso aparte:** Baileys necesita un WebSocket vivo y estado de
> sesión en disco. Vercel (serverless) no puede alojarlo. Este worker corre
> donde haya un proceso de larga vida (tu PC en dev; Railway/Fly/VPS en prod).

## Correr en local

```bash
cd worker
npm install
WORKER_SECRET=algo-secreto npm start
```

Variables:

| Var | Default | Descripción |
|---|---|---|
| `WORKER_PORT` | `8787` | Puerto HTTP |
| `WORKER_HOST` | `0.0.0.0` | Interfaz de escucha. En VPS con reverse proxy usar `127.0.0.1` para no exponer el puerto crudo. |
| `WORKER_SECRET` | — | Bearer token que exige `/send` y `/logout`. **Obligatorio.** |
| `WORKER_LOG_LEVEL` | `silent` | Nivel de log de Baileys (`info`, `debug`…) |

## Vincular una sucursal (escanear QR)

El `sucursalId` es el id de la sucursal en la base (el mismo que usa la app).

1. Pedí el QR: abrí `http://localhost:8787/qr?sucursal=<sucursalId>` o mirá la
   terminal del worker (imprime el QR ASCII).
2. En el teléfono del local: WhatsApp → **Dispositivos vinculados → Vincular un
   dispositivo** → escaneá.
3. Verificá: `GET http://localhost:8787/status?sucursal=<sucursalId>` →
   `{ "status": "connected", "numero": "549..." }`.

Se escanea **una sola vez**: las credenciales quedan en `auth/<sucursalId>/` y
reconecta sola al reiniciar.

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/status?sucursal=<id>` | no | Estado de una sesión |
| `GET` | `/status` | no | Estado de todas |
| `GET` | `/qr?sucursal=<id>` | no | QR (PNG data URL); crea la sesión si no existe |
| `POST` | `/send` | sí | Body `{ sucursalId, telefonoE164, mensaje }` |
| `POST` | `/logout?sucursal=<id>` | sí | Desvincula y borra credenciales |

Ejemplo de envío:

```bash
curl -X POST http://localhost:8787/send \
  -H "Authorization: Bearer $WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"sucursalId":"suc-1","telefonoE164":"+5491155556666","mensaje":"Hola!"}'
```

## Troubleshooting

**Versión de Baileys:** usar `7.0.0-rc13` (pineada en `package.json`). La 6.7.x
recibe mensajes pero **no entrega** los envíos (quedan sin `SERVER_ACK`).

**Los envíos no llegan / quedan sin acuse o con acuse `ERROR`:** casi siempre es
una **sesión corrupta** por maltrato — re-vincular muchas veces, correr **dos
workers a la vez** sobre el mismo número (`connectionReplaced`), o saltar de
versión. El número y el teléfono pueden estar perfectos (WhatsApp normal anda, y
la sesión incluso recibe entrantes) y aun así no enviar.

Fix: **re-vínculo limpio** → frená el worker, borrá `auth/<sucursalId>/`,
arrancá **un solo** worker y re-escaneá una vez. En el log, `↪ acuse ... →
DELIVERY_ACK` confirma entrega real.

**Reglas de higiene:** un solo worker por número; no re-vincular sin necesidad;
no correr instancias en paralelo.

**`Closing session: SessionEntry {...}`** en consola: ruido benigno de libsignal
(renegocia el cifrado). Ya se filtra del log.

## Producción

- Worker prendido **24/7** (es el dispositivo vinculado: si está apagado no sale
  nada, y a los ~14 días sin conectar WhatsApp lo desvincula).
- Carpeta `auth/` en **disco persistente** (volumen). Si el FS es efímero, cada
  redeploy obliga a re-escanear.
- Exponé el worker sólo a la app (red privada o `WORKER_SECRET` fuerte). Las
  credenciales en `auth/` dan acceso total a la cuenta de WhatsApp.
