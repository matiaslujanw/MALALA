"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { createPrivateKey, sign } from "node:crypto";
import { getDb } from "@/lib/db/client/postgres";
import {
  empleados as empleadosTable,
  liquidaciones as liquidacionesTable,
  pushNotificationQueue as pushNotificationQueueTable,
  pushSubscriptions as pushSubscriptionsTable,
  servicios as serviciosTable,
  sucursales as sucursalesTable,
  turnos as turnosTable,
} from "@/lib/db/schema";
import {
  getVapidPrivateKey,
  getVapidPublicKey,
  getVapidSubject,
  isWebPushConfigured,
} from "@/lib/db/env";
import { formatARS } from "@/lib/utils";

function createId() {
  return crypto.randomUUID();
}

function base64UrlToBuffer(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function bufferToBase64Url(input: Buffer | Uint8Array): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function derToJose(signature: Buffer, size: number) {
  let offset = 0;
  if (signature[offset++] !== 0x30) {
    throw new Error("Firma ECDSA inválida");
  }

  const seqLen = signature[offset++];
  if (seqLen & 0x80) {
    offset += seqLen & 0x7f;
  }

  if (signature[offset++] !== 0x02) {
    throw new Error("Firma ECDSA inválida");
  }
  const rLen = signature[offset++];
  let r = signature.subarray(offset, offset + rLen);
  offset += rLen;

  if (signature[offset++] !== 0x02) {
    throw new Error("Firma ECDSA inválida");
  }
  const sLen = signature[offset++];
  let s = signature.subarray(offset, offset + sLen);

  while (r.length > 0 && r[0] === 0) r = r.subarray(1);
  while (s.length > 0 && s[0] === 0) s = s.subarray(1);

  const out = Buffer.alloc(size * 2);
  r.copy(out, size - r.length);
  s.copy(out, size * 2 - s.length);
  return out;
}

function getVapidPrivateKeyObject() {
  const publicKey = base64UrlToBuffer(getVapidPublicKey());
  const privateKey = base64UrlToBuffer(getVapidPrivateKey());
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY inválida");
  }
  if (privateKey.length !== 32) {
    throw new Error("VAPID_PRIVATE_KEY inválida");
  }

  return createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: bufferToBase64Url(publicKey.subarray(1, 33)),
      y: bufferToBase64Url(publicKey.subarray(33, 65)),
      d: bufferToBase64Url(privateKey),
    },
    format: "jwk",
  });
}

function buildVapidJwt(audience: string) {
  const header = bufferToBase64Url(
    Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })),
  );
  const payload = bufferToBase64Url(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
        sub: getVapidSubject(),
      }),
    ),
  );
  const body = `${header}.${payload}`;
  const der = sign("sha256", Buffer.from(body), getVapidPrivateKeyObject());
  const jose = bufferToBase64Url(derToJose(der, 32));
  return `${body}.${jose}`;
}

async function deactivateSubscription(endpoint: string) {
  const db = getDb();
  await db
    .update(pushSubscriptionsTable)
    .set({
      activo: false,
      updatedAt: new Date(),
    })
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));
}

async function sendPushPing(endpoint: string) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = buildVapidJwt(audience);
  const vapidPublicKey = getVapidPublicKey();

  const res = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      TTL: "60",
      Urgency: "high",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Crypto-Key": `p256ecdsa=${vapidPublicKey}`,
    },
  });

  if (res.status === 404 || res.status === 410) {
    await deactivateSubscription(endpoint);
    return;
  }

  if (!res.ok) {
    throw new Error(`Push HTTP ${res.status}`);
  }
}

interface QueuePayload {
  titulo: string;
  cuerpo: string;
  url: string;
  tipo: string;
}

async function queueEmployeeNotification(
  empleadoId: string,
  payload: QueuePayload,
) {
  if (!isWebPushConfigured()) return;

  const db = getDb();
  const subscriptions = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.empleadoId, empleadoId),
        eq(pushSubscriptionsTable.activo, true),
      ),
    );

  if (subscriptions.length === 0) return;

  const now = new Date();
  await db.insert(pushNotificationQueueTable).values(
    subscriptions.map((subscription) => ({
      id: createId(),
      subscriptionId: subscription.id,
      titulo: payload.titulo,
      cuerpo: payload.cuerpo,
      url: payload.url,
      tipo: payload.tipo,
      createdAt: now,
    })),
  );

  await Promise.allSettled(
    subscriptions.map((subscription) => sendPushPing(subscription.endpoint)),
  );
}

