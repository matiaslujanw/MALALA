"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import {
  rubrosGasto as rubrosGastoTable,
  rubroSucursal as rubroSucursalTable,
} from "@/lib/db/schema";
import type { RubroGasto } from "@/lib/types";
import { rubroGastoSchema } from "@/lib/validations/rubro-gasto";
import { getActiveSucursalForUser } from "@/lib/auth/session";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";

function mapRubroGasto(row: typeof rubrosGastoTable.$inferSelect): RubroGasto {
  return {
    id: row.id,
    rubro: row.rubro,
    subrubro: row.subrubro ?? undefined,
    activo: row.activo,
  };
}

export async function listRubrosGasto(opts?: {
  sucursalId?: string;
}): Promise<RubroGasto[]> {
  requireSupabaseRuntime(
    "Los rubros de gasto del sistema solo se cargan desde Supabase.",
  );

  const db = getDb();
  const rows = await db
    .select()
    .from(rubrosGastoTable)
    .orderBy(asc(rubrosGastoTable.rubro), asc(rubrosGastoTable.subrubro));
  if (opts?.sucursalId) {
    const miembros = await db
      .select({ rubroId: rubroSucursalTable.rubroId })
      .from(rubroSucursalTable)
      .where(eq(rubroSucursalTable.sucursalId, opts.sucursalId));
    const habilitados = new Set(miembros.map((m) => m.rubroId));
    return rows.filter((r) => habilitados.has(r.id)).map(mapRubroGasto);
  }
  return rows.map(mapRubroGasto);
}

export async function createRubroGasto(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La creacion de rubros requiere Supabase configurado.",
  );
  const parsed = rubroGastoSchema.safeParse({
    rubro: formData.get("rubro"),
    subrubro: formData.get("subrubro"),
    activo: true,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const db = getDb();
  const rubroId = crypto.randomUUID();
  await db.insert(rubrosGastoTable).values({
    id: rubroId,
    rubro: parsed.data.rubro,
    subrubro: parsed.data.subrubro ?? null,
    activo: true,
  });

  const sucursalActiva = await getActiveSucursalForUser(user);
  if (sucursalActiva) {
    await db.insert(rubroSucursalTable).values({
      id: crypto.randomUUID(),
      rubroId,
      sucursalId: sucursalActiva.id,
    });
  }

  revalidatePath("/catalogos/rubros-gasto");
  revalidatePath("/egresos");
  return { ok: true };
}

export async function toggleRubroGastoActivo(
  rgId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  requireSupabaseRuntime(
    "La activacion de rubros requiere Supabase configurado.",
  );

  const db = getDb();
  const [rubro] = await db
    .select()
    .from(rubrosGastoTable)
    .where(eq(rubrosGastoTable.id, rgId))
    .limit(1);
  if (!rubro) return { ok: false, errors: { _: ["No encontrado"] } };

  await db
    .update(rubrosGastoTable)
    .set({ activo: !rubro.activo })
    .where(eq(rubrosGastoTable.id, rgId));

  revalidatePath("/catalogos/rubros-gasto");
  revalidatePath("/egresos");
  return { ok: true };
}
