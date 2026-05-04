import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import { servicios as serviciosTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { servicioSchema } from "@/lib/validations/servicio";
import type { Servicio } from "@/lib/types";

function createId() {
  return crypto.randomUUID();
}

function mapServicio(row: typeof serviciosTable.$inferSelect): Servicio {
  return {
    id: row.id,
    rubro: row.rubro,
    nombre: row.nombre,
    precio_lista: row.precioLista,
    precio_efectivo: row.precioEfectivo,
    comision_default_pct: row.comisionDefaultPct,
    activo: row.activo,
    duracion_min: row.duracionMin ?? undefined,
    descripcion_corta: row.descripcionCorta ?? undefined,
    destacado_pct: row.destacadoPct ?? undefined,
  };
}

export async function listServicios(opts?: {
  incluirInactivos?: boolean;
}): Promise<Servicio[]> {
  const db = getDb();
  const rows = opts?.incluirInactivos
    ? await db
        .select()
        .from(serviciosTable)
        .orderBy(asc(serviciosTable.rubro), asc(serviciosTable.nombre))
    : await db
        .select()
        .from(serviciosTable)
        .where(eq(serviciosTable.activo, true))
        .orderBy(asc(serviciosTable.rubro), asc(serviciosTable.nombre));

  return rows.map(mapServicio);
}

export async function getServicio(servicioId: string): Promise<Servicio | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(serviciosTable)
    .where(eq(serviciosTable.id, servicioId))
    .limit(1);
  return row ? mapServicio(row) : null;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> };

function fieldErrors(err: unknown): Record<string, string[]> {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (
      err as { issues: { path: (string | number)[]; message: string }[] }
    ).issues;
    const out: Record<string, string[]> = {};
    for (const issue of issues) {
      const key = issue.path.join(".") || "_";
      (out[key] ??= []).push(issue.message);
    }
    return out;
  }
  return { _: ["Error desconocido"] };
}

function parse(formData: FormData) {
  return servicioSchema.safeParse({
    rubro: formData.get("rubro"),
    nombre: formData.get("nombre"),
    precio_lista: formData.get("precio_lista"),
    precio_efectivo: formData.get("precio_efectivo"),
    comision_default_pct: formData.get("comision_default_pct"),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
  });
}

export async function createServicio(formData: FormData): Promise<ActionResult> {
  "use server";
  const user = await requireUser();
  if (user.rol !== "admin") {
    return { ok: false, errors: { _: ["Solo admin puede crear servicios"] } };
  }

  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const db = getDb();
  await db.insert(serviciosTable).values({
    id: createId(),
    rubro: parsed.data.rubro,
    nombre: parsed.data.nombre,
    precioLista: parsed.data.precio_lista,
    precioEfectivo: parsed.data.precio_efectivo,
    comisionDefaultPct: parsed.data.comision_default_pct,
    activo: parsed.data.activo,
  });

  revalidatePath("/catalogos/servicios");
  revalidatePath("/");
  return { ok: true };
}

export async function updateServicio(
  servicioId: string,
  formData: FormData,
): Promise<ActionResult> {
  "use server";
  const user = await requireUser();
  if (user.rol !== "admin") {
    return { ok: false, errors: { _: ["Solo admin puede editar servicios"] } };
  }

  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: serviciosTable.id })
    .from(serviciosTable)
    .where(eq(serviciosTable.id, servicioId))
    .limit(1);
  if (!existing) {
    return { ok: false, errors: { _: ["Servicio no encontrado"] } };
  }

  await db
    .update(serviciosTable)
    .set({
      rubro: parsed.data.rubro,
      nombre: parsed.data.nombre,
      precioLista: parsed.data.precio_lista,
      precioEfectivo: parsed.data.precio_efectivo,
      comisionDefaultPct: parsed.data.comision_default_pct,
      activo: parsed.data.activo,
    })
    .where(eq(serviciosTable.id, servicioId));

  revalidatePath("/catalogos/servicios");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleServicioActivo(
  servicioId: string,
): Promise<ActionResult> {
  "use server";
  const user = await requireUser();
  if (user.rol !== "admin") {
    return { ok: false, errors: { _: ["Solo admin"] } };
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(serviciosTable)
    .where(eq(serviciosTable.id, servicioId))
    .limit(1);
  if (!row) return { ok: false, errors: { _: ["No encontrado"] } };

  await db
    .update(serviciosTable)
    .set({ activo: !row.activo })
    .where(eq(serviciosTable.id, servicioId));

  revalidatePath("/catalogos/servicios");
  revalidatePath("/");
  return { ok: true };
}
