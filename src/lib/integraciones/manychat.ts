/**
 * Cliente HTTP de ManyChat (WhatsApp).
 *
 * Flujo:
 *   1) createSubscriberByWhatsapp (idempotente — si ya existe lo devuelve)
 *   2) setCustomFieldByName por cada variable que el flow vaya a usar
 *   3) sendFlow disparando el flow configurado para esa sucursal
 *
 * Es best-effort: ningún error de red rompe el flujo del turno. Todo queda
 * registrado en `whatsapp_envios`.
 */

import { getDb } from "@/lib/db/client/postgres";
import {
  integracionesManychat as integracionesManychatTable,
  whatsappEnvios as whatsappEnviosTable,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const BASE_URL = "https://api.manychat.com";

type FieldValue = string | number | boolean | null;

export type ManychatEnvioTipo =
  | "confirmacion"
  | "recordatorio_2h"
  | "cancelacion"
  | "reprogramacion"
  | "prueba";

export interface SendManychatFlowOpts {
  sucursalId: string;
  telefonoE164: string;
  primerNombre: string;
  apellido?: string;
  tipo: ManychatEnvioTipo;
  /** Override del flow namespace; si no se pasa se resuelve del tipo */
  flowNs?: string;
  customFields?: Record<string, FieldValue>;
  turnoId?: string;
  clienteId?: string;
}

export interface SendManychatFlowResult {
  ok: boolean;
  subscriberId?: number | string;
  error?: string;
}

async function callManychat<T = unknown>(args: {
  apiKey: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
}): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const method = args.method ?? "POST";
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${args.path}`, {
      method,
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: method === "POST" ? JSON.stringify(args.body ?? {}) : undefined,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  const text = await res.text();
  let data: T | undefined;
  try {
    data = text ? (JSON.parse(text) as T) : undefined;
  } catch {
    // ManyChat devolvió algo que no es JSON (típicamente una página HTML
    // de error). Surface el status code y un extracto del cuerpo.
  }

  if (!res.ok || data === undefined) {
    const apiMessage =
      data && typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : null;
    const snippet = text.slice(0, 160).replace(/\s+/g, " ").trim();
    return {
      ok: false,
      status: res.status,
      error: apiMessage ?? `HTTP ${res.status} ${args.path} — ${snippet}`,
      data,
    };
  }

  // ManyChat suele devolver { status: "success" | "error", message?: string, details?: {...} }.
  if (
    data &&
    typeof data === "object" &&
    "status" in data &&
    (data as { status?: string }).status === "error"
  ) {
    const obj = data as { message?: string; details?: unknown };
    const detailsStr = obj.details
      ? ` — ${JSON.stringify(obj.details).slice(0, 200)}`
      : "";
    return {
      ok: false,
      status: res.status,
      error: `${obj.message ?? "ManyChat respondió error"}${detailsStr}`,
      data,
    };
  }

  return { ok: true, status: res.status, data };
}

function pickFlowNs(
  tipo: ManychatEnvioTipo,
  config: typeof integracionesManychatTable.$inferSelect,
): string | null {
  switch (tipo) {
    case "confirmacion":
      return config.flowNsConfirmacion ?? null;
    case "recordatorio_2h":
      return config.flowNsRecordatorio2h ?? null;
    case "cancelacion":
      return config.flowNsCancelacion ?? null;
    case "reprogramacion":
      return config.flowNsReprogramacion ?? null;
    case "prueba":
      return config.flowNsConfirmacion ?? null;
  }
}

export async function sendManychatFlow(
  opts: SendManychatFlowOpts,
): Promise<SendManychatFlowResult> {
  const db = getDb();
  const [config] = await db
    .select()
    .from(integracionesManychatTable)
    .where(eq(integracionesManychatTable.sucursalId, opts.sucursalId))
    .limit(1);

  if (!config || !config.activo) {
    await logEnvio({
      sucursalId: opts.sucursalId,
      turnoId: opts.turnoId,
      clienteId: opts.clienteId,
      telefono: opts.telefonoE164,
      tipo: opts.tipo,
      flowNs: opts.flowNs ?? null,
      ok: false,
      error: "Integración inactiva o no configurada",
      payload: { customFields: opts.customFields },
    });
    return { ok: false, error: "Integración inactiva o no configurada" };
  }

  const flowNs = opts.flowNs ?? pickFlowNs(opts.tipo, config);
  if (!flowNs) {
    await logEnvio({
      sucursalId: opts.sucursalId,
      turnoId: opts.turnoId,
      clienteId: opts.clienteId,
      telefono: opts.telefonoE164,
      tipo: opts.tipo,
      flowNs: null,
      ok: false,
      error: `No hay flow configurado para tipo "${opts.tipo}"`,
      payload: { customFields: opts.customFields },
    });
    return { ok: false, error: "No hay flow configurado para ese tipo" };
  }

  // 1) Buscar el subscriber por número (si ya existe lo reusamos);
  //    si no existe, crearlo. ManyChat tira error al crear duplicados, así
  //    que el orden find → create evita la mitad de los fallos.
  const subscriberId = await resolveOrCreateSubscriber({
    apiKey: config.apiKey,
    telefonoE164: opts.telefonoE164,
    primerNombre: opts.primerNombre,
    apellido: opts.apellido,
  });

  if (!subscriberId.ok || !subscriberId.id) {
    await logEnvio({
      sucursalId: opts.sucursalId,
      turnoId: opts.turnoId,
      clienteId: opts.clienteId,
      telefono: opts.telefonoE164,
      tipo: opts.tipo,
      flowNs,
      ok: false,
      error: subscriberId.error ?? "No se pudo resolver el subscriber",
      payload: { customFields: opts.customFields },
    });
    return { ok: false, error: subscriberId.error };
  }

  const subId = subscriberId.id;

  // 2) Setear custom fields uno por uno (idempotente).
  if (opts.customFields) {
    await Promise.all(
      Object.entries(opts.customFields).map(([field_name, field_value]) =>
        callManychat({
          apiKey: config.apiKey,
          path: "/fb/subscriber/setCustomFieldByName",
          body: { subscriber_id: subId, field_name, field_value },
        }),
      ),
    );
  }

  // 3) Disparar el flow.
  const flowRes = await callManychat<{ status: string }>({
    apiKey: config.apiKey,
    path: "/fb/sending/sendFlow",
    body: { subscriber_id: subId, flow_ns: flowNs },
  });

  await logEnvio({
    sucursalId: opts.sucursalId,
    turnoId: opts.turnoId,
    clienteId: opts.clienteId,
    telefono: opts.telefonoE164,
    tipo: opts.tipo,
    flowNs,
    ok: flowRes.ok,
    error: flowRes.ok ? null : flowRes.error ?? null,
    payload: { customFields: opts.customFields, subscriberId: subId },
    respuesta: flowRes.data,
  });

  return {
    ok: flowRes.ok,
    subscriberId: subId,
    error: flowRes.ok ? undefined : flowRes.error,
  };
}

/**
 * Variantes del número AR para buscar en ManyChat.
 * En Argentina, WhatsApp/ManyChat habitualmente guardan el número SIN el "9"
 * (`+541155556666`), aunque nuestro E.164 lo incluye (`+5491155556666`).
 * También probamos sin el "+" porque algunas instalaciones lo guardan así.
 */
function variantesTelefono(e164: string): string[] {
  const variantes = new Set<string>([e164]);
  // Quitar el "9" después de "+54" si existe.
  if (e164.startsWith("+549")) {
    variantes.add("+54" + e164.slice(4));
  }
  // Versiones sin "+".
  for (const v of Array.from(variantes)) {
    variantes.add(v.replace(/^\+/, ""));
  }
  return Array.from(variantes);
}

async function resolveOrCreateSubscriber(args: {
  apiKey: string;
  telefonoE164: string;
  primerNombre: string;
  apellido?: string;
}): Promise<{ ok: boolean; id?: number | string; error?: string }> {
  const candidatos = variantesTelefono(args.telefonoE164);
  const findErrors: string[] = [];

  for (const tel of candidatos) {
    const res = await callManychat<{ data?: { id: number | string } }>({
      apiKey: args.apiKey,
      method: "GET",
      path: `/fb/subscriber/findBySystemField?phone=${encodeURIComponent(tel)}`,
    });
    if (res.ok && res.data?.data?.id) {
      return { ok: true, id: res.data.data.id };
    }
    if (res.error) findErrors.push(`find(${tel}): ${res.error}`);
  }

  // Intentar crear (requiere "API import" habilitado en ManyChat).
  const createRes = await callManychat<{ data?: { id: number | string } }>({
    apiKey: args.apiKey,
    path: "/fb/subscriber/createSubscriber",
    body: {
      first_name: args.primerNombre,
      last_name: args.apellido ?? "",
      whatsapp_phone: args.telefonoE164,
      consent_phrase:
        "El usuario aceptó recibir notificaciones de MALALA por WhatsApp",
      has_opt_in_sms: false,
      has_opt_in_email: false,
    },
  });

  if (createRes.ok && createRes.data?.data?.id) {
    return { ok: true, id: createRes.data.data.id };
  }

  const createError = createRes.error ? `create: ${createRes.error}` : null;
  return {
    ok: false,
    error: [createError, ...findErrors].filter(Boolean).join(" | "),
  };
}

async function logEnvio(args: {
  sucursalId: string;
  turnoId?: string;
  clienteId?: string;
  telefono: string;
  tipo: ManychatEnvioTipo;
  flowNs: string | null;
  ok: boolean;
  error?: string | null;
  payload?: unknown;
  respuesta?: unknown;
}) {
  try {
    const db = getDb();
    await db.insert(whatsappEnviosTable).values({
      id: crypto.randomUUID(),
      sucursalId: args.sucursalId,
      turnoId: args.turnoId ?? null,
      clienteId: args.clienteId ?? null,
      telefonoDestinoE164: args.telefono,
      tipo: args.tipo,
      estado: args.ok ? "ok" : "error",
      flowNs: args.flowNs,
      payload: (args.payload as Record<string, unknown>) ?? null,
      respuesta: (args.respuesta as Record<string, unknown>) ?? null,
      errorDetalle: args.error ?? null,
    });
  } catch {
    // intencional: el log de WhatsApp no debe romper la operación principal
  }
}

export function buildMagicLink(token: string): string {
  const base =
    process.env.MALALA_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/turno/${token}`;
}

export function splitName(fullName: string): { primer: string; apellido: string } {
  const parts = fullName.trim().split(/\s+/);
  const primer = parts[0] ?? fullName;
  const apellido = parts.slice(1).join(" ");
  return { primer, apellido };
}
