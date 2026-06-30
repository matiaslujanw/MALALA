/**
 * Cliente de WhatsApp vía worker Baileys.
 *
 * Reemplaza al viejo cliente de ManyChat. En vez de disparar un "flow" remoto,
 * arma el texto del mensaje (ver `notificaciones-turno.ts`) y lo manda al worker
 * persistente (`worker/`), que mantiene una sesión de WhatsApp por sucursal.
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

export type WhatsappEnvioTipo =
  | "confirmacion"
  | "recordatorio_2h"
  | "cancelacion"
  | "reprogramacion"
  | "prueba";

export interface SendWhatsappOpts {
  sucursalId: string;
  telefonoE164: string;
  mensaje: string;
  tipo: WhatsappEnvioTipo;
  turnoId?: string;
  clienteId?: string;
}

export interface SendWhatsappResult {
  ok: boolean;
  error?: string;
}

function workerConfig(): { url: string; secret: string } | null {
  const url = process.env.WHATSAPP_WORKER_URL;
  const secret = process.env.WHATSAPP_WORKER_SECRET;
  if (!url || !secret) return null;
  return { url: url.replace(/\/$/, ""), secret };
}

export async function sendWhatsappMessage(
  opts: SendWhatsappOpts,
): Promise<SendWhatsappResult> {
  const db = getDb();

  // Gate por sucursal: reusamos la tabla `integraciones_manychat` sólo como
  // flag de activación (apiKey/flowNs quedaron obsoletos con Baileys).
  const [config] = await db
    .select()
    .from(integracionesManychatTable)
    .where(eq(integracionesManychatTable.sucursalId, opts.sucursalId))
    .limit(1);

  if (!config || !config.activo) {
    await logEnvio({ ...opts, ok: false, error: "Integración inactiva o no configurada" });
    return { ok: false, error: "Integración inactiva o no configurada" };
  }

  const worker = workerConfig();
  if (!worker) {
    await logEnvio({
      ...opts,
      ok: false,
      error: "Worker de WhatsApp no configurado (WHATSAPP_WORKER_URL/SECRET)",
    });
    return { ok: false, error: "Worker de WhatsApp no configurado" };
  }

  let result: SendWhatsappResult;
  let respuesta: unknown;
  try {
    const res = await fetch(`${worker.url}/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${worker.secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sucursalId: opts.sucursalId,
        telefonoE164: opts.telefonoE164,
        mensaje: opts.mensaje,
      }),
    });

    const text = await res.text();
    try {
      respuesta = text ? JSON.parse(text) : undefined;
    } catch {
      respuesta = { raw: text.slice(0, 200) };
    }

    if (!res.ok) {
      const apiErr =
        respuesta && typeof respuesta === "object" && "error" in respuesta
          ? String((respuesta as { error: unknown }).error)
          : `HTTP ${res.status}`;
      result = { ok: false, error: apiErr };
    } else {
      result = { ok: true };
    }
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof Error ? err.message : "Error de red con el worker",
    };
  }

  await logEnvio({ ...opts, ok: result.ok, error: result.error ?? null, respuesta });
  return result;
}

async function logEnvio(args: {
  sucursalId: string;
  turnoId?: string;
  clienteId?: string;
  telefonoE164: string;
  tipo: WhatsappEnvioTipo;
  mensaje?: string;
  ok: boolean;
  error?: string | null;
  respuesta?: unknown;
}) {
  try {
    const db = getDb();
    await db.insert(whatsappEnviosTable).values({
      id: crypto.randomUUID(),
      sucursalId: args.sucursalId,
      turnoId: args.turnoId ?? null,
      clienteId: args.clienteId ?? null,
      telefonoDestinoE164: args.telefonoE164,
      tipo: args.tipo,
      estado: args.ok ? "ok" : "error",
      flowNs: null,
      payload: args.mensaje ? { mensaje: args.mensaje } : null,
      respuesta: (args.respuesta as Record<string, unknown>) ?? null,
      errorDetalle: args.error ?? null,
    });
  } catch {
    // intencional: el log de WhatsApp no debe romper la operación principal
  }
}

/**
 * Base URL para los links que van por WhatsApp.
 *
 * - En **localhost** (dev) usa el host del request, aunque `MALALA_PUBLIC_BASE_URL`
 *   apunte a prod — así el link mágico abre tu app local, no producción.
 * - Fuera de localhost prioriza `MALALA_PUBLIC_BASE_URL` (dominio canónico de
 *   prod); si no está, deriva del request.
 */
export async function getBaseUrl(): Promise<string> {
  let host: string | null = null;
  let proto: string | null = null;
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    host = h.get("x-forwarded-host") ?? h.get("host");
    proto = h.get("x-forwarded-proto");
  } catch {
    // headers() no disponible (fuera de un request) → caemos al env.
  }

  const isLocal =
    !!host && (host.startsWith("localhost") || host.startsWith("127.0.0.1"));
  if (isLocal) return `${proto ?? "http"}://${host}`;

  if (process.env.MALALA_PUBLIC_BASE_URL) {
    return process.env.MALALA_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  if (host) return `${proto ?? "https"}://${host}`;
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function buildMagicLink(token: string): Promise<string> {
  const base = await getBaseUrl();
  return `${base}/turno/${token}`;
}

export function splitName(fullName: string): { primer: string; apellido: string } {
  const parts = fullName.trim().split(/\s+/);
  const primer = parts[0] ?? fullName;
  const apellido = parts.slice(1).join(" ");
  return { primer, apellido };
}
