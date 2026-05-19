"use server";

import { eq, inArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import {
  integracionesManychat as integracionesManychatTable,
  sucursales as sucursalesTable,
  whatsappEnvios as whatsappEnviosTable,
} from "@/lib/db/schema";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import {
  failure,
  fieldErrors,
  requireRole,
  type ActionResult,
} from "./_helpers";
import {
  integracionManychatSchema,
  pruebaManychatSchema,
} from "@/lib/validations/integracion-manychat";
import { normalizarTelefonoAR } from "@/lib/phone";
import {
  sendManychatFlow,
  buildMagicLink,
  splitName,
} from "@/lib/integraciones/manychat";

export interface IntegracionManychatRow {
  sucursal_id: string;
  sucursal_nombre: string;
  api_key_set: boolean;
  numero_whatsapp_e164: string | null;
  flow_ns_confirmacion: string | null;
  flow_ns_recordatorio_2h: string | null;
  flow_ns_cancelacion: string | null;
  flow_ns_reprogramacion: string | null;
  activo: boolean;
  actualizado_en?: string;
}

export async function listIntegracionesManychat(): Promise<IntegracionManychatRow[]> {
  const user = await requireRole(["admin", "encargada"]);
  const scope = buildAccessScope(user);

  const db = getDb();
  const sucursales = await db
    .select()
    .from(sucursalesTable)
    .where(inArray(sucursalesTable.id, scope.sucursalIdsPermitidas));

  if (sucursales.length === 0) return [];

  const integraciones = await db
    .select()
    .from(integracionesManychatTable)
    .where(
      inArray(
        integracionesManychatTable.sucursalId,
        sucursales.map((s) => s.id),
      ),
    );

  const byId = new Map(integraciones.map((i) => [i.sucursalId, i]));

  return sucursales.map((s) => {
    const integ = byId.get(s.id);
    return {
      sucursal_id: s.id,
      sucursal_nombre: s.nombre,
      api_key_set: Boolean(integ?.apiKey),
      numero_whatsapp_e164: integ?.numeroWhatsappE164 ?? null,
      flow_ns_confirmacion: integ?.flowNsConfirmacion ?? null,
      flow_ns_recordatorio_2h: integ?.flowNsRecordatorio2h ?? null,
      flow_ns_cancelacion: integ?.flowNsCancelacion ?? null,
      flow_ns_reprogramacion: integ?.flowNsReprogramacion ?? null,
      activo: integ?.activo ?? false,
      actualizado_en: integ?.actualizadoEn?.toISOString(),
    };
  });
}

export async function upsertIntegracionManychatAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "encargada"]);
  const scope = buildAccessScope(user);

  const sucursalId = String(formData.get("sucursal_id") ?? "");
  if (!isSucursalAllowed(scope, sucursalId)) {
    return failure("No tenés acceso a esa sucursal");
  }

  // Si el campo api_key viene vacío, conservar el anterior (no pisarlo con blank).
  const db = getDb();
  const [actual] = await db
    .select()
    .from(integracionesManychatTable)
    .where(eq(integracionesManychatTable.sucursalId, sucursalId))
    .limit(1);

  const apiKeyInput = String(formData.get("api_key") ?? "").trim();
  const apiKey = apiKeyInput || actual?.apiKey || "";

  const parsed = integracionManychatSchema.safeParse({
    sucursal_id: sucursalId,
    api_key: apiKey,
    numero_whatsapp: formData.get("numero_whatsapp"),
    flow_ns_confirmacion: formData.get("flow_ns_confirmacion"),
    flow_ns_recordatorio_2h: formData.get("flow_ns_recordatorio_2h"),
    flow_ns_cancelacion: formData.get("flow_ns_cancelacion"),
    flow_ns_reprogramacion: formData.get("flow_ns_reprogramacion"),
    activo:
      formData.get("activo") === "on" || formData.get("activo") === "true",
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const numeroE164 = normalizarTelefonoAR(parsed.data.numero_whatsapp);
  const now = new Date();

  if (actual) {
    await db
      .update(integracionesManychatTable)
      .set({
        apiKey: parsed.data.api_key,
        numeroWhatsappE164: numeroE164,
        flowNsConfirmacion: parsed.data.flow_ns_confirmacion ?? null,
        flowNsRecordatorio2h: parsed.data.flow_ns_recordatorio_2h ?? null,
        flowNsCancelacion: parsed.data.flow_ns_cancelacion ?? null,
        flowNsReprogramacion: parsed.data.flow_ns_reprogramacion ?? null,
        activo: parsed.data.activo,
        actualizadoEn: now,
      })
      .where(eq(integracionesManychatTable.sucursalId, sucursalId));
  } else {
    await db.insert(integracionesManychatTable).values({
      sucursalId,
      apiKey: parsed.data.api_key,
      numeroWhatsappE164: numeroE164,
      flowNsConfirmacion: parsed.data.flow_ns_confirmacion ?? null,
      flowNsRecordatorio2h: parsed.data.flow_ns_recordatorio_2h ?? null,
      flowNsCancelacion: parsed.data.flow_ns_cancelacion ?? null,
      flowNsReprogramacion: parsed.data.flow_ns_reprogramacion ?? null,
      activo: parsed.data.activo,
    });
  }

  revalidatePath("/configuracion/integraciones-whatsapp");
  return { ok: true };
}

export type PruebaResult =
  | { ok: true; subscriberId: string }
  | { ok: false; errors: Record<string, string[]> };

export async function enviarMensajePruebaAction(
  _prev: PruebaResult | null,
  formData: FormData,
): Promise<PruebaResult> {
  const user = await requireRole(["admin", "encargada"]);
  const scope = buildAccessScope(user);

  const parsed = pruebaManychatSchema.safeParse({
    sucursal_id: formData.get("sucursal_id"),
    telefono_destino: formData.get("telefono_destino"),
    nombre_destino: formData.get("nombre_destino") ?? "Test",
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }
  if (!isSucursalAllowed(scope, parsed.data.sucursal_id)) {
    return { ok: false, errors: { _: ["No tenés acceso a esa sucursal"] } };
  }

  const telefono = normalizarTelefonoAR(parsed.data.telefono_destino);
  const { primer, apellido } = splitName(parsed.data.nombre_destino);

  const res = await sendManychatFlow({
    sucursalId: parsed.data.sucursal_id,
    telefonoE164: telefono,
    primerNombre: primer,
    apellido,
    tipo: "prueba",
    customFields: {
      nombre: primer,
      link_magico: buildMagicLink("prueba"),
      mensaje: "Mensaje de prueba MALALA",
    },
  });

  if (!res.ok) {
    return { ok: false, errors: { _: [res.error ?? "Error al enviar"] } };
  }
  return { ok: true, subscriberId: String(res.subscriberId ?? "") };
}

export interface UltimoEnvioRow {
  id: string;
  tipo: string;
  estado: string;
  enviado_en: string;
  telefono: string;
  error?: string;
}

export async function listUltimosEnvios(
  sucursalId: string,
  limit = 10,
): Promise<UltimoEnvioRow[]> {
  const user = await requireRole(["admin", "encargada"]);
  const scope = buildAccessScope(user);
  if (!isSucursalAllowed(scope, sucursalId)) return [];

  const db = getDb();
  const rows = await db
    .select()
    .from(whatsappEnviosTable)
    .where(eq(whatsappEnviosTable.sucursalId, sucursalId))
    .orderBy(desc(whatsappEnviosTable.enviadoEn))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    estado: r.estado,
    enviado_en: r.enviadoEn.toISOString(),
    telefono: r.telefonoDestinoE164,
    error: r.errorDetalle ?? undefined,
  }));
}
