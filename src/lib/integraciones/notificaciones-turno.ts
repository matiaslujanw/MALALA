/**
 * Disparadores de notificaciones de turno por WhatsApp (worker Baileys).
 *
 * Cada función arma el TEXTO del mensaje según el tipo y lo manda con
 * `sendWhatsappMessage`. Si la sucursal no tiene integración activa o falla el
 * envío, queda en `whatsapp_envios` pero no rompe la operación sobre el turno.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client/postgres";
import {
  clientes as clientesTable,
  servicios as serviciosTable,
  sucursales as sucursalesTable,
  turnos as turnosTable,
} from "@/lib/db/schema";
import {
  sendWhatsappMessage,
  buildMagicLink,
  type WhatsappEnvioTipo,
} from "./whatsapp";

function formatFechaAR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface MensajeData {
  nombre: string;
  sucursal: string;
  servicio: string;
  fecha: string;
  hora: string;
  duracionMin: number;
  link: string;
}

/** Plantillas de texto por tipo de notificación. */
export function buildMensaje(tipo: WhatsappEnvioTipo, d: MensajeData): string {
  switch (tipo) {
    case "confirmacion":
      return (
        `Hola ${d.nombre} 👋 Confirmamos tu turno en *${d.sucursal}*.\n` +
        `📅 ${d.fecha} a las ${d.hora} hs\n` +
        `💇 ${d.servicio} (${d.duracionMin} min)\n\n` +
        `Gestioná tu turno acá: ${d.link}`
      );
    case "recordatorio_2h":
      return (
        `Hola ${d.nombre} ⏰ Te recordamos tu turno de hoy en *${d.sucursal}*.\n` +
        `📅 ${d.fecha} a las ${d.hora} hs\n` +
        `💇 ${d.servicio}\n\n` +
        `Si no podés venir, avisanos acá: ${d.link}`
      );
    case "cancelacion":
      return (
        `Hola ${d.nombre}, tu turno en *${d.sucursal}* del ${d.fecha} a las ` +
        `${d.hora} hs (${d.servicio}) fue *cancelado*.\n\n` +
        `Para sacar uno nuevo: ${d.link}`
      );
    case "reprogramacion":
      return (
        `Hola ${d.nombre}, tu turno en *${d.sucursal}* fue *reprogramado*.\n` +
        `📅 Nueva fecha: ${d.fecha} a las ${d.hora} hs\n` +
        `💇 ${d.servicio}\n\n` +
        `Ver detalle: ${d.link}`
      );
    case "prueba":
      return `Mensaje de prueba MALALA ✅ Hola ${d.nombre}, la integración de WhatsApp funciona.`;
  }
}

export async function notificarTurno(args: {
  turnoId: string;
  tipo: WhatsappEnvioTipo;
}) {
  const db = getDb();
  const [row] = await db
    .select({
      turno: turnosTable,
      cliente: clientesTable,
      servicio: serviciosTable,
      sucursal: sucursalesTable,
    })
    .from(turnosTable)
    .innerJoin(clientesTable, eq(turnosTable.clienteId, clientesTable.id))
    .innerJoin(serviciosTable, eq(turnosTable.servicioId, serviciosTable.id))
    .innerJoin(sucursalesTable, eq(turnosTable.sucursalId, sucursalesTable.id))
    .where(eq(turnosTable.id, args.turnoId))
    .limit(1);

  if (!row) return { ok: false, error: "Turno no encontrado" };

  const telefono = row.cliente.telefonoE164;
  if (!telefono) {
    return { ok: false, error: "El cliente no tiene teléfono normalizado" };
  }

  const mensaje = buildMensaje(args.tipo, {
    nombre: row.cliente.nombre,
    sucursal: row.sucursal.nombre,
    servicio: row.servicio.nombre,
    fecha: formatFechaAR(row.turno.fechaTurno),
    hora: row.turno.hora,
    duracionMin: row.turno.duracionMin,
    link: await buildMagicLink(row.turno.tokenAcceso),
  });

  const result = await sendWhatsappMessage({
    sucursalId: row.turno.sucursalId,
    telefonoE164: telefono,
    mensaje,
    tipo: args.tipo,
    turnoId: row.turno.id,
    clienteId: row.cliente.id,
  });

  if (result.ok && args.tipo === "confirmacion") {
    await db
      .update(turnosTable)
      .set({ confirmacionEnviadaEn: new Date() })
      .where(eq(turnosTable.id, row.turno.id));
  }
  if (result.ok && args.tipo === "recordatorio_2h") {
    await db
      .update(turnosTable)
      .set({ recordatorio2hEnviadoEn: new Date() })
      .where(eq(turnosTable.id, row.turno.id));
  }

  return result;
}
