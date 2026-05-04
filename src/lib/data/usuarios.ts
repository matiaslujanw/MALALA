"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import { profiles as profilesTable } from "@/lib/db/schema";
import type { Usuario } from "@/lib/types";

function mapUsuario(row: typeof profilesTable.$inferSelect): Usuario {
  return {
    id: row.userId,
    email: row.email,
    nombre: row.nombre,
    rol: row.rol,
    sucursal_default_id: row.sucursalDefaultId,
    empleado_id: row.empleadoId ?? undefined,
    sucursal_ids_permitidas: [row.sucursalDefaultId],
    activo: row.activo,
  };
}

export async function listUsuariosApp(opts?: {
  incluirInactivos?: boolean;
  sucursalIds?: string[];
}): Promise<Usuario[]> {
  requireSupabaseRuntime(
    "Los usuarios internos del sistema solo se cargan desde Supabase.",
  );

  const db = getDb();
  const filters = [];
  if (!opts?.incluirInactivos) filters.push(eq(profilesTable.activo, true));
  if (opts?.sucursalIds?.length) {
    filters.push(inArray(profilesTable.sucursalDefaultId, opts.sucursalIds));
  }

  const rows =
    filters.length > 0
      ? await db
          .select()
          .from(profilesTable)
          .where(and(...filters))
          .orderBy(asc(profilesTable.nombre))
      : await db
          .select()
          .from(profilesTable)
          .orderBy(asc(profilesTable.nombre));

  return rows.map(mapUsuario);
}
