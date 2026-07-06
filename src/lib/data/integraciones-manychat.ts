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
import { sendWhatsappMessage, splitName } from "@/lib/integraciones/whatsapp";
import { buildMensaje } from "@/lib/integraciones/notificaciones-turno";

export interface IntegracionManychatRow {
  sucursal_id: string;
  sucursal_nombre: string;
  numero_whatsapp_e164: string | null;
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
      numero_whatsapp_e164: integ?.numeroWhatsappE164 ?? null,
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

  const db = getDb();
  const [actual] = await db
    .select()
    .from(integracionesManychatTable)
    .where(eq(integracionesManychatTable.sucursalId, sucursalId))
    .limit(1);

  const parsed = integracionManychatSchema.safeParse({
    sucursal_id: sucursalId,
    numero_whatsapp: formData.get("numero_whatsapp"),
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
        numeroWhatsappE164: numeroE164,
        activo: parsed.data.activo,
        actualizadoEn: now,
      })
      .where(eq(integracionesManychatTable.sucursalId, sucursalId));
  } else {
    await db.insert(integracionesManychatTable).values({
      sucursalId,
      // apiKey/flowNs quedaron obsoletos con Baileys; la columna apiKey es
      // NOT NULL en el schema, así que insertamos vacío.
      apiKey: "",
      numeroWhatsappE164: numeroE164,
      activo: parsed.data.activo,
    });
  }

  revalidatePath("/catalogos/whatsapp");
  return { ok: true };
}

export type PruebaResult =
  | { ok: true }
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
  const { primer } = splitName(parsed.data.nombre_destino);

  const res = await sendWhatsappMessage({
    sucursalId: parsed.data.sucursal_id,
    telefonoE164: telefono,
    tipo: "prueba",
    mensaje: buildMensaje("prueba", {
      nombre: primer,
      sucursal: "",
      servicio: "",
      fecha: "",
      hora: "",
      duracionMin: 0,
      link: "",
    }),
  });

  if (!res.ok) {
    return { ok: false, errors: { _: [res.error ?? "Error al enviar"] } };
  }
  return { ok: true };
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
