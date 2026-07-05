"use server";

import { asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import {
  cuentaImpuestos as cuentaImpuestosTable,
  cuentasBancarias as cuentasBancariasTable,
} from "@/lib/db/schema";
import { cuentaImpuestoSchema } from "@/lib/validations/cuenta-bancaria";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { fieldErrors, requireRole, type ActionResult } from "./_helpers";
import type { CuentaImpuesto } from "@/lib/types";

function createId() {
  return crypto.randomUUID();
}

function mapImpuesto(
  row: typeof cuentaImpuestosTable.$inferSelect,
): CuentaImpuesto {
  return {
    id: row.id,
    cuenta_id: row.cuentaId,
    nombre: row.nombre,
    alicuota_pct: row.alicuotaPct,
    base: row.base,
    activo: row.activo,
  };
}

/** Verifica que la cuenta exista y sea de una sucursal accesible; devuelve su id. */
async function requireCuentaAccesible(cuentaId: string): Promise<string> {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const db = getDb();
  const [cuenta] = await db
    .select({ sucursalId: cuentasBancariasTable.sucursalId })
    .from(cuentasBancariasTable)
    .where(eq(cuentasBancariasTable.id, cuentaId))
    .limit(1);
  if (!cuenta || !isSucursalAllowed(scope, cuenta.sucursalId)) {
    throw new Error("Sin acceso a la cuenta");
  }
  return cuentaId;
}

/** Impuestos (activos e inactivos) de una cuenta, para administrarlos. */
export async function listImpuestosByCuenta(
  cuentaId: string,
): Promise<CuentaImpuesto[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(cuentaImpuestosTable)
    .where(eq(cuentaImpuestosTable.cuentaId, cuentaId))
    .orderBy(asc(cuentaImpuestosTable.nombre));
  return rows.map(mapImpuesto);
}

/** Map cuentaId -> impuestos, para listar varias cuentas de una. */
export async function listImpuestosByCuentas(
  cuentaIds: string[],
): Promise<Map<string, CuentaImpuesto[]>> {
  const map = new Map<string, CuentaImpuesto[]>();
  if (cuentaIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select()
    .from(cuentaImpuestosTable)
    .where(inArray(cuentaImpuestosTable.cuentaId, cuentaIds))
    .orderBy(asc(cuentaImpuestosTable.nombre));
  for (const row of rows) {
    const cur = map.get(row.cuentaId) ?? [];
    cur.push(mapImpuesto(row));
    map.set(row.cuentaId, cur);
  }
  return map;
}

export async function createImpuesto(formData: FormData): Promise<ActionResult> {
  await requireRole(["admin", "superadmin"]);
  const parsed = cuentaImpuestoSchema.safeParse({
    cuenta_id: formData.get("cuenta_id"),
    nombre: formData.get("nombre"),
    alicuota_pct: formData.get("alicuota_pct"),
    base: formData.get("base"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    await requireCuentaAccesible(parsed.data.cuenta_id);
  } catch {
    return { ok: false, errors: { _: ["Sin acceso a la cuenta"] } };
  }

  const db = getDb();
  await db.insert(cuentaImpuestosTable).values({
    id: createId(),
    cuentaId: parsed.data.cuenta_id,
    nombre: parsed.data.nombre,
    alicuotaPct: parsed.data.alicuota_pct,
    base: parsed.data.base,
    activo: true,
  });
  revalidatePath("/catalogos/cuentas-bancarias");
  revalidatePath("/bancos");
  return { ok: true };
}

export async function toggleImpuestoActivo(id: string): Promise<ActionResult> {
  await requireRole(["admin", "superadmin"]);
  const db = getDb();
  const [imp] = await db
    .select()
    .from(cuentaImpuestosTable)
    .where(eq(cuentaImpuestosTable.id, id))
    .limit(1);
  if (!imp) return { ok: false, errors: { _: ["Impuesto no encontrado"] } };
  try {
    await requireCuentaAccesible(imp.cuentaId);
  } catch {
    return { ok: false, errors: { _: ["Sin acceso a la cuenta"] } };
  }

  await db
    .update(cuentaImpuestosTable)
    .set({ activo: !imp.activo })
    .where(eq(cuentaImpuestosTable.id, id));
  revalidatePath("/catalogos/cuentas-bancarias");
  revalidatePath("/bancos");
  return { ok: true };
}

export async function deleteImpuesto(id: string): Promise<ActionResult> {
  await requireRole(["admin", "superadmin"]);
  const db = getDb();
  const [imp] = await db
    .select()
    .from(cuentaImpuestosTable)
    .where(eq(cuentaImpuestosTable.id, id))
    .limit(1);
  if (!imp) return { ok: false, errors: { _: ["Impuesto no encontrado"] } };
  try {
    await requireCuentaAccesible(imp.cuentaId);
  } catch {
    return { ok: false, errors: { _: ["Sin acceso a la cuenta"] } };
  }

  await db.delete(cuentaImpuestosTable).where(eq(cuentaImpuestosTable.id, id));
  revalidatePath("/catalogos/cuentas-bancarias");
  revalidatePath("/bancos");
  return { ok: true };
}