function formatYmd(ymd: string) {
  const [year, month, day] = ymd.split("-");
  return `${day}/${month}/${year}`;
}

export async function notificarTurnoEmpleadoPush(args: {
  turnoId: string;
  tipo: "creado" | "reprogramado" | "cancelado";
}) {
  if (!isWebPushConfigured()) return;

  const db = getDb();
  const [row] = await db
    .select({
      turno: turnosTable,
      empleado: empleadosTable,
      servicio: serviciosTable,
      sucursal: sucursalesTable,
    })
    .from(turnosTable)
    .innerJoin(empleadosTable, eq(turnosTable.profesionalId, empleadosTable.id))
    .innerJoin(serviciosTable, eq(turnosTable.servicioId, serviciosTable.id))
    .innerJoin(sucursalesTable, eq(turnosTable.sucursalId, sucursalesTable.id))
    .where(eq(turnosTable.id, args.turnoId))
    .limit(1);

  if (!row) return;

  const fechaHora = `${formatYmd(row.turno.fechaTurno)} ${row.turno.hora}`;
  const titulo =
    args.tipo === "creado"
      ? "Nuevo turno asignado"
      : args.tipo === "reprogramado"
        ? "Turno reprogramado"
        : "Turno cancelado";
  const cuerpo =
    args.tipo === "cancelado"
      ? `${fechaHora} · ${row.servicio.nombre} · ${row.sucursal.nombre}`
      : `${fechaHora} · ${row.servicio.nombre} · ${row.sucursal.nombre}`;

  await queueEmployeeNotification(row.empleado.id, {
    titulo,
    cuerpo,
    url: "/turnos",
    tipo: `turno:${args.tipo}`,
  });
}

export async function notificarLiquidacionEmpleadoPush(args: {
  liquidacionId: string;
}) {
  if (!isWebPushConfigured()) return;

  const db = getDb();
  const [row] = await db
    .select({
      liquidacion: liquidacionesTable,
      empleado: empleadosTable,
    })
    .from(liquidacionesTable)
    .innerJoin(empleadosTable, eq(liquidacionesTable.empleadoId, empleadosTable.id))
    .where(eq(liquidacionesTable.id, args.liquidacionId))
    .limit(1);

  if (!row) return;

  await queueEmployeeNotification(row.empleado.id, {
    titulo: "Nueva liquidacion disponible",
    cuerpo:
      `${formatYmd(row.liquidacion.periodoDesde)} a ` +
      `${formatYmd(row.liquidacion.periodoHasta)} · ` +
      `${formatARS(row.liquidacion.totalPagar)}`,
    url: `/liquidaciones/${row.liquidacion.id}`,
    tipo: "liquidacion:creada",
  });
}

export async function tomarPendientesPorEndpoint(args: {
  endpoint: string;
  userId: string;
}) {
  const db = getDb();
  const [subscription] = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.endpoint, args.endpoint),
        eq(pushSubscriptionsTable.userId, args.userId),
        eq(pushSubscriptionsTable.activo, true),
      ),
    )
    .limit(1);

  if (!subscription) {
    return [];
  }

  const pending = await db
    .select()
    .from(pushNotificationQueueTable)
    .where(
      and(
        eq(pushNotificationQueueTable.subscriptionId, subscription.id),
        isNull(pushNotificationQueueTable.deliveredAt),
      ),
    );

  if (pending.length === 0) {
    await db
      .update(pushSubscriptionsTable)
      .set({ lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(pushSubscriptionsTable.id, subscription.id));
    return [];
  }

  const ids = pending.map((item) => item.id);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(pushNotificationQueueTable)
      .set({ deliveredAt: now })
      .where(inArray(pushNotificationQueueTable.id, ids));

    await tx
      .update(pushSubscriptionsTable)
      .set({ lastSeenAt: now, updatedAt: now })
      .where(eq(pushSubscriptionsTable.id, subscription.id));
  });

  return pending.map((item) => ({
    id: item.id,
    titulo: item.titulo,
    cuerpo: item.cuerpo,
    url: item.url,
    tipo: item.tipo,
  }));
}
