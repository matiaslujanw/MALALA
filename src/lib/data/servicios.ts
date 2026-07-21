import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client/postgres";
import {
  servicios as serviciosTable,
  servicioSucursal as servicioSucursalTable,
} from "@/lib/db/schema";
import { getActiveSucursalForUser, requireUser } from "@/lib/auth/session";
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
    visible_reserva: row.visibleReserva,
    duracion_min: row.duracionMin ?? undefined,
    descripcion_corta: row.descripcionCorta ?? undefined,
    destacado_pct: row.destacadoPct ?? undefined,
    es_promo: row.esPromo,
    vence_el: row.venceEl ?? undefined,
  };
}

export async function listServicios(opts?: {
  incluirInactivos?: boolean;
  /** Si se pasa, solo servicios habilitados en esa sucursal (membresía). */
  sucursalId?: string;
}): Promise<Servicio[]> {
  const db = getDb();
  // Las promociones también son filas de `servicios` (es_promo=true) pero se
  // gestionan en su propio catálogo; acá se excluyen.
  const rows = opts?.incluirInactivos
    ? await db
        .select()
        .from(serviciosTable)
        .where(eq(serviciosTable.esPromo, false))
        .orderBy(asc(serviciosTable.rubro), asc(serviciosTable.nombre))
    : await db
        .select()
        .from(serviciosTable)
        .where(
          and(eq(serviciosTable.activo, true), eq(serviciosTable.esPromo, false)),
        )
        .orderBy(asc(serviciosTable.rubro), asc(serviciosTable.nombre));

  if (opts?.sucursalId) {
    const miembros = await db
      .select({ servicioId: servicioSucursalTable.servicioId })
      .from(servicioSucursalTable)
      .where(eq(servicioSucursalTable.sucursalId, opts.sucursalId));
    const habilitados = new Set(miembros.map((m) => m.servicioId));
    return rows.filter((r) => habilitados.has(r.id)).map(mapServicio);
  }

  return rows.map(mapServicio);
}

/**
 * Membresía servicio↔sucursal para todo el catálogo. La usa la reserva pública
 * para mostrar en cada sucursal solo los servicios habilitados ahí.
 */
export async function listServiciosSucursalesAll(): Promise<
  { servicio_id: string; sucursal_id: string }[]
> {
  const db = getDb();
  const rows = await db
    .select({
      servicioId: servicioSucursalTable.servicioId,
      sucursalId: servicioSucursalTable.sucursalId,
    })
    .from(servicioSucursalTable);
  return rows.map((r) => ({
    servicio_id: r.servicioId,
    sucursal_id: r.sucursalId,
  }));
}

/** Rubros ya usados por servicios (no promos), para elegir en el alta/edición. */
export async function listRubrosServicios(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ rubro: serviciosTable.rubro })
    .from(serviciosTable)
    .where(eq(serviciosTable.esPromo, false))
    .orderBy(asc(serviciosTable.rubro));
  return rows.map((r) => r.rubro).filter((r): r is string => Boolean(r));
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
    duracion_min: formData.get("duracion_min"),
    activo: formData.get("activo") === "on" || formData.get("activo") === "true",
    visible_reserva:
      formData.get("visible_reserva") === "on" ||
      formData.get("visible_reserva") === "true",
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
  const servicioId = createId();
  await db.insert(serviciosTable).values({
    id: servicioId,
    rubro: parsed.data.rubro,
    nombre: parsed.data.nombre,
    precioLista: parsed.data.precio_lista,
    precioEfectivo: parsed.data.precio_efectivo,
    comisionDefaultPct: 0, // la comisión la define el % del empleado
    duracionMin: parsed.data.duracion_min,
    activo: parsed.data.activo,
    visibleReserva: parsed.data.visible_reserva,
  });

  // Membresía: el servicio queda habilitado en la sucursal activa del admin.
  const sucursalActiva = await getActiveSucursalForUser(user);
  if (sucursalActiva) {
    await db.insert(servicioSucursalTable).values({
      id: createId(),
      servicioId,
      sucursalId: sucursalActiva.id,
    });
  }

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
      // comisionDefaultPct ya no se gestiona desde el servicio.
      duracionMin: parsed.data.duracion_min,
      activo: parsed.data.activo,
      visibleReserva: parsed.data.visible_reserva,
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
