/**
 * Disparadores de notificaciones de turno por WhatsApp (ManyChat).
 *
 * Cada función arma los custom fields esperados por los flows configurados
 * en ManyChat y llama a `sendManychatFlow`. Si la sucursal no tiene
 * integración activa o falla el envío, queda en `whatsapp_envios` pero no
 * rompe la operación principal sobre el turno.
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
  sendManychatFlow,
  buildMagicLink,
  splitName,
  type ManychatEnvioTipo,
} from "./manychat";

function formatFechaAR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export async function notificarTurno(args: {
  turnoId: string;
  tipo: ManychatEnvioTipo;
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

  const { primer, apellido } = splitName(row.cliente.nombre);

  const result = await sendManychatFlow({
    sucursalId: row.turno.sucursalId,
    telefonoE164: telefono,
    primerNombre: primer,
    apellido,
    tipo: args.tipo,
    turnoId: row.turno.id,
    clienteId: row.cliente.id,
    customFields: {
      nombre: row.cliente.nombre,
      sucursal: row.sucursal.nombre,
      servicio: row.servicio.nombre,
      fecha: formatFechaAR(row.turno.fechaTurno),
      hora: row.turno.hora,
      duracion_min: row.turno.duracionMin,
      link_magico: buildMagicLink(row.turno.tokenAcceso),
    },
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
