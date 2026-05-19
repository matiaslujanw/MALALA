/**
 * Cron de recordatorios 2h antes del turno.
 *
 * Pensado para correr cada 15 min (idealmente desde Supabase pg_cron, ver
 * `docs/turnos-whatsapp/PROGRESO.md`).
 *
 * Estrategia:
 *  1. Atomicamente marca `recordatorio_2h_enviado_en = NOW()` para los turnos
 *     elegibles (estado pendiente/confirmado, sin recordatorio enviado y con
 *     hora dentro de la ventana [now+90min, now+150min]).
 *  2. Para los ids retornados, dispara el flow ManyChat de tipo
 *     `recordatorio_2h`. Si falla, el error queda registrado en
 *     `whatsapp_envios` (no reintenta — el operador puede ver el log).
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client/postgres";
import {
  clientes as clientesTable,
  servicios as serviciosTable,
  sucursales as sucursalesTable,
  turnos as turnosTable,
} from "@/lib/db/schema";
import {
  buildMagicLink,
  sendManychatFlow,
  splitName,
} from "@/lib/integraciones/manychat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatFechaAR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  const claimed = await db.execute<{ id: string }>(sql`
    UPDATE turnos
    SET recordatorio_2h_enviado_en = NOW()
    WHERE estado IN ('pendiente', 'confirmado')
      AND recordatorio_2h_enviado_en IS NULL
      AND ((fecha_turno || ' ' || hora || ':00')::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
            BETWEEN NOW() + interval '90 minutes' AND NOW() + interval '150 minutes'
    RETURNING id
  `);

  const ids = (claimed as unknown as { rows?: { id: string }[] }).rows
    ?? (claimed as unknown as { id: string }[]);
  const idList = Array.isArray(ids)
    ? ids.map((r: { id: string }) => r.id)
    : [];

  if (idList.length === 0) {
    return NextResponse.json({ ok: true, claimed: 0, sent: 0, errors: 0 });
  }

  const rows = await db
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
    .where(inArray(turnosTable.id, idList));

  let sent = 0;
  let errors = 0;

  await Promise.all(
    rows.map(async (row) => {
      if (!row.cliente.telefonoE164) {
        errors++;
        return;
      }
      const { primer, apellido } = splitName(row.cliente.nombre);
      const res = await sendManychatFlow({
        sucursalId: row.turno.sucursalId,
        telefonoE164: row.cliente.telefonoE164,
        primerNombre: primer,
        apellido,
        tipo: "recordatorio_2h",
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
      if (res.ok) sent++;
      else errors++;
    }),
  );

  return NextResponse.json({
    ok: true,
    claimed: idList.length,
    sent,
    errors,
  });
}

// GET disponible para el endpoint que paga health-check del cron externo.
export async function GET(request: Request) {
  return POST(request);
}
